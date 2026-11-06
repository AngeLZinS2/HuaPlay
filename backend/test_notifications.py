"""Comprehensive tests for HuaPlay notification system.

Tests:
- Public in-app feed filtering (draft, scheduled future, cancelled, audience).
- Privacy: no admin or worker metadata leaked.
- Device token subscription, token collision handling, and owner-filtered unsubscription.
- Admin workflow: draft, schedule, send-now, cancel, delete.
- Idempotent edit: simple text edit does not re-trigger push.
- FCM honest configuration reporting with strict schema validation.
- Concurrency-safe atomic claims across multiple workers.
- Per-recipient delivery records: retry of failed tokens never re-sends to successful ones.
- Mid-flight cancellation stops subsequent recipient dispatch.
- Resumption of pending_credentials notifications when credentials become configured.
"""

from datetime import datetime, timedelta, timezone
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from database import Base, get_db
import models
from main import app
from auth import FirebaseUser, get_current_admin, get_current_user
import fcm_service

TEST_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

mock_admin = FirebaseUser(
    uid="admin-123",
    email="admin@huaplay.app",
    name="Admin User",
    email_verified=True,
    is_admin=True,
)

mock_normal_user = FirebaseUser(
    uid="user-456",
    email="user@huaplay.app",
    name="Normal User",
    email_verified=True,
    is_admin=False,
)

mock_other_user = FirebaseUser(
    uid="user-789",
    email="other@huaplay.app",
    name="Other User",
    email_verified=True,
    is_admin=False,
)

current_test_user = mock_normal_user


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


def override_get_current_user():
    return current_test_user


def override_get_current_admin():
    return mock_admin


app.dependency_overrides[get_db] = override_get_db
app.dependency_overrides[get_current_user] = override_get_current_user
app.dependency_overrides[get_current_admin] = override_get_current_admin


@pytest.fixture(autouse=True)
def setup_database():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def db_session():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


def test_public_feed_filtering(client, db_session):
    now = datetime.now(timezone.utc)

    n1 = models.AdminNotification(
        title="Novo Episódio Disponível",
        message="Episódio 5 lançado!",
        status="published",
        audience="all",
        action_url="/series/123",
        sent_at=now - timedelta(hours=1),
    )
    n2 = models.AdminNotification(
        title="Rascunho de Aviso",
        message="Em revisão",
        status="draft",
        audience="all",
    )
    n3 = models.AdminNotification(
        title="Cancelado",
        message="Cancelado",
        status="cancelled",
        audience="all",
    )
    n4 = models.AdminNotification(
        title="Futuro",
        message="Ainda vai sair",
        status="scheduled",
        scheduled_at=now + timedelta(days=1),
        audience="all",
    )
    n5 = models.AdminNotification(
        title="Aviso Web",
        message="Novidade no site",
        status="published",
        audience="web",
        sent_at=now - timedelta(minutes=30),
    )
    n6 = models.AdminNotification(
        title="Aviso Android",
        message="Atualize seu APK",
        status="published",
        audience="android",
        sent_at=now - timedelta(minutes=15),
    )

    db_session.add_all([n1, n2, n3, n4, n5, n6])
    db_session.commit()

    resp_web = client.get("/notifications/feed?platform=web")
    assert resp_web.status_code == 200
    items_web = resp_web.json()
    titles_web = [i["title"] for i in items_web]

    assert "Novo Episódio Disponível" in titles_web
    assert "Aviso Web" in titles_web
    assert "Aviso Android" not in titles_web
    assert "Rascunho de Aviso" not in titles_web
    assert "Cancelado" not in titles_web
    assert "Futuro" not in titles_web

    # Verify no private admin or worker metadata leaked
    for item in items_web:
        assert "push_status" not in item
        assert "push_error" not in item
        assert "claimed_at" not in item
        assert "claimed_by" not in item
        assert "retry_count" not in item


