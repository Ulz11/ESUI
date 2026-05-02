"""Auth: magic-link issuance, JWT sessions, FastAPI deps.

Flow:
  1. POST /auth/magic-link  → server emails a single-use token (15 min TTL)
                              if email is in the allowlist
  2. POST /auth/verify      → exchange token for an access JWT (30 day rolling)
  3. Bearer JWT on every other request → `current_user` dependency

Only emails listed in settings.esui_email and settings.badrushk_email may sign in.
"""

from __future__ import annotations

import hashlib
import secrets
from datetime import UTC, datetime, timedelta
from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.db import get_session
from app.models import User

ALGORITHM = "HS256"
ACCESS_TOKEN_TTL = timedelta(days=30)
MAGIC_LINK_TTL = timedelta(minutes=15)
MAGIC_LINK_RATE_LIMIT = 5  # per hour per email

bearer = HTTPBearer(auto_error=False)


# ---------- token helpers ----------


def _now() -> datetime:
    return datetime.now(tz=UTC)


def hash_token(token: str) -> bytes:
    """sha256 of a raw token string. Stored at rest; never log raw tokens."""
    return hashlib.sha256(token.encode("utf-8")).digest()


def new_random_token(nbytes: int = 32) -> str:
    return secrets.token_urlsafe(nbytes)


def create_access_token(user_id: UUID) -> tuple[str, datetime]:
    expires_at = _now() + ACCESS_TOKEN_TTL
    payload = {
        "sub": str(user_id),
        "iat": int(_now().timestamp()),
        "exp": int(expires_at.timestamp()),
    }
    token = jwt.encode(payload, settings.secret_key, algorithm=ALGORITHM)
    return token, expires_at


def decode_access_token(token: str) -> UUID:
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])
        return UUID(payload["sub"])
    except (JWTError, KeyError, ValueError) as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="invalid token",
        ) from e


# ---------- allowlist ----------


def is_allowlisted(email: str) -> bool:
    return email.strip().lower() in settings.allowlisted_emails


# ---------- FastAPI dependency ----------


async def current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer),
    session: AsyncSession = Depends(get_session),
) -> User:
    if creds is None or not creds.credentials:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "missing token")
    user_id = decode_access_token(creds.credentials)
    user = await session.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "user not found")
    return user


async def require_esui(user: User = Depends(current_user)) -> User:
    """ESUI is single-tenant. Most surfaces are private to Esui herself.

    Badrushk has a read-only window into the Beauty gallery (her dropped
    photos). Everything else — chat, vault, calendar, exam, signals,
    memory — is hers.
    """
    if user.role != "esui":
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "this surface is private to Esui",
        )
    return user


async def find_user_by_email(session: AsyncSession, email: str) -> User | None:
    result = await session.execute(
        select(User).where(User.email == email.strip().lower())
    )
    return result.scalar_one_or_none()


# ---------- magic link helpers ----------


def magic_link_expiry() -> datetime:
    return _now() + MAGIC_LINK_TTL
