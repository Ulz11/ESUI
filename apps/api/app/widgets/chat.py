"""Chat REST endpoints — conversations + messages list/create.

Sending a message via REST also kicks off the AI streaming turn (delivered
over Socket.io). Clients that prefer the Socket.io `message:send` event
bypass this REST path entirely.
"""

from __future__ import annotations

import asyncio
from datetime import datetime
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import current_user, require_esui
from app.core.db import get_session
from app.core.errors import not_found
from app.models import Conversation, ConversationParticipant, Message, User
from app.orchestrator.streaming import run_chat_turn

router = APIRouter(prefix="/conversations", tags=["chat"])


# ---------- schemas ----------


class ConversationOut(BaseModel):
    id: str
    title: str | None
    pinned_context: str | None
    created_by: str
    created_at: datetime
    updated_at: datetime
    archived_at: datetime | None = None


class ConversationCreate(BaseModel):
    title: str | None = None
    pinned_context: str | None = None
    invite_partner: bool = True


class ConversationPatch(BaseModel):
    title: str | None = None
    pinned_context: str | None = None
    archived: bool | None = None


class MessageOut(BaseModel):
    id: str
    conversation_id: str
    parent_message_id: str | None
    sender_type: str
    sender_user_id: str | None
    mode: str | None
    model_id: str | None
    content_blocks: list[dict[str, Any]]
    status: str
    error: str | None
    created_at: datetime


class MessageSend(BaseModel):
    content_blocks: list[dict[str, Any]]
    mode: str = "ulzii"
    parent_message_id: str | None = None
    attached_file_ids: list[str] = []
    model_hint: str | None = None


def _conv_out(c: Conversation) -> ConversationOut:
    return ConversationOut(
        id=str(c.id),
        title=c.title,
        pinned_context=c.pinned_context,
        created_by=str(c.created_by),
        created_at=c.created_at,
        updated_at=c.updated_at,
        archived_at=c.archived_at,
    )


def _msg_out(m: Message) -> MessageOut:
    return MessageOut(
        id=str(m.id),
        conversation_id=str(m.conversation_id),
        parent_message_id=str(m.parent_message_id) if m.parent_message_id else None,
        sender_type=m.sender_type,
        sender_user_id=str(m.sender_user_id) if m.sender_user_id else None,
        mode=m.mode,
        model_id=m.model_id,
        content_blocks=m.content_blocks,
        status=m.status,
        error=m.error,
        created_at=m.created_at,
    )


async def _ensure_participant(
    session: AsyncSession, conv_id: UUID, user_id: UUID
) -> Conversation:
    conv = await session.get(Conversation, conv_id)
    if conv is None:
        raise not_found("conversation")
    p = await session.execute(
        select(ConversationParticipant).where(
            ConversationParticipant.conversation_id == conv_id,
            ConversationParticipant.user_id == user_id,
        )
    )
    if p.scalar_one_or_none() is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "not a participant")
    return conv


# ---------- list / create ----------


@router.get("", response_model=list[ConversationOut])
async def list_conversations(
    user: User = Depends(require_esui),
    session: AsyncSession = Depends(get_session),
    archived: bool = False,
    limit: int = 50,
) -> list[ConversationOut]:
    rows = await session.execute(
        select(Conversation)
        .join(ConversationParticipant, ConversationParticipant.conversation_id == Conversation.id)
        .where(ConversationParticipant.user_id == user.id)
        .where(Conversation.archived_at.is_(None) if not archived else Conversation.archived_at.is_not(None))
        .order_by(desc(Conversation.updated_at))
        .limit(limit)
    )
    return [_conv_out(c) for c in rows.scalars().all()]


@router.post("", response_model=ConversationOut, status_code=201)
async def create_conversation(
    body: ConversationCreate,
    user: User = Depends(require_esui),
    session: AsyncSession = Depends(get_session),
) -> ConversationOut:
    conv = Conversation(
        title=body.title,
        pinned_context=body.pinned_context,
        created_by=user.id,
    )
    session.add(conv)
    await session.flush()
    session.add(ConversationParticipant(conversation_id=conv.id, user_id=user.id))

    if body.invite_partner:
        partner = await session.execute(
            select(User).where(User.id != user.id).limit(1)
        )
        p = partner.scalar_one_or_none()
        if p:
            session.add(ConversationParticipant(conversation_id=conv.id, user_id=p.id))

    await session.commit()
    return _conv_out(conv)


@router.get("/{conv_id}", response_model=ConversationOut)
async def get_conversation(
    conv_id: UUID,
    user: User = Depends(require_esui),
    session: AsyncSession = Depends(get_session),
) -> ConversationOut:
    conv = await _ensure_participant(session, conv_id, user.id)
    return _conv_out(conv)


