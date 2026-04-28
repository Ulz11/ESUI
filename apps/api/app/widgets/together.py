"""Together Photos endpoints — prompt + accept + photos gallery + eligibility."""

from __future__ import annotations

import asyncio
import random
from datetime import datetime
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import current_user
from app.core.db import get_session
from app.core.errors import bad_request, not_found
from app.jobs.composite import compose_together_photo
from app.models import File, TogetherPhoto, TogetherPrompt, User

router = APIRouter(prefix="/together", tags=["together"])


WARM_MESSAGES = [
    "saved for later — he's thinking of you",
    "maybe tonight — the moment will wait",
    "no rush. the gallery will still be here.",
    "another time — today is yours",
]


# ---------- schemas ----------


class PromptOut(BaseModel):
    id: str
    shown_at: datetime
    outcome: str


class AcceptRequest(BaseModel):
    esui_photo_file_id: str
    scene_hint: str | None = None


class PhotoOut(BaseModel):
    id: str
    status: str
    scene_prompt: str
    composite_file_id: str | None
    created_at: datetime
    ready_at: datetime | None
    error: str | None


class WarmMessageOut(BaseModel):
    message: str


def _photo_out(p: TogetherPhoto) -> PhotoOut:
    return PhotoOut(
        id=str(p.id),
        status=p.status,
        scene_prompt=p.scene_prompt,
        composite_file_id=str(p.composite_file_id) if p.composite_file_id else None,
        created_at=p.created_at,
        ready_at=p.ready_at,
        error=p.error,
    )


async def _other_user_id(session: AsyncSession, user: User) -> UUID | None:
    other = await session.execute(
        select(User.id).where(User.id != user.id).limit(1)
    )
    return other.scalar_one_or_none()


# ---------- prompts ----------


@router.get("/prompts/current", response_model=PromptOut | None)
async def current_prompt(
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> PromptOut | None:
    if user.role != "esui":
        return None
    row = await session.execute(
        select(TogetherPrompt)
        .where(
            TogetherPrompt.shown_to_user == user.id,
            TogetherPrompt.outcome == "pending",
        )
        .order_by(desc(TogetherPrompt.shown_at))
        .limit(1)
    )
    p = row.scalar_one_or_none()
    if p is None:
        return None
    return PromptOut(id=str(p.id), shown_at=p.shown_at, outcome=p.outcome)


@router.post("/prompts/{prompt_id}/skip", response_model=WarmMessageOut)
async def skip_prompt(
    prompt_id: UUID,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> WarmMessageOut:
    p = await session.get(TogetherPrompt, prompt_id)
    if p is None or p.shown_to_user != user.id:
        raise not_found("prompt")
    msg = random.choice(WARM_MESSAGES)
    p.outcome = "skipped"
    p.outcome_at = datetime.now()
    p.message_variant = msg
    await session.commit()
    return WarmMessageOut(message=msg)


@router.post("/prompts/{prompt_id}/accept", response_model=PhotoOut, status_code=202)
async def accept_prompt(
    prompt_id: UUID,
    body: AcceptRequest,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> PhotoOut:
    p = await session.get(TogetherPrompt, prompt_id)
    if p is None or p.shown_to_user != user.id:
        raise not_found("prompt")

    esui_file_id = UUID(body.esui_photo_file_id)
    f = await session.get(File, esui_file_id)
    if f is None or f.owner_id != user.id or f.kind != "image":
        raise bad_request("invalid esui photo file_id")

    partner_id = await _other_user_id(session, user)
    if partner_id is None:
        raise bad_request("partner user missing")

    # Create the photo row in 'queued' state. The composite worker fills in
    # the badrushk file and progresses status.
    photo = TogetherPhoto(
        prompt_id=prompt_id,
        esui_photo_file_id=esui_file_id,
        badrushk_photo_file_id=esui_file_id,  # placeholder, worker overwrites
        scene_prompt=body.scene_hint or "",
        status="queued",
    )
    session.add(photo)

    p.outcome = "accepted"
    p.outcome_at = datetime.now()
    await session.commit()

    asyncio.create_task(compose_together_photo(
        photo_id=photo.id, esui_id=user.id, badrushk_id=partner_id,
    ))
    return _photo_out(photo)


# ---------- gallery ----------


@router.get("/photos", response_model=list[PhotoOut])
async def list_photos(
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
    limit: int = 50,
) -> list[PhotoOut]:
    rows = await session.execute(
        select(TogetherPhoto)
        .order_by(desc(TogetherPhoto.created_at))
        .limit(min(limit, 200))
    )
    return [_photo_out(p) for p in rows.scalars().all()]


@router.get("/photos/{photo_id}", response_model=PhotoOut)
async def get_photo(
    photo_id: UUID,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> PhotoOut:
    p = await session.get(TogetherPhoto, photo_id)
    if p is None:
        raise not_found("photo")
    return _photo_out(p)


# ---------- eligibility (Badrushk marks his photos) ----------


@router.get("/eligible", response_model=list[dict[str, Any]])
async def list_eligible(
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> list[dict[str, Any]]:
    rows = await session.execute(
        select(File).where(
            File.owner_id == user.id, File.kind == "image"
        ).order_by(desc(File.created_at))
    )
    return [
        {
            "id": str(f.id),
            "filename": f.filename,
            "together_eligible": f.together_eligible,
        }
        for f in rows.scalars().all()
    ]


@router.post("/eligible/{file_id}", status_code=204)
async def set_eligible(
    file_id: UUID,
    body: dict[str, bool],
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> None:
    f = await session.get(File, file_id)
    if f is None or f.owner_id != user.id:
        raise not_found("file")
    f.together_eligible = bool(body.get("eligible", False))
    await session.commit()
