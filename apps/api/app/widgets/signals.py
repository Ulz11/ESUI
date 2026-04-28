"""Signals — current cycle, pin to vault, share to chat, dismiss."""

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import current_user
from app.core.db import get_session
from app.core.errors import not_found
from app.models import (
    ConversationParticipant,
    Message,
    Signal,
    SignalEngagement,
    SignalPin,
    User,
    VaultDocument,
)

router = APIRouter(prefix="/signals", tags=["signals"])


# ---------- schemas ----------


class SignalOut(BaseModel):
    id: str
    category: str
    title: str
    body: str
    source_url: str | None
    source_name: str | None
    fetched_at: datetime
    expires_at: datetime


class CycleOut(BaseModel):
    cycle_id: str | None
    refreshed_at: datetime | None
    expires_at: datetime | None
    items: list[SignalOut]


class ShareToChatRequest(BaseModel):
    conversation_id: str


def _sig_out(s: Signal) -> SignalOut:
    return SignalOut(
        id=str(s.id),
        category=s.category,
        title=s.title,
        body=s.body,
        source_url=s.source_url,
        source_name=s.source_name,
        fetched_at=s.fetched_at,
        expires_at=s.expires_at,
    )


# ---------- current cycle ----------


@router.get("/current", response_model=CycleOut)
async def get_current_cycle(
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> CycleOut:
    # Latest cycle = highest fetched_at
    latest = (await session.execute(
        select(Signal.cycle_id, Signal.fetched_at, Signal.expires_at)
        .order_by(desc(Signal.fetched_at))
        .limit(1)
    )).first()
    if latest is None:
        return CycleOut(cycle_id=None, refreshed_at=None, expires_at=None, items=[])

    rows = (await session.execute(
        select(Signal)
        .where(Signal.cycle_id == latest.cycle_id)
    )).scalars().all()

    items = await _personalize_order(session, user.id, list(rows))

    return CycleOut(
        cycle_id=str(latest.cycle_id),
        refreshed_at=latest.fetched_at,
        expires_at=latest.expires_at,
        items=items,
    )


# ---------- per-user ranking ----------


async def _personalize_order(
    session: AsyncSession, user_id: UUID, signals: list[Signal]
) -> list[SignalOut]:
    """Group by category, then within each category order by personal score."""
    from sqlalchemy import text as _t

    pin_rows = (await session.execute(_t("""
        SELECT s.embedding
        FROM signal_engagements e
        JOIN signals s ON s.id = e.signal_id
        WHERE e.user_id = :uid
          AND e.action = 'pin'
          AND e.created_at > now() - interval '60 days'
          AND s.embedding IS NOT NULL
    """), {"uid": str(user_id)})).all()

    dismiss_rows = (await session.execute(_t("""
        SELECT s.embedding
        FROM signal_engagements e
        JOIN signals s ON s.id = e.signal_id
        WHERE e.user_id = :uid
          AND e.action = 'dismiss'
          AND e.created_at > now() - interval '30 days'
          AND s.embedding IS NOT NULL
    """), {"uid": str(user_id)})).all()

    interest_vec = _avg_vec([list(r[0]) for r in pin_rows])
    avoid_vec = _avg_vec([list(r[0]) for r in dismiss_rows])

    def _score(s: Signal) -> float:
        if s.embedding is None:
            return 0.0
        sv = list(s.embedding)
        score = 0.0
        if interest_vec:
            score += 0.7 * _cosine(sv, interest_vec)
        if avoid_vec:
            score -= 0.3 * _cosine(sv, avoid_vec)
        return score

    by_cat: dict[str, list[Signal]] = {}
    for s in signals:
        by_cat.setdefault(s.category, []).append(s)

    ordered: list[SignalOut] = []
    for cat in sorted(by_cat):
        in_cat = sorted(by_cat[cat], key=_score, reverse=True)
        ordered.extend(_sig_out(s) for s in in_cat)
    return ordered


def _avg_vec(vecs: list[list[float]]) -> list[float] | None:
    if not vecs:
        return None
    n = len(vecs)
    dim = len(vecs[0])
    out = [0.0] * dim
    for v in vecs:
        for i, x in enumerate(v):
            out[i] += x
    return [x / n for x in out]


def _cosine(a: list[float], b: list[float]) -> float:
    if not a or not b:
        return 0.0
    dot = sum(x * y for x, y in zip(a, b, strict=True))
    na = sum(x * x for x in a) ** 0.5
    nb = sum(x * x for x in b) ** 0.5
    if na == 0 or nb == 0:
        return 0.0
    return dot / (na * nb)


# ---------- engagement ----------


@router.post("/{signal_id}/open", status_code=204)
async def signal_open(
    signal_id: UUID,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> None:
    sig = await session.get(Signal, signal_id)
    if sig is None:
        raise not_found("signal")
    session.add(SignalEngagement(signal_id=signal_id, user_id=user.id, action="open"))
    await session.commit()


@router.post("/{signal_id}/dismiss", status_code=204)
async def signal_dismiss(
    signal_id: UUID,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> None:
    sig = await session.get(Signal, signal_id)
    if sig is None:
        raise not_found("signal")
    session.add(SignalEngagement(signal_id=signal_id, user_id=user.id, action="dismiss"))
    await session.commit()


@router.post("/{signal_id}/pin", response_model=dict[str, str])
async def signal_pin(
    signal_id: UUID,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> dict[str, str]:
    sig = await session.get(Signal, signal_id)
    if sig is None:
        raise not_found("signal")

    # Already pinned?
    existing = await session.execute(
        select(SignalPin).where(
            SignalPin.signal_id == signal_id, SignalPin.user_id == user.id
        )
    )
    pin = existing.scalar_one_or_none()
    if pin is not None:
        return {"vault_document_id": str(pin.vault_document_id)}

    # Create vault doc
    doc = VaultDocument(
        owner_id=user.id,
        title=sig.title,
        content_md=f"{sig.body}\n\n— [{sig.source_name or 'source'}]({sig.source_url or '#'})",
        content_type="reference",
    )
    session.add(doc)
    await session.flush()

    session.add(SignalPin(
        signal_id=signal_id, user_id=user.id, vault_document_id=doc.id,
    ))
    session.add(SignalEngagement(
        signal_id=signal_id, user_id=user.id, action="pin",
    ))
    await session.commit()
    return {"vault_document_id": str(doc.id)}


@router.post("/{signal_id}/share-to-chat", response_model=dict[str, str])
async def signal_share_to_chat(
    signal_id: UUID,
    body: ShareToChatRequest,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> dict[str, str]:
    sig = await session.get(Signal, signal_id)
    if sig is None:
        raise not_found("signal")
    conv_id = UUID(body.conversation_id)

    p = await session.execute(
        select(ConversationParticipant).where(
            ConversationParticipant.conversation_id == conv_id,
            ConversationParticipant.user_id == user.id,
        )
    )
    if p.scalar_one_or_none() is None:
        raise not_found("conversation")

    msg = Message(
        conversation_id=conv_id,
        sender_type="user",
        sender_user_id=user.id,
        content_blocks=[{"type": "signal_card", "signal_id": str(signal_id)}],
        status="complete",
    )
    session.add(msg)
    session.add(SignalEngagement(
        signal_id=signal_id, user_id=user.id, action="share_to_chat",
    ))
    await session.commit()
    return {"message_id": str(msg.id)}