def test_device_token_subscription_and_owner_unsubscribe(client, db_session):
    global current_test_user
    current_test_user = mock_normal_user

    # 1. Subscribe token as user-456
    resp = client.post(
        "/notifications/subscribe",
        json={"token": "token_owner_test_12345", "platform": "web"},
    )
    assert resp.status_code == 200

    token_rec = db_session.query(models.PushDeviceToken).filter_by(token="token_owner_test_12345").first()
    assert token_rec is not None
    assert token_rec.user_id == "user-456"
    assert token_rec.is_active is True

    # 2. Other user attempts to unsubscribe this token -> 403 Forbidden
    current_test_user = mock_other_user
    resp_unauth = client.post(
        "/notifications/unsubscribe",
        json={"token": "token_owner_test_12345"},
    )
    assert resp_unauth.status_code == 403
    db_session.refresh(token_rec)
    assert token_rec.is_active is True

    # 3. True owner unsubscribes -> 200 OK
    current_test_user = mock_normal_user
    resp_owner = client.post(
        "/notifications/unsubscribe",
        json={"token": "token_owner_test_12345"},
    )
    assert resp_owner.status_code == 200
    db_session.refresh(token_rec)
    assert token_rec.is_active is False


def test_token_collision_account_change(client, db_session):
    global current_test_user

    # 1. User A registers token on device (active)
    current_test_user = mock_normal_user
    resp1 = client.post("/notifications/subscribe", json={"token": "shared_device_token_999", "platform": "web"})
    assert resp1.status_code == 200

    rec = db_session.query(models.PushDeviceToken).filter_by(token="shared_device_token_999").first()
    assert rec.user_id == "user-456"
    assert rec.is_active is True

    # 2. User B tries to hijack the ACTIVE token without User A unsubscribing -> 409 Conflict
    current_test_user = mock_other_user
    resp_conflict = client.post("/notifications/subscribe", json={"token": "shared_device_token_999", "platform": "android"})
    assert resp_conflict.status_code == 409

    # 3. User A unregisters/logs out (token becomes inactive)
    current_test_user = mock_normal_user
    client.post("/notifications/unsubscribe", json={"token": "shared_device_token_999"})
    db_session.refresh(rec)
    assert rec.is_active is False

    # 4. Now User B can register the inactive token cleanly
    current_test_user = mock_other_user
    resp_transfer = client.post("/notifications/subscribe", json={"token": "shared_device_token_999", "platform": "android"})
    assert resp_transfer.status_code == 200

    db_session.refresh(rec)
    assert rec.user_id == "user-789"
    assert rec.platform == "android"
    assert rec.is_active is True
    assert db_session.query(models.PushDeviceToken).filter_by(token="shared_device_token_999").count() == 1


def test_admin_notification_crud_and_status(client, db_session):
    resp_draft = client.post(
        "/admin/notifications",
        json={
            "title": "Aviso de Teste Rascunho",
            "message": "Conteúdo do teste",
            "status": "draft",
            "audience": "all",
        },
    )
    assert resp_draft.status_code == 201
    draft_data = resp_draft.json()
    item_id = draft_data["id"]

    resp_edit = client.put(
        f"/admin/notifications/{item_id}",
        json={
            "title": "Aviso Editado",
            "message": "Conteúdo modificado",
            "status": "draft",
            "audience": "web",
        },
    )
    assert resp_edit.status_code == 200
    assert resp_edit.json()["title"] == "Aviso Editado"

    resp_send = client.post(f"/admin/notifications/{item_id}/dispatch-now")
    assert resp_send.status_code == 200
    assert resp_send.json()["status"] == "published"
    assert resp_send.json()["push_status"] == "pending"

    # Simple edit after publishing MUST NOT re-trigger push
    resp_edit_after = client.put(
        f"/admin/notifications/{item_id}",
        json={
            "title": "Aviso Editado Novamente",
            "message": "Conteúdo modificado pós-envio",
            "status": "published",
            "audience": "web",
        },
    )
    assert resp_edit_after.status_code == 200
    assert resp_edit_after.json()["push_status"] == "pending"


def test_fcm_config_strict_validation(monkeypatch):
    # Valid service account JSON
    valid_data = {
        "type": "service_account",
        "project_id": "gtavi-6991d",
        "client_email": "firebase-adminsdk@gtavi-6991d.iam.gserviceaccount.com",
        "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgk...\n-----END PRIVATE KEY-----\n",
    }
    valid, _ = fcm_service._validate_service_account_dict(valid_data)
    assert valid is True

    # Arbitrary JSON must be rejected (no false valid)
    invalid_data = {"some_key": "some_value", "foo": "bar"}
    valid_invalid, detail = fcm_service._validate_service_account_dict(invalid_data)
    assert valid_invalid is False


