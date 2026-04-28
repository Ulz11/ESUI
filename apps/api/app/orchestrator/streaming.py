"""End-to-end chat turn: persist user msg, retrieve, stream from Anthropic,
emit Socket.io deltas, persist final AI msg, embed both async.
"""

from __future__ import annotations

import asyncio
import time
from collections.abc import Awaitable, Callable
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import SessionLocal
from app.core.log import log
from app.integrations.anthropic import stream_chat
from app.memory.engine import index_message
from app.memory.extract import fire_and_forget_extract
from app.models import (
    AICall,
    Conversation,
    ConversationParticipant,
    Message,
    MessageFile,
    User,
)
from app.orchestrator.auto_title import maybe_auto_title
from app.orchestrator.cost_cap import (
    add_cost,
    consume_notice,
    estimate_cost_usd,
    is_capped,
)
from app.orchestrator.effort import classify_effort
from app.orchestrator.modes import Mode, system_blocks
from app.orchestrator.retrieval import retrieve_for_chat
from app.orchestrator.router import select_model
from app.orchestrator.tools import CHAT_TOOLS, render_pin_suggestion

EmitFn = Callable[[str, dict[str, Any]], Awaitable[None]]


async def run_chat_turn(
    *,
    user_id: UUID,
    conversation_id: UUID,
    content_blocks: list[dict],
    mode: Mode,
    parent_message_id: UUID | None,
    attached_file_ids: list[UUID],
    model_hint: str | None,
    emit: EmitFn,
) -> None:
    """Persist user message → retrieve → stream AI → persist AI message.

    All Socket.io emits use the provided `emit` closure (room-scoped).
    """
    async with SessionLocal() as session:
        conv = await _load_conversation_or_403(session, conversation_id, user_id)
        partner_id = await _partner_id(session, conv, user_id)

        # 1) Persist user message
        user_text = _flatten_text(content_blocks)
        user_msg = Message(
            conversation_id=conversation_id,
            parent_message_id=parent_message_id,
            sender_type="user",
            sender_user_id=user_id,
            content_blocks=content_blocks,
            status="complete",
        )
        session.add(user_msg)
        await session.flush()

        for fid in attached_file_ids:
            session.add(MessageFile(message_id=user_msg.id, file_id=fid))

        await session.commit()
        await emit("message:created", _msg_dict(user_msg))

    # 2) Retrieval (own session for query isolation)
    async with SessionLocal() as session:
        retrieved = await retrieve_for_chat(
            session=session,
            query=user_text,
            user_id=user_id,
            partner_id=partner_id,
            conversation_id=conversation_id,
            mode=mode,
        )
        history = await _recent_history(session, conversation_id)
        pinned = (await session.get(Conversation, conversation_id)).pinned_context

    # 3) Build prompt + stream
    sys_blocks = system_blocks(mode, pinned_context=pinned, retrieved_block=retrieved)

    # Convert DB messages to Anthropic format
    anthropic_messages = _to_anthropic_messages(history) + [
        {"role": "user", "content": [{"type": "text", "text": user_text}]}
    ]

    # Effort classification → Opus for high-effort questions, else Sonnet.
    capped = await is_capped(user_id)
    if model_hint:
        model = select_model("chat", hint=model_hint)  # type: ignore[arg-type]
    elif capped:
        # Cap crossed today: stay on Sonnet to keep things smooth and cheap.
        model = "sonnet"
    else:
        effort = await classify_effort(user_text)
        model = "opus" if effort == "high" else "sonnet"

    if capped and await consume_notice(user_id):
        await emit("system:notice", {
            "kind": "cost_cap",
            "message": "Daily AI budget reached — staying on Sonnet for the rest of the day.",
            "dismissable": True,
        })

    # 4) Persist streaming placeholder
    async with SessionLocal() as session:
        ai_msg = Message(
            conversation_id=conversation_id,
            parent_message_id=user_msg.id,
            sender_type="ai",
            sender_user_id=None,
            mode=mode,
            model_id=f"claude-{model}",
            content_blocks=[{"type": "text", "text": ""}],
            status="streaming",
        )
        session.add(ai_msg)
        await session.commit()
        ai_msg_id = ai_msg.id

    await emit("message:ai:start", {
        "message_id": str(ai_msg_id), "mode": mode, "model_id": f"claude-{model}",
    })

    # 5) Stream
    started = time.perf_counter()
    accumulated: list[str] = []
    tokens_in = tokens_out = tokens_cached = 0

    extra_blocks: list[dict[str, Any]] = []
    try:
        async for chunk in stream_chat(
            model=model,
            system_blocks=sys_blocks,
            messages=anthropic_messages,
            tools=CHAT_TOOLS,
            max_tokens=4096 if model == "opus" else 2048,
            temperature=0.7,
            extended_thinking=(model == "opus"),
        ):
            if chunk.kind == "text" and chunk.text:
                accumulated.append(chunk.text)
                await emit("message:ai:delta", {
                    "message_id": str(ai_msg_id), "delta_text": chunk.text,
                })
            elif chunk.kind == "thinking" and chunk.text:
                await emit("message:ai:thinking", {
                    "message_id": str(ai_msg_id), "delta_text": chunk.text,
                })
            elif chunk.kind == "tool_use":
                args = chunk.tool_input or {}
                if chunk.tool_name == "pin_to_vault":
                    block = render_pin_suggestion(args)
                    extra_blocks.append(block)
                await emit("message:ai:tool_use", {
                    "message_id": str(ai_msg_id),
                    "tool": chunk.tool_name, "args": args,
                })
            elif chunk.kind == "complete":
                tokens_in = chunk.tokens_in or 0
                tokens_out = chunk.tokens_out or 0
                tokens_cached = chunk.tokens_cached or 0
    except Exception as exc:
        log.exception("chat.stream.error", error=str(exc))
        async with SessionLocal() as session:
            db_msg = await session.get(Message, ai_msg_id)
            if db_msg:
                db_msg.status = "error"
                db_msg.error = str(exc)[:500]
                await session.commit()
        await emit("message:ai:error", {
            "message_id": str(ai_msg_id), "error": str(exc), "retryable": True,
        })
        return

    final_text = "".join(accumulated)
    latency_ms = int((time.perf_counter() - started) * 1000)

    # 6) Persist final (text block + any tool-use suggestion blocks)
    final_blocks: list[dict[str, Any]] = [{"type": "text", "text": final_text}]
    final_blocks.extend(extra_blocks)
    cost_usd = estimate_cost_usd(model, tokens_in, tokens_out)

    async with SessionLocal() as session:
        db_msg = await session.get(Message, ai_msg_id)
        if db_msg:
            db_msg.content_blocks = final_blocks
            db_msg.status = "complete"
            db_msg.tokens_in = tokens_in
            db_msg.tokens_out = tokens_out
            db_msg.cost_cents = cost_usd * 100  # store as cents
            await session.commit()

        session.add(AICall(
            user_id=user_id,
            conversation_id=conversation_id,
            message_id=ai_msg_id,
            task="chat",
            mode=mode,
            provider="anthropic",
            model_id=f"claude-{model}",
            tokens_in=tokens_in,
            tokens_out=tokens_out,
            tokens_cached=tokens_cached,
            cost_cents=cost_usd * 100,
            latency_ms=latency_ms,
            cache_hit=tokens_cached > 0,
        ))
        await session.commit()

    await add_cost(user_id, cost_usd)

    await emit("message:ai:complete", {
        "message_id": str(ai_msg_id),
        "tokens_in": tokens_in,
        "tokens_out": tokens_out,
        "cache_hit": tokens_cached > 0,
    })

    # 7) Async post: embed messages + extract long-term memories + auto-title
    asyncio.create_task(_embed_messages(user_msg.id, user_text, ai_msg_id, final_text))
    fire_and_forget_extract(
        user_id=user_id,
        user_text=user_text,
        ai_text=final_text,
        conversation_id=conversation_id,
        source_message_id=ai_msg_id,
    )
    asyncio.create_task(maybe_auto_title(conversation_id))


