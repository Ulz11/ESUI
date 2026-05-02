"""Conversation auto-titling.

After the third turn (or first long opening message), run Haiku on the
opening exchange and produce a 4–6 word title. Updates the conversation
in place.
"""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import select

from app.core.db import SessionLocal
from app.core.log import log
from app.integrations.anthropic import MODEL_IDS, get_client
from app.models import AICall, Conversation, Message

TITLE_TOOL = {
    "name": "emit_title",
    "description": "Emit the conversation title.",
    "input_schema": {
        "type": "object",
        "properties": {
            "title": {
                "type": "string",
                "description": "4-6 words, no punctuation, no quotes.",
            },
        },
        "required": ["title"],
    },
}


TITLE_SYSTEM = """You write short, calm conversation titles. 4–6 words,
no quotes, no punctuation, no emojis. Capture the topic, not the affect."""


async def maybe_auto_title(conversation_id: UUID, *, force: bool = False) -> None:
    async with SessionLocal() as session:
        conv = await session.get(Conversation, conversation_id)
        if conv is None or (conv.title and not force):
            return

        rows = (await session.execute(
            select(Message)
            .where(
                Message.conversation_id == conversation_id,
                Message.status == "complete",
            )
            .order_by(Message.created_at)
            .limit(6)
        )).scalars().all()
        if len(rows) < 3 and not force:
            return

        # Build a mini-transcript.
        lines = []
        for m in rows[:6]:
            role = "USER" if m.sender_type == "user" else "AI"
            text = _flatten_text(m.content_blocks)
            if text:
                lines.append(f"{role}: {text[:600]}")
        if not lines:
            return

        try:
            title = await _haiku_title("\n\n".join(lines))
        except Exception as e:
            log.warn("auto_title.error", error=str(e))
            return
        if not title:
            return

        conv.title = title[:60]
        owner_id = conv.created_by
        session.add(AICall(
            user_id=owner_id,
            conversation_id=conversation_id,
            task="chat.auto_title",
            provider="anthropic",
            model_id="claude-haiku",
        ))
        await session.commit()
        log.info("auto_title.set", conversation_id=str(conversation_id), title=title)


async def _haiku_title(transcript: str) -> str:
    client = get_client()
    resp = await client.messages.create(
        model=MODEL_IDS["haiku"],
        max_tokens=60,
        temperature=0.4,
        system=TITLE_SYSTEM,
        tools=[TITLE_TOOL],
        tool_choice={"type": "tool", "name": "emit_title"},
        messages=[{"role": "user", "content": transcript}],
    )
    for b in resp.content:
        if getattr(b, "type", "") == "tool_use" and b.name == "emit_title":
            return b.input.get("title", "").strip()
    return ""


def _flatten_text(blocks: list[dict]) -> str:
    return "\n".join(b.get("text", "") for b in blocks if b.get("type") == "text")
