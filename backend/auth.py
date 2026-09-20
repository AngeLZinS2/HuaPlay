"""Authentication against Firebase.

Identity is owned by Firebase Authentication; this module only verifies the ID
token the client sends and decides whether that identity is an administrator.

Token verification uses Google's published public certificates, so it needs no
service-account key — only the project id, to check the token's audience.
"""

import os
from dataclasses import dataclass
from typing import Optional, Set

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token

FIREBASE_PROJECT_ID = os.getenv("FIREBASE_PROJECT_ID", "gtavi-6991d")

# Administrators, by email. Kept server-side so the client cannot grant itself
# access by editing anything it holds. Override with a comma-separated env var.
_DEFAULT_ADMIN_EMAILS = "angelo.neri2020@gmail.com"


def admin_emails() -> Set[str]:
    raw = os.getenv("HUAPLAY_ADMIN_EMAILS", _DEFAULT_ADMIN_EMAILS)
    return {e.strip().lower() for e in raw.split(",") if e.strip()}


def admin_uids() -> Set[str]:
    """Firebase uids granted admin, comma separated.

    Steadier than the email list: a uid never changes, while an account's email
    can. Empty by default because a uid only exists after the first sign-in.
    """
    raw = os.getenv("HUAPLAY_ADMIN_UIDS", "")
    return {u.strip() for u in raw.split(",") if u.strip()}


@dataclass
class FirebaseUser:
    uid: str
    email: Optional[str]
    name: Optional[str]
    email_verified: bool
    is_admin: bool


bearer_scheme = HTTPBearer(auto_error=False)

_request_adapter = google_requests.Request()


def _credentials_exception(detail: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
) -> FirebaseUser:
    """Resolve the caller from their Firebase ID token."""
    if credentials is None or not credentials.credentials:
        raise _credentials_exception("Missing bearer token")

    try:
        claims = google_id_token.verify_firebase_token(
            credentials.credentials,
            _request_adapter,
            audience=FIREBASE_PROJECT_ID,
            # The library defaults to zero tolerance, which rejects tokens over a
            # few seconds of ordinary clock drift between this host and Google.
            # 60s is the usual allowance for JWT validation.
            clock_skew_in_seconds=60,
        )
    except ValueError as exc:
        # Covers malformed tokens, bad signatures, wrong audience and expiry.
        raise _credentials_exception(f"Invalid Firebase ID token: {exc}") from exc

    if not claims:
        raise _credentials_exception("Invalid Firebase ID token")

    uid = claims.get("user_id") or claims.get("sub")
    if not uid:
        raise _credentials_exception("Token carries no subject")

    email = claims.get("email")
    # A custom claim wins when present; the allowlist is the fallback that works
    # without provisioning a service-account key to set claims.
    is_admin = (
        claims.get("admin") is True
        or uid in admin_uids()
        or (bool(email) and email.lower() in admin_emails())
    )

    return FirebaseUser(
        uid=uid,
        email=email,
        name=claims.get("name"),
        email_verified=bool(claims.get("email_verified")),
        is_admin=is_admin,
    )


def get_current_admin(current_user: FirebaseUser = Depends(get_current_user)) -> FirebaseUser:
    """Require an administrator.

    Applied at router level (see main.py) rather than per-route, so a new write
    endpoint is protected by default instead of relying on the author to add it.
    """
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required",
        )
    return current_user