# ---------- helpers ----------


async def _load_conversation_or_403(
    session: AsyncSession, conv_id: UUID, user_id: UUID
) -> Conversation:
    conv = await session.get(Conversation, conv_id)
    if conv is None:
        raise PermissionError("conversation not found")
    p = await session.execute(
        select(ConversationParticipant).where(
            ConversationParticipant.conversation_id == conv_id,
            ConversationParticipant.user_id == user_id,
        )
    )
    if p.scalar_one_or_none() is None:
        raise PermissionError("not a participant")
    return conv


async def _partner_id(
    session: AsyncSession, conv: Conversation, user_id: UUID
) -> UUID | None:
    rows = await session.execute(
        select(ConversationParticipant.user_id).where(
            ConversationParticipant.conversation_id == conv.id,
            ConversationParticipant.user_id != user_id,
        )
    )
    other = rows.scalar_one_or_none()
    return other


async def _recent_history(
    session: AsyncSession, conv_id: UUID, limit: int = 20
) -> list[Message]:
    rows = await session.execute(
        select(Message)
        .where(Message.conversation_id == conv_id, Message.status == "complete")
        .order_by(Message.created_at.desc())
        .limit(limit)
    )
    msgs = list(rows.scalars().all())
    msgs.reverse()
    return msgs


def _flatten_text(blocks: list[dict]) -> str:
    parts: list[str] = []
    for b in blocks:
        if b.get("type") == "text":
            parts.append(b.get("text", ""))
    return "\n".join(parts)


def _to_anthropic_messages(history: list[Message]) -> list[dict]:
    out: list[dict] = []
    for m in history:
        role = "user" if m.sender_type == "user" else "assistant"
        text = _flatten_text(m.content_blocks)
        if not text:
            continue
        out.append({"role": role, "content": [{"type": "text", "text": text}]})
    return out


def _msg_dict(m: Message) -> dict[str, Any]:
    return {
        "id": str(m.id),
        "conversation_id": str(m.conversation_id),
        "parent_message_id": str(m.parent_message_id) if m.parent_message_id else None,
        "sender_type": m.sender_type,
        "sender_user_id": str(m.sender_user_id) if m.sender_user_id else None,
        "mode": m.mode,
        "model_id": m.model_id,
        "content_blocks": m.content_blocks,
        "status": m.status,
        "created_at": m.created_at.isoformat() if m.created_at else None,
    }


async def _embed_messages(
    user_msg_id: UUID, user_text: str, ai_msg_id: UUID, ai_text: str
) -> None:
    try:
        async with SessionLocal() as session:
            await index_message(session, message_id=user_msg_id, text=user_text)
            await index_message(session, message_id=ai_msg_id, text=ai_text)
            await session.commit()
    except Exception:
        log.exception("embed.background.error")
