"""FCM HTTP v1 Client and Push Worker for HuaPlay.

Addresses:
- Honest FCM credential validation (strict service_account JSON parsing, no false valid).
- Concurrency-safe atomic status+schedule predicated claim preventing stale worker races.
- Stale processing recovery and pending_credentials resumption when configured.
- Bounded per-recipient delivery records: retry of failed tokens NEVER re-sends to successful ones.
- Lease heartbeat during token processing to prevent claim timeout expiration.
- Mid-flight cancellation check stopping subsequent recipient batches.
- Prunes tokens ONLY on verified FCM UNREGISTERED error details (never on generic 404).
- Safe logging without leaking secrets.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

import requests
from google.auth.transport import requests as google_requests
from google.oauth2 import service_account
from sqlalchemy import or_, text
from sqlalchemy.orm import Session

import models
from database import SessionLocal

logger = logging.getLogger("huaplay.push")
logger.setLevel(logging.INFO)

FIREBASE_PROJECT_ID = os.getenv("FIREBASE_PROJECT_ID", "gtavi-6991d")
CLAIM_TIMEOUT_MINUTES = 5
MAX_WORKER_RETRIES = 3
BATCH_SIZE = 25
WORKER_POLL_INTERVAL_SECONDS = 10

_worker_task: Optional[asyncio.Task[None]] = None
_stop_event = asyncio.Event()


def _validate_service_account_dict(data: Any) -> Tuple[bool, str]:
    """Strictly validate service account schema to avoid false 'valid' on arbitrary JSON."""
    if not isinstance(data, dict):
        return False, "Credential payload is not a JSON object"

    if data.get("type") != "service_account":
        return False, "Invalid credential type (expected 'service_account')"

    project = data.get("project_id")
    if not project or project != FIREBASE_PROJECT_ID:
        return False, f"Credential project_id '{project}' does not match expected '{FIREBASE_PROJECT_ID}'"

    client_email = data.get("client_email")
    if not client_email or "@" not in str(client_email):
        return False, "Missing or invalid client_email in service account credential"

    private_key = data.get("private_key")
    if not private_key or "-----BEGIN PRIVATE KEY-----" not in str(private_key):
        return False, "Missing or malformed private_key in service account credential"

    return True, "Valid service account structure"


def get_credential_info() -> Tuple[Optional[str], Optional[Dict[str, Any]], Optional[str]]:
    """Resolve the service account credential file or JSON from env."""
    for env_var in (
        "HUAPLAY_FCM_CREDENTIALS_PATH",
        "FIREBASE_SERVICE_ACCOUNT_PATH",
        "GOOGLE_APPLICATION_CREDENTIALS",
    ):
        val = os.getenv(env_var)
        if val and os.path.isfile(val):
            return val, None, f"env:{env_var}"

    json_raw = os.getenv("HUAPLAY_FCM_CREDENTIALS_JSON") or os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON")
    if json_raw:
        try:
            parsed = json.loads(json_raw)
            valid, _ = _validate_service_account_dict(parsed)
            if valid:
                return None, parsed, "env:HUAPLAY_FCM_CREDENTIALS_JSON"
        except Exception:
            pass

    return None, None, None


def get_fcm_config_status() -> Dict[str, Any]:
    """Report honest status of push credentials without leaking secrets."""
    path, inline_data, source = get_credential_info()

    if path:
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
            valid, detail = _validate_service_account_dict(data)
            if valid:
                return {
                    "configured": True,
                    "project_id": FIREBASE_PROJECT_ID,
                    "client_email": data.get("client_email"),
                    "source": source,
                    "detail": "Credentials valid and mounted",
                }
            return {
                "configured": False,
                "project_id": FIREBASE_PROJECT_ID,
                "source": source,
                "detail": detail,
            }
        except Exception as exc:
            return {
                "configured": False,
                "project_id": FIREBASE_PROJECT_ID,
                "source": source,
                "detail": f"File unreadable: {exc}",
            }

    if inline_data:
        valid, detail = _validate_service_account_dict(inline_data)
        if valid:
            return {
                "configured": True,
                "project_id": FIREBASE_PROJECT_ID,
                "client_email": inline_data.get("client_email"),
                "source": source,
                "detail": "Inline credentials parsed and ready",
            }
        return {
            "configured": False,
            "project_id": FIREBASE_PROJECT_ID,
            "source": source,
            "detail": detail,
        }

    return {
        "configured": False,
        "project_id": FIREBASE_PROJECT_ID,
        "source": None,
        "detail": "Firebase service account credentials not configured or file not found. Push dispatch pending configuration.",
    }


def _get_fcm_access_token() -> Optional[str]:
    """Fetch an OAuth2 access token for FCM HTTP v1 using google-auth."""
    path, inline_data, _ = get_credential_info()
    scopes = ["https://www.googleapis.com/auth/firebase.messaging"]

    try:
        if path:
            creds = service_account.Credentials.from_service_account_file(path, scopes=scopes)
        elif inline_data:
            creds = service_account.Credentials.from_service_account_info(inline_data, scopes=scopes)
        else:
            return None

        creds.refresh(google_requests.Request())
        return creds.token
    except Exception as exc:
        logger.error("Failed to generate FCM access token via google-auth: %s", exc)
        return None


def send_fcm_message(
    access_token: str,
    project_id: str,
    device_token: str,
    title: str,
    body: str,
    action_url: Optional[str] = None,
    image_url: Optional[str] = None,
    notification_id: Optional[int] = None,
) -> Dict[str, Any]:
    """Send a single push notification via FCM HTTP v1 API."""
    endpoint = f"https://fcm.googleapis.com/v1/projects/{project_id}/messages:send"
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json; UTF-8",
    }

    clean_action = action_url or "/"
    notif_id_str = str(notification_id or "")

    message_payload: Dict[str, Any] = {
        "token": device_token,
        "notification": {
            "title": title,
            "body": body,
        },
        "data": {
            "id": notif_id_str,
            "notification_id": notif_id_str,
            "title": title,
            "message": body,
            "action_url": clean_action,
        },
        "android": {
            "priority": "HIGH",
            "notification": {
                "sound": "default",
                "channel_id": "huaplay_updates",
            },
        },
        "webpush": {
            "headers": {
                "Urgency": "high",
            },
            "fcm_options": {
                "link": clean_action,
            },
        },
    }

    if image_url:
        message_payload["notification"]["image"] = image_url

    try:
        resp = requests.post(
            endpoint,
            headers=headers,
            json={"message": message_payload},
            timeout=10,
        )

        if resp.status_code == 200:
            return {"success": True, "invalid_token": False, "error": None}

        err_text = resp.text
        err_code = ""
        try:
            err_json = resp.json()
            err_details = err_json.get("error", {})
            for detail in err_details.get("details", []):
                if detail.get("@type") == "type.googleapis.com/google.firebase.fcm.v1.FcmError":
                    err_code = detail.get("errorCode", "")
        except Exception:
            pass

        # Strict token invalidation: ONLY prune on explicit UNREGISTERED FCM details
        is_unregistered = (
            err_code == "UNREGISTERED"
            or "registration-token-not-registered" in err_text.lower()
            or "token is not registered" in err_text.lower()
        )

        return {
            "success": False,
            "invalid_token": is_unregistered,
            "error": f"HTTP {resp.status_code}: {err_code or 'DeliveryError'}",
        }
    except Exception as exc:
        return {"success": False, "invalid_token": False, "error": f"NetworkError: {exc}"}


def _heartbeat_claim(db: Session, notification_id: int, worker_id: str) -> bool:
    """Update claimed_at timestamp to prevent lease timeout during long dispatch loops."""
    now = datetime.now(timezone.utc)
    res = db.execute(
        text(
            "UPDATE admin_notifications "
            "SET claimed_at = :now, updated_at = :now "
            "WHERE id = :id AND claimed_by = :worker_id"
        ),
        {"now": now, "id": notification_id, "worker_id": worker_id},
    )
    db.commit()
    return res.rowcount > 0


def _process_single_notification(db: Session, notification_id: int, worker_id: str) -> None:
    """Process push dispatch with per-recipient tracking, bounded retries, and cancellation check."""
    notif = db.get(models.AdminNotification, notification_id)
    if not notif or notif.status == "cancelled":
        if notif:
            notif.claimed_at = None
            notif.claimed_by = None
            db.commit()
        return

    now = datetime.now(timezone.utc)

    # 1. Check FCM Credentials
    config_status = get_fcm_config_status()
    if not config_status["configured"]:
        notif.push_status = "pending_credentials"
        notif.push_error = config_status["detail"]
        notif.claimed_at = None
        notif.claimed_by = None
        db.commit()
        return

    access_token = _get_fcm_access_token()
    if not access_token:
        notif.push_status = "pending_credentials"
        notif.push_error = "Could not obtain access token from service account"
        notif.claimed_at = None
        notif.claimed_by = None
        db.commit()
        return

    # 2. Query target active tokens for audience
    query = db.query(models.PushDeviceToken).filter(models.PushDeviceToken.is_active == True)
    if notif.audience == "web":
        query = query.filter(models.PushDeviceToken.platform == "web")
    elif notif.audience == "android":
        query = query.filter(models.PushDeviceToken.platform == "android")

    all_tokens = query.all()
    if not all_tokens:
        notif.push_status = "skipped_no_tokens"
        notif.push_error = "No active device tokens found for audience"
        notif.claimed_at = None
        notif.claimed_by = None
        db.commit()
        return

    # 3. Load existing delivery records for this notification to guarantee idempotency
    existing_recipients = {
        r.token_id: r
        for r in db.query(models.PushDeliveryRecipient).filter_by(notification_id=notif.id).all()
    }

    # Filter out tokens that were ALREADY successfully sent
    pending_tokens = []
    for t in all_tokens:
        rec = existing_recipients.get(t.id)
        if rec and rec.status == "sent":
            continue  # NEVER re-send to already successful recipients
        pending_tokens.append(t)

    if not pending_tokens:
        # All eligible tokens already sent
        notif.push_status = "sent"
        notif.claimed_at = None
        notif.claimed_by = None
        db.commit()
        return

    sent_count_batch = 0
    failed_count_batch = 0
    last_error: Optional[str] = None
    invalid_token_ids: List[int] = []

    # 4. Process each pending recipient with heartbeat and immediate persistence
    for token_record in pending_tokens:
        # Verify claim ownership + cancel/delete before each recipient
        db.refresh(notif)
        if not notif or notif.status == "cancelled" or notif.claimed_by != worker_id:
            return

        # Heartbeat before send
        _heartbeat_claim(db, notif.id, worker_id)

        res = send_fcm_message(
            access_token=access_token,
            project_id=FIREBASE_PROJECT_ID,
            device_token=token_record.token,
            title=notif.title,
            body=notif.message,
            action_url=notif.action_url,
            image_url=notif.image_url,
            notification_id=notif.id,
        )

        rec = existing_recipients.get(token_record.id)
        if not rec:
            rec = models.PushDeliveryRecipient(
                notification_id=notif.id,
                token_id=token_record.id,
                status="pending",
                attempt_count=0,
            )
            db.add(rec)
            existing_recipients[token_record.id] = rec

        rec.attempt_count += 1
        if res["success"]:
            rec.status = "sent"
            rec.error_message = None
            rec.sent_at = datetime.now(timezone.utc)
        else:
            rec.status = "failed"
            rec.error_message = res["error"]
            last_error = res["error"]
            if res["invalid_token"]:
                invalid_token_ids.append(token_record.id)

        # Persist result immediately so known successes never repeat
        db.commit()

    # 5. Prune verified invalid tokens
    if invalid_token_ids:
        db.query(models.PushDeviceToken).filter(
            models.PushDeviceToken.id.in_(invalid_token_ids)
        ).update({"is_active": False}, synchronize_session=False)
        db.commit()

    # 6. Recalculate totals from recipient records
    all_recipients = db.query(models.PushDeliveryRecipient).filter_by(notification_id=notif.id).all()
    total_sent = sum(1 for r in all_recipients if r.status == "sent")
    total_failed = sum(1 for r in all_recipients if r.status == "failed")

    notif.push_sent_count = total_sent
    notif.push_failed_count = total_failed

    if total_failed == 0:
        notif.push_status = "sent"
        notif.push_error = None
        notif.next_retry_at = None
    else:
        # Bounded retries and explicit partial status
        if notif.retry_count < notif.max_retries:
            notif.retry_count += 1
            backoff_sec = min(300, 10 * (2 ** notif.retry_count))
            notif.next_retry_at = datetime.now(timezone.utc) + timedelta(seconds=backoff_sec)
            notif.push_status = "partial_failure" if total_sent > 0 else "pending"
            notif.push_error = f"Retrying failed tokens (attempt {notif.retry_count}/{notif.max_retries}): {last_error}"
        else:
            notif.push_status = "partial_failure" if total_sent > 0 else "failed"
            notif.push_error = f"Max retries reached ({notif.max_retries}). {last_error or ''}"
            notif.next_retry_at = None

    if not notif.sent_at and total_sent > 0:
        notif.sent_at = datetime.now(timezone.utc)

    notif.claimed_at = None
    notif.claimed_by = None
    notif.updated_at = datetime.now(timezone.utc)
    db.commit()


def process_pending_pushes_sync(worker_id: str) -> int:
    """Run one concurrency-safe polling tick.

    Atomically predicates full expected status and schedule before claim.
    Recovers stale processing and pending_credentials when configured.
    """
    db = SessionLocal()
    processed = 0
    try:
        now = datetime.now(timezone.utc)
        timeout_threshold = now - timedelta(minutes=CLAIM_TIMEOUT_MINUTES)
        is_configured = get_fcm_config_status()["configured"]

        # 0. Recover stale crashed claims (e.g. worker process killed during processing)
        db.execute(
            text(
                "UPDATE admin_notifications "
                "SET claimed_at = NULL, claimed_by = NULL, push_status = 'pending', updated_at = :now "
                "WHERE push_status = 'processing' AND claimed_at < :thresh"
            ),
            {"now": now, "thresh": timeout_threshold},
        )
        db.commit()

        # 1. Claim scheduled notifications due for publishing
        scheduled_candidates = (
            db.query(models.AdminNotification)
            .filter(
                models.AdminNotification.status == "scheduled",
                models.AdminNotification.scheduled_at <= now,
                or_(
                    models.AdminNotification.claimed_at == None,
                    models.AdminNotification.claimed_at < timeout_threshold,
                ),
            )
            .all()
        )

        for candidate in scheduled_candidates:
            # Atomic predicate ensuring status is still scheduled
            claim_result = db.execute(
                text(
                    "UPDATE admin_notifications "
                    "SET claimed_at = :now, claimed_by = :worker_id, "
                    "status = 'published', push_status = 'processing', sent_at = :now, updated_at = :now "
                    "WHERE id = :id AND status = 'scheduled' AND scheduled_at <= :now "
                    "AND (claimed_at IS NULL OR claimed_at < :thresh)"
                ),
                {
                    "now": now,
                    "worker_id": worker_id,
                    "id": candidate.id,
                    "thresh": timeout_threshold,
                },
            )
            db.commit()
            if claim_result.rowcount == 1:
                _process_single_notification(db, candidate.id, worker_id)
                processed += 1

        # 2. Claim pending / retryable / pending_credentials (if now configured) notifications
        push_status_filter = ["pending", "partial_failure"]
        if is_configured:
            push_status_filter.append("pending_credentials")

        pending_candidates = (
            db.query(models.AdminNotification)
            .filter(
                models.AdminNotification.status == "published",
                models.AdminNotification.push_status.in_(push_status_filter),
                or_(
                    models.AdminNotification.next_retry_at == None,
                    models.AdminNotification.next_retry_at <= now,
                ),
                models.AdminNotification.retry_count <= models.AdminNotification.max_retries,
                or_(
                    models.AdminNotification.claimed_at == None,
                    models.AdminNotification.claimed_at < timeout_threshold,
                ),
            )
            .all()
        )

        for candidate in pending_candidates:
            # Atomic predicate strictly enforcing status, configured credentials, backoff, retry bounds and claim lease
            status_sql = "push_status IN ('pending', 'partial_failure', 'pending_credentials')" if is_configured else "push_status IN ('pending', 'partial_failure')"
            claim_result = db.execute(
                text(
                    f"UPDATE admin_notifications "
                    f"SET claimed_at = :now, claimed_by = :worker_id, "
                    f"push_status = 'processing', updated_at = :now "
                    f"WHERE id = :id AND status = 'published' "
                    f"AND {status_sql} "
                    f"AND (next_retry_at IS NULL OR next_retry_at <= :now) "
                    f"AND retry_count <= max_retries "
                    f"AND (claimed_at IS NULL OR claimed_at < :thresh)"
                ),
                {
                    "now": now,
                    "worker_id": worker_id,
                    "id": candidate.id,
                    "thresh": timeout_threshold,
                },
            )
            db.commit()
            if claim_result.rowcount == 1:
                _process_single_notification(db, candidate.id, worker_id)
                processed += 1

    except Exception as exc:
        logger.error("Error in push worker iteration: %s", exc, exc_info=True)
    finally:
        db.close()

    return processed


async def _run_worker_loop() -> None:
    """Async background worker loop running inside FastAPI process."""
    worker_id = f"worker-{uuid.uuid4().hex[:8]}"
    logger.info("Starting HuaPlay Push Worker (%s)", worker_id)

    while not _stop_event.is_set():
        try:
            await asyncio.to_thread(process_pending_pushes_sync, worker_id)
        except Exception as exc:
            logger.error("Worker error: %s", exc)

        try:
            await asyncio.wait_for(_stop_event.wait(), timeout=WORKER_POLL_INTERVAL_SECONDS)
        except asyncio.TimeoutError:
            pass

    logger.info("HuaPlay Push Worker (%s) stopped cleanly", worker_id)


def start_push_worker() -> None:
    global _worker_task
    if _worker_task is None or _worker_task.done():
        _stop_event.clear()
        _worker_task = asyncio.create_task(_run_worker_loop())


async def stop_push_worker() -> None:
    global _worker_task
    _stop_event.set()
    if _worker_task and not _worker_task.done():
        try:
            await asyncio.wait_for(_worker_task, timeout=5)
        except asyncio.TimeoutError:
            _worker_task.cancel()
        _worker_task = None