@router.patch("/{conv_id}", response_model=ConversationOut)
async def update_conversation(
    conv_id: UUID,
    body: ConversationPatch,
    user: User = Depends(require_esui),
    session: AsyncSession = Depends(get_session),
) -> ConversationOut:
    conv = await _ensure_participant(session, conv_id, user.id)
    if body.title is not None:
        conv.title = body.title
    if body.pinned_context is not None:
        conv.pinned_context = body.pinned_context
    if body.archived is not None:
        conv.archived_at = func.now() if body.archived else None
    conv.updated_at = func.now()
    await session.commit()
    return _conv_out(conv)


@router.delete("/{conv_id}", status_code=204)
async def delete_conversation(
    conv_id: UUID,
    user: User = Depends(require_esui),
    session: AsyncSession = Depends(get_session),
) -> None:
    conv = await _ensure_participant(session, conv_id, user.id)
    await session.delete(conv)
    await session.commit()


# ---------- messages ----------


@router.get("/{conv_id}/messages", response_model=list[MessageOut])
async def list_messages(
    conv_id: UUID,
    user: User = Depends(require_esui),
    session: AsyncSession = Depends(get_session),
    before: datetime | None = None,
    limit: int = 50,
) -> list[MessageOut]:
    await _ensure_participant(session, conv_id, user.id)
    q = select(Message).where(Message.conversation_id == conv_id)
    if before:
        q = q.where(Message.created_at < before)
    q = q.order_by(desc(Message.created_at)).limit(min(limit, 200))
    rows = await session.execute(q)
    msgs = list(rows.scalars().all())
    msgs.reverse()
    return [_msg_out(m) for m in msgs]


class SearchRequest(BaseModel):
    query: str
    limit: int = 20


@router.post("/{conv_id}/search", response_model=list[MessageOut])
async def search_messages(
    conv_id: UUID,
    body: SearchRequest,
    user: User = Depends(require_esui),
    session: AsyncSession = Depends(get_session),
) -> list[MessageOut]:
    """Semantic search across messages in this conversation."""
    from sqlalchemy import text as _t

    from app.integrations.voyage import embed_one

    await _ensure_participant(session, conv_id, user.id)
    if not body.query.strip():
        return []
    qvec = await embed_one(body.query, input_type="query")
    rows = (await session.execute(_t("""
        SELECT m.id
        FROM message_embeddings me
        JOIN messages m ON m.id = me.message_id
        WHERE m.conversation_id = :conv_id
        ORDER BY me.embedding <=> CAST(:q AS vector)
        LIMIT :limit
    """), {
        "q": "[" + ",".join(f"{v:.6f}" for v in qvec) + "]",
        "conv_id": str(conv_id),
        "limit": body.limit,
    })).all()
    ids = [r.id for r in rows]
    if not ids:
        return []
    res = await session.execute(select(Message).where(Message.id.in_(ids)))
    by_id = {m.id: m for m in res.scalars().all()}
    return [_msg_out(by_id[i]) for i in ids if i in by_id]


@router.post("/{conv_id}/messages", response_model=MessageOut, status_code=202)
async def send_message(
    conv_id: UUID,
    body: MessageSend,
    user: User = Depends(require_esui),
    session: AsyncSession = Depends(get_session),
) -> MessageOut:
    """Persist user message; AI turn streams over Socket.io.

    Returns the persisted user message immediately. The AI turn is fired in
    a background task so the response stays snappy.
    """
    await _ensure_participant(session, conv_id, user.id)

    # The streaming runner persists the user message itself (atomic with the
    # AI turn). Here we just kick it off and return a placeholder.
    from app.realtime.server import sio  # local import to avoid cycle at module load

    async def _emit(event: str, payload: dict) -> None:
        await sio.emit(event, payload, room=f"conversation:{conv_id}")

    # Fire-and-forget; client should be subscribed to the room over WS.
    asyncio.create_task(run_chat_turn(
        user_id=user.id,
        conversation_id=conv_id,
        content_blocks=body.content_blocks,
        mode=body.mode,  # type: ignore[arg-type]
        parent_message_id=UUID(body.parent_message_id) if body.parent_message_id else None,
        attached_file_ids=[UUID(x) for x in body.attached_file_ids],
        model_hint=body.model_hint,  # type: ignore[arg-type]
        emit=_emit,
    ))

    # Return a synthetic placeholder; the real persisted message arrives over WS.
    return MessageOut(
        id="pending",
        conversation_id=str(conv_id),
        parent_message_id=body.parent_message_id,
        sender_type="user",
        sender_user_id=str(user.id),
        mode=None,
        model_id=None,
        content_blocks=body.content_blocks,
        status="streaming",
        error=None,
        created_at=datetime.now(),
    )
