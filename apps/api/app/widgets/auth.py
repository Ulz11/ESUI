"""Auth endpoints: magic-link issuance + verification.

Allowlist enforced server-side: only ESUI_EMAIL and BADRUSHK_EMAIL can sign in.
Unauthorized emails get a 204 silently (don't leak which addresses exist).
"""

from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import (
    create_access_token,
    current_user,
    find_user_by_email,
    hash_token,
    is_allowlisted,
    magic_link_expiry,
    new_random_token,
)
from app.core.db import get_session
from app.core.errors import bad_request, too_many
from app.core.log import log
from app.core.redis import get_redis
from app.integrations.resend import send_magic_link
from app.models import MagicLink, User

router = APIRouter(prefix="/auth", tags=["auth"])


class MagicLinkRequest(BaseModel):
    email: EmailStr


class VerifyRequest(BaseModel):
    email: EmailStr
    token: str


class UserOut(BaseModel):
    id: str
    email: str
    display_name: str
    role: str
    avatar_url: str | None = None
    timezone: str = "UTC"
    default_mode: str = "ulzii"


class VerifyResponse(BaseModel):
    access_token: str
    expires_at: datetime
    user: UserOut


def _user_out(u: User) -> UserOut:
    return UserOut(
        id=str(u.id),
        email=u.email,
        display_name=u.display_name,
        role=u.role,
        avatar_url=u.avatar_url,
        timezone=u.timezone,
        default_mode=u.default_mode,
    )


@router.post("/magic-link", status_code=status.HTTP_204_NO_CONTENT)
async def request_magic_link(
    body: MagicLinkRequest,
    session: AsyncSession = Depends(get_session),
) -> None:
    email = body.email.strip().lower()

    # Rate limit (5/hour per email)
    redis = get_redis()
    rl_key = f"ratelimit:magic_link:{email}"
    count = await redis.incr(rl_key)
    if count == 1:
        await redis.expire(rl_key, 3600)
    if count > 5:
        raise too_many("too many requests; try later")

    if not is_allowlisted(email):
        # Silent 204 — don't leak allowlist
        log.info("auth.magic_link.not_allowlisted", email=email)
        return

    # Generate + persist + email
    raw_token = new_random_token()
    session.add(MagicLink(
        email=email,
        token_hash=hash_token(raw_token),
        expires_at=magic_link_expiry(),
    ))
    await session.commit()

    await send_magic_link(email=email, token=raw_token)


@router.post("/verify", response_model=VerifyResponse)
async def verify_magic_link(
    body: VerifyRequest,
    session: AsyncSession = Depends(get_session),
) -> VerifyResponse:
    email = body.email.strip().lower()
    if not is_allowlisted(email):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "invalid token")

    th = hash_token(body.token)
    row = await session.execute(
        select(MagicLink)
        .where(
            MagicLink.email == email,
            MagicLink.token_hash == th,
            MagicLink.consumed_at.is_(None),
        )
        .order_by(MagicLink.created_at.desc())
        .limit(1)
    )
    link = row.scalar_one_or_none()
    if link is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "invalid token")
    now = datetime.now(tz=UTC)
    if link.expires_at.replace(tzinfo=link.expires_at.tzinfo or UTC) < now:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "token expired")

    link.consumed_at = now

    user = await find_user_by_email(session, email)
    if user is None:
        # Allowlisted but never seeded — refuse rather than auto-create.
        raise bad_request("user record missing; ask admin to seed")

    token, expires_at = create_access_token(user.id)
    await session.commit()

    return VerifyResponse(
        access_token=token, expires_at=expires_at, user=_user_out(user)
    )


@router.get("/me", response_model=UserOut)
async def me(user: User = Depends(current_user)) -> UserOut:
    return _user_out(user)