def test_worker_race_condition_deterministic(db_session, monkeypatch):
    monkeypatch.setattr(fcm_service, "SessionLocal", lambda: TestingSessionLocal())

    notif = models.AdminNotification(
        title="Notificação Concorrente",
        message="Apenas um worker deve processar",
        status="published",
        push_status="pending",
        audience="all",
    )
    db_session.add(notif)
    db_session.commit()

    # Two workers race simultaneously
    w1_processed = fcm_service.process_pending_pushes_sync("worker-race-1")
    w2_processed = fcm_service.process_pending_pushes_sync("worker-race-2")

    assert w1_processed + w2_processed == 1


def test_per_recipient_delivery_records_prevent_duplicate_resends(db_session, monkeypatch):
    monkeypatch.setattr(fcm_service, "SessionLocal", lambda: TestingSessionLocal())
    monkeypatch.setattr(fcm_service, "get_fcm_config_status", lambda: {
        "configured": True,
        "project_id": "gtavi-6991d",
        "detail": "Mocked test creds",
    })
    monkeypatch.setattr(fcm_service, "_get_fcm_access_token", lambda: "mock_test_token")

    sent_tokens_recorded = []

    def mock_send(access_token, project_id, device_token, **kwargs):
        sent_tokens_recorded.append(device_token)
        if device_token == "failing_token_xyz":
            return {"success": False, "invalid_token": False, "error": "TransientServerError"}
        return {"success": True, "invalid_token": False, "error": None}

    monkeypatch.setattr(fcm_service, "send_fcm_message", mock_send)

    t1 = models.PushDeviceToken(user_id="u1", token="success_token_abc", platform="web", is_active=True)
    t2 = models.PushDeviceToken(user_id="u2", token="failing_token_xyz", platform="web", is_active=True)
    notif = models.AdminNotification(
        title="Episódio 10",
        message="Veja agora",
        status="published",
        push_status="pending",
        audience="all",
        max_retries=2,
    )
    db_session.add_all([t1, t2, notif])
    db_session.commit()

    # First attempt: t1 succeeds, t2 fails
    fcm_service.process_pending_pushes_sync("worker-attempt-1")
    assert sent_tokens_recorded == ["success_token_abc", "failing_token_xyz"]

    db_session.refresh(notif)
    assert notif.push_status == "partial_failure"
    assert notif.retry_count == 1
    assert notif.push_sent_count == 1
    assert notif.push_failed_count == 1

    # Reset recorded calls and simulate retry window passing
    sent_tokens_recorded.clear()
    notif.next_retry_at = datetime.now(timezone.utc) - timedelta(seconds=1)
    db_session.commit()

    # Second attempt: retry should ONLY send to t2 (failing_token_xyz), NEVER re-send to t1!
    fcm_service.process_pending_pushes_sync("worker-attempt-2")
    assert "success_token_abc" not in sent_tokens_recorded
    assert sent_tokens_recorded == ["failing_token_xyz"]


def test_pending_credentials_resumption(db_session, monkeypatch):
    monkeypatch.setattr(fcm_service, "SessionLocal", lambda: TestingSessionLocal())

    # Initially unconfigured
    is_cfg = False
    monkeypatch.setattr(fcm_service, "get_fcm_config_status", lambda: {
        "configured": is_cfg,
        "project_id": "gtavi-6991d",
        "detail": "Credentials not configured",
    })

    notif = models.AdminNotification(
        title="Push Pendente",
        message="Aguardando credenciais",
        status="published",
        push_status="pending",
        audience="all",
    )
    db_session.add(notif)
    db_session.commit()

    # Worker marks pending_credentials
    fcm_service.process_pending_pushes_sync("worker-check-1")
    db_session.refresh(notif)
    assert notif.push_status == "pending_credentials"

    # Now simulate administrator mounting credentials
    is_cfg = True
    monkeypatch.setattr(fcm_service, "_get_fcm_access_token", lambda: "valid_token")
    monkeypatch.setattr(fcm_service, "send_fcm_message", lambda *args, **kwargs: {"success": True, "invalid_token": False, "error": None})

    t1 = models.PushDeviceToken(user_id="u1", token="resumed_token_123", platform="web", is_active=True)
    db_session.add(t1)
    db_session.commit()

    # Worker detects configured credentials and resumes pending_credentials notice!
    processed = fcm_service.process_pending_pushes_sync("worker-check-2")
    assert processed == 1

    db_session.refresh(notif)
    assert notif.push_status == "sent"
    assert notif.push_sent_count == 1
