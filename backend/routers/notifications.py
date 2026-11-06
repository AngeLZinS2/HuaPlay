"""Public and client-facing notification endpoints for HuaPlay.

Enforces:
- Authenticated and owner-filtered unsubscribe.
- Safe token collision handling across accounts.
- Strict route sanitization for action URLs.
- Privacy-safe in-app feed excluding admin/worker metadata.
"""

from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import List, Literal, Optional
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import or_
from sqlalchemy.orm import Session

import models
from auth import FirebaseUser, get_current_user
from database import get_db

router = APIRouter(prefix="/notifications", tags=["notifications"])

TRUSTED_ORIGINS = {
    "https://huaplay.playdb.info",
    "https://huaplay.app",
    "http://localhost:5173",
    "http://localhost:8000",
}


def sanitize_route(url_or_path: Optional[str]) -> Optional[str]:
    """Validate and sanitize URL to prevent open redirects and protocol bypass."""
    if not url_or_path or not isinstance(url_or_path, str):
        return None

    trimmed = url_or_path.strip()
    if not trimmed:
        return None

    # Reject control chars or backslash protocol bypass (e.g. /\evil.com)
    if re.search(r"[\r\n\t\x00-\x1f\x7f]", trimmed) or "\\" in trimmed:
        return None

    lower = trimmed.lower()
    if lower.startswith(("javascript:", "data:", "vbscript:", "file:")):
        return None

    if lower.startswith("huaplay://"):
        after = trimmed[len("huaplay://") :]
        path = after if after.startswith("/") else f"/{after}"
        return sanitize_route(path)

    if trimmed.startswith("/"):
        if trimmed.startswith("//"):
            return None
        return trimmed

    try:
        parsed = urlparse(trimmed)
        origin = f"{parsed.scheme}://{parsed.netloc}".rstrip("/")
        if origin in TRUSTED_ORIGINS:
            path = parsed.path or "/"
            if parsed.query:
                path += f"?{parsed.query}"
            if parsed.fragment:
                path += f"#{parsed.fragment}"
            return path
    except Exception:
        pass

    return None


class NotificationFeedItem(BaseModel):
    id: int
    title: str
    message: str
    image_url: Optional[str] = None
    action_url: Optional[str] = None
    created_at: datetime
    sent_at: Optional[datetime] = None


class PushSubscribeIn(BaseModel):
    token: str = Field(..., min_length=10, max_length=500)
    platform: Literal["web", "android"] = "web"


class PushUnsubscribeIn(BaseModel):
    token: str = Field(..., min_length=10, max_length=500)


@router.get("/feed", response_model=List[NotificationFeedItem])
def get_notification_feed(
    platform: str = Query("web", pattern="^(web|android|all)$"),
    limit: int = Query(30, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """Retrieve public in-app feed. Excludes drafts, cancelled, future notices, and worker metadata."""
    now = datetime.now(timezone.utc)

    query = db.query(models.AdminNotification).filter(
        models.AdminNotification.status.in_(["published", "sent"]),
        models.AdminNotification.status != "draft",
        models.AdminNotification.status != "cancelled",
        or_(
            models.AdminNotification.scheduled_at == None,
            models.AdminNotification.scheduled_at <= now,
        ),
    )

    if platform != "all":
        query = query.filter(models.AdminNotification.audience.in_(["all", platform]))

    items = query.order_by(
        models.AdminNotification.sent_at.desc(),
        models.AdminNotification.id.desc(),
    ).limit(limit).all()

    return [
        NotificationFeedItem(
            id=item.id,
            title=item.title,
            message=item.message,
            image_url=item.image_url,
            action_url=sanitize_route(item.action_url),
            created_at=item.created_at,
            sent_at=item.sent_at,
        )
        for item in items
    ]


@router.post("/subscribe", status_code=status.HTTP_200_OK)
def subscribe_device_token(
    data: PushSubscribeIn,
    current_user: FirebaseUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Register device token. Returns 409 if active token belongs to a different UID (inactive may transfer)."""
    now = datetime.now(timezone.utc)
    token_str = data.token.strip()

    record = db.query(models.PushDeviceToken).filter_by(token=token_str).first()
    if record:
        if record.is_active and record.user_id != current_user.uid:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Token ativo pertence a outro usuário. Realize logout para transferir.",
            )
        # Inactive token may transfer ownership cleanly
        record.user_id = current_user.uid
        record.platform = data.platform
        record.is_active = True
        record.last_seen_at = now
        record.updated_at = now
    else:
        record = models.PushDeviceToken(
            user_id=current_user.uid,
            token=token_str,
            platform=data.platform,
            is_active=True,
            last_seen_at=now,
        )
        db.add(record)

    db.commit()
    return {"success": True, "registered": True}


@router.post("/unsubscribe", status_code=status.HTTP_200_OK)
def unsubscribe_device_token(
    data: PushUnsubscribeIn,
    current_user: FirebaseUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Deactivate token. Requires authentication and owner validation."""
    token_str = data.token.strip()
    record = db.query(models.PushDeviceToken).filter_by(token=token_str).first()

    if record:
        if record.user_id != current_user.uid and not current_user.is_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Token pertence a outro usuário",
            )
        record.is_active = False
        record.last_seen_at = datetime.now(timezone.utc)
        record.updated_at = datetime.now(timezone.utc)
        db.commit()

    return {"success": True, "unsubscribed": True}
