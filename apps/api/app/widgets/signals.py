"""Signals — Esui's curated quote feed.

She drops in quotes from her reading. Four categories, locked:

  - mathematics            Mathematics for Human Flourishing — Francis Su
  - arabic_philosophy      Arabic / Arabian philosophy
  - chinese_philosophy     Chinese philosophy
  - elements_of_ai         Elements of AI course (elementsofai.com)

Each quote persists. She can delete any quote. She can pin a quote into the
Vault if she wants it surfaced in chat retrieval.
"""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import require_esui
from app.core.db import get_session
from app.core.errors import bad_request, not_found
from app.models import Signal, SignalPin, User, VaultDocument

router = APIRouter(prefix="/signals", tags=["signals"])


VALID_CATEGORIES = {
    "mathematics",
    "arabic_philosophy",
    "chinese_philosophy",
    "elements_of_ai",
}


# ---------- schemas ----------


class QuoteOut(BaseModel):
    id: str
    category: str
    title: str
    body: str
    source_url: str | None
    source_name: str | None
    created_at: datetime


class QuoteCreate(BaseModel):
    category: str
    body: str = Field(..., min_length=1)
    title: str | None = None
    source_url: str | None = None
    source_name: str | None = None


class QuotePatch(BaseModel):
    title: str | None = None
    body: str | None = None
    source_url: str | None = None
    source_name: str | None = None
    category: str | None = None


def _q_out(s: Signal) -> QuoteOut:
    return QuoteOut(
        id=str(s.id),
        category=s.category,
        title=s.title,
        body=s.body,
        source_url=s.source_url,
        source_name=s.source_name,
        created_at=s.fetched_at,
    )


def _derive_title(body: str, max_len: int = 80) -> str:
    """First sentence (or first 80 chars) of the quote, used when title omitted."""
    text = body.strip().replace("\n", " ")
    for sep in (". ", "? ", "! "):
        if sep in text[:max_len + 20]:
            head = text.split(sep, 1)[0]
            return (head + sep.rstrip()).strip()[:max_len]
    return text[:max_len].rstrip()


def _default_source_for(category: str) -> str | None:
    return {
        "mathematics": "Francis Su · Mathematics for Human Flourishing",
        "arabic_philosophy": "Arabic philosophy",
        "chinese_philosophy": "Chinese philosophy",
        "elements_of_ai": "Elements of AI · elementsofai.com",
    }.get(category)


# ---------- endpoints ----------


@router.get("", response_model=list[QuoteOut])
async def list_quotes(
    user: User = Depends(require_esui),
    session: AsyncSession = Depends(get_session),
    category: str | None = None,
    limit: int = 200,
) -> list[QuoteOut]:
    q = select(Signal)
    if category:
        if category not in VALID_CATEGORIES:
            raise bad_request(f"unknown category: {category}")
        q = q.where(Signal.category == category)
    q = q.order_by(desc(Signal.fetched_at)).limit(min(limit, 500))
    rows = await session.execute(q)
    return [_q_out(s) for s in rows.scalars().all()]


@router.post("", response_model=QuoteOut, status_code=201)
async def add_quote(
    body: QuoteCreate,
    user: User = Depends(require_esui),
    session: AsyncSession = Depends(get_session),
) -> QuoteOut:
    if body.category not in VALID_CATEGORIES:
        raise bad_request(
            "category must be one of: "
            + ", ".join(sorted(VALID_CATEGORIES))
        )

    title = (body.title or "").strip() or _derive_title(body.body)
    sig = Signal(
        category=body.category,
        title=title[:200],
        body=body.body.strip(),
        source_url=(body.source_url or None),
        source_name=(body.source_name or _default_source_for(body.category)),
        # expires_at + cycle_id intentionally NULL — quotes don't expire / don't cycle.
        provider="manual",
    )
    session.add(sig)
    await session.commit()
    return _q_out(sig)


@router.get("/{signal_id}", response_model=QuoteOut)
async def get_quote(
    signal_id: UUID,
    user: User = Depends(require_esui),
    session: AsyncSession = Depends(get_session),
) -> QuoteOut:
    s = await session.get(Signal, signal_id)
    if s is None:
        raise not_found("quote")
    return _q_out(s)


@router.patch("/{signal_id}", response_model=QuoteOut)
async def update_quote(
    signal_id: UUID,
    body: QuotePatch,
    user: User = Depends(require_esui),
    session: AsyncSession = Depends(get_session),
) -> QuoteOut:
    s = await session.get(Signal, signal_id)
    if s is None:
        raise not_found("quote")
    if body.title is not None:
        s.title = body.title.strip()[:200] or _derive_title(s.body)
    if body.body is not None:
        s.body = body.body.strip()
    if body.source_url is not None:
        s.source_url = body.source_url or None
    if body.source_name is not None:
        s.source_name = body.source_name or None
    if body.category is not None:
        if body.category not in VALID_CATEGORIES:
            raise bad_request(f"unknown category: {body.category}")
        s.category = body.category
    await session.commit()
    return _q_out(s)


@router.delete("/{signal_id}", status_code=204)
async def delete_quote(
    signal_id: UUID,
    user: User = Depends(require_esui),
    session: AsyncSession = Depends(get_session),
) -> None:
    s = await session.get(Signal, signal_id)
    if s is None:
        raise not_found("quote")
    await session.delete(s)
    await session.commit()


# ---------- pin to vault ----------


@router.post("/{signal_id}/pin", response_model=dict[str, str])
async def pin_to_vault(
    signal_id: UUID,
    user: User = Depends(require_esui),
    session: AsyncSession = Depends(get_session),
) -> dict[str, str]:
    """Save the quote as a Vault document so it shows up in chat retrieval."""
    s = await session.get(Signal, signal_id)
    if s is None:
        raise not_found("quote")

    existing = (await session.execute(
        select(SignalPin).where(
            SignalPin.signal_id == signal_id, SignalPin.user_id == user.id
        )
    )).scalar_one_or_none()
    if existing is not None:
        return {"vault_document_id": str(existing.vault_document_id)}

    body_md = s.body
    if s.source_name:
        body_md += f"\n\n— {s.source_name}"
    if s.source_url:
        body_md += f" · [{s.source_url}]({s.source_url})"

    doc = VaultDocument(
        owner_id=user.id,
        title=s.title,
        content_md=body_md,
        content_type="reference",
    )
    session.add(doc)
    await session.flush()
    session.add(SignalPin(
        signal_id=signal_id, user_id=user.id, vault_document_id=doc.id,
    ))
    await session.commit()
    return {"vault_document_id": str(doc.id)}
