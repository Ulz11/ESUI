"""Self / preferences / usage."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import current_user
from app.core.config import settings
from app.core.db import get_session
from app.models import AICall, User
from app.orchestrator.cost_cap import get_today_cost

router = APIRouter(prefix="/me", tags=["me"])


class UserOut(BaseModel):
    id: str
    email: str
    display_name: str
    role: str
    avatar_url: str | None = None
    timezone: str = "UTC"
    default_mode: str = "ulzii"


class PatchMe(BaseModel):
    display_name: str | None = None
    avatar_url: str | None = None
    timezone: str | None = None
    default_mode: str | None = None


class UsageOut(BaseModel):
    today_usd: float
    daily_cap_usd: float
    by_task: list[dict[str, Any]]
    range_days: int


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


@router.get("", response_model=UserOut)
async def get_me(user: User = Depends(current_user)) -> UserOut:
    return _user_out(user)


@router.patch("", response_model=UserOut)
async def patch_me(
    body: PatchMe,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> UserOut:
    if body.display_name is not None:
        user.display_name = body.display_name
    if body.avatar_url is not None:
        user.avatar_url = body.avatar_url
    if body.timezone is not None:
        user.timezone = body.timezone
    if body.default_mode in ("ulzii", "obama"):
        user.default_mode = body.default_mode
    session.add(user)
    await session.commit()
    return _user_out(user)


@router.get("/usage", response_model=UsageOut)
async def get_usage(
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
    range_days: int = 30,
) -> UsageOut:
    today_usd = await get_today_cost(user.id)

    since = datetime.now(tz=timezone.utc) - timedelta(days=range_days)
    rows = (await session.execute(
        select(
            AICall.task,
            func.count(AICall.id).label("n"),
            func.coalesce(func.sum(AICall.tokens_in), 0).label("ti"),
            func.coalesce(func.sum(AICall.tokens_out), 0).label("to"),
            func.coalesce(func.sum(AICall.cost_cents), 0).label("c"),
        )
        .where(
            AICall.user_id == user.id,
            AICall.created_at > since,
        )
        .group_by(AICall.task)
    )).all()

    by_task = [
        {
            "task": r.task,
            "calls": int(r.n),
            "tokens_in": int(r.ti or 0),
            "tokens_out": int(r.to or 0),
            "cost_usd": float(r.c or 0) / 100.0,
        }
        for r in rows
    ]

    return UsageOut(
        today_usd=round(today_usd, 4),
        daily_cap_usd=settings.daily_cost_cap_usd,
        by_task=by_task,
        range_days=range_days,
    )
