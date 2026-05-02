"""Fact extraction from chat turns — Mem0-style, but ours.

After each AI completion, this module runs Haiku on (user_msg, ai_msg) and
emits 0–3 long-term memories. Each fact is embedded, deduped against
existing memories via cosine, and either:
  - inserted (new)
  - merged (close paraphrase: keep newer, supersede older)
  - skipped (already known with higher salience)

Memories are scoped to the speaking user_id only. We never extract memories
about user A into user B's store — privacy is structural.

Forgotten facts are not re-learned: their embeddings are tracked in Redis
("do not re-learn" set) for 90 days from last_used.
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
from typing import Literal
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import SessionLocal
from app.core.log import log
from app.core.redis import get_redis
from app.integrations.anthropic import MODEL_IDS, get_client
from app.integrations.voyage import embed
from app.models import AICall, Memory

Category = Literal[
    "preference", "goal", "decision",
    "fact_about_user", "fact_about_world",
    "project_state", "relationship",
]


# ---------- prompt ----------


EXTRACT_TOOL = {
    "name": "emit_facts",
    "description": "Emit long-term memories worth keeping about the user.",
    "input_schema": {
        "type": "object",
        "properties": {
            "facts": {
                "type": "array",
                "maxItems": 3,
                "items": {
                    "type": "object",
                    "properties": {
                        "text": {
                            "type": "string",
                            "description": "Concise statement, third-person about the user.",
                        },
                        "category": {
                            "type": "string",
                            "enum": [
                                "preference", "goal", "decision",
                                "fact_about_user", "fact_about_world",
                                "project_state", "relationship",
                            ],
                        },
                        "confidence": {"type": "number", "description": "0..1"},
                    },
                    "required": ["text", "category", "confidence"],
                },
            },
        },
        "required": ["facts"],
    },
}


EXTRACT_SYSTEM = """You extract long-term memories about the USER from one
conversational exchange (their message and the AI's reply).

Output 0–3 facts in third person about the user, the kind another AI would
benefit from knowing weeks later. Skip transient mood, questions, and the
AI's own claims about itself. Skip throwaway pleasantries.

Only commit things you'd want to remember:
  - preference: stable likes/dislikes
  - goal: what they're working toward
  - decision: a choice they made (commit it)
  - fact_about_user: a stable fact about who they are
  - fact_about_world: an external fact they care about
  - project_state: where an ongoing project stands
  - relationship: a person in their life and the relationship

If nothing memorable surfaced, output an empty list. That is the right
answer most of the time. Better to skip than fabricate."""


# ---------- public API ----------


@dataclass
class ExtractedFact:
    text: str
    category: Category
    confidence: float


async def extract_and_store(
    *,
    user_id: UUID,
    user_text: str,
    ai_text: str,
    conversation_id: UUID | None = None,
    source_message_id: UUID | None = None,
) -> list[UUID]:
    """Extract candidate facts, dedupe against existing memories, persist.

    Returns the list of memory ids that were inserted or updated.
    Idempotent on (text, owner) — duplicates by content are merged.
    """
    if not user_text.strip() or not ai_text.strip():
        return []

    facts, tokens_in, tokens_out = await _extract_via_haiku(user_text, ai_text)
    if not facts:
        return []

    # Embed all candidate facts in one batch.
    vectors = await embed([f.text for f in facts], input_type="document")

    # "Do not re-learn" check (Redis hash set per user; expires lazily).
    redis = get_redis()
    forget_key = f"memory:forget_hashes:{user_id}"
    forgotten = await redis.smembers(forget_key) or set()

    persisted: list[UUID] = []
    async with SessionLocal() as session:
        # Log the extraction call.
        session.add(AICall(
            user_id=user_id,
            conversation_id=conversation_id,
            task="memory.extract",
            provider="anthropic",
            model_id="claude-haiku",
            tokens_in=tokens_in,
            tokens_out=tokens_out,
        ))

        for fact, vec in zip(facts, vectors, strict=True):
            text_hash = _content_hash(fact.text)
            if text_hash in forgotten:
                continue

            # Find any existing memory with cosine similarity > 0.92.
            existing = await _find_similar(session, user_id, vec, threshold=0.92)
            if existing is not None:
                # Update salience + last_used; do not insert.
                await session.execute(text("""
                    UPDATE memories
                    SET salience = LEAST(1.0, salience + 0.1),
                        last_used_at = now(),
                        confidence = GREATEST(confidence, :conf)
                    WHERE id = :mid
                """), {"mid": str(existing.id), "conf": fact.confidence})
                persisted.append(existing.id)
                continue

            mem = Memory(
                owner_id=user_id,
                scope="conversation" if conversation_id else "global",
                scope_ref_id=conversation_id,
                text=fact.text,
                category=fact.category,
                embedding=vec,
                source_kind="chat",
                source_id=source_message_id,
                salience=float(fact.confidence),
                confidence=float(fact.confidence),
            )
            session.add(mem)
            await session.flush()
            persisted.append(mem.id)

        await session.commit()

    log.info("memory.extracted", user_id=str(user_id),
             count=len(persisted), candidates=len(facts))
    return persisted


# ---------- internals ----------


async def _extract_via_haiku(
    user_text: str, ai_text: str
) -> tuple[list[ExtractedFact], int, int]:
    client = get_client()
    user = (
        f"USER:\n{user_text[:4000]}\n\n"
        f"AI:\n{ai_text[:4000]}"
    )
    try:
        resp = await client.messages.create(
            model=MODEL_IDS["haiku"],
            max_tokens=600,
            temperature=0.2,
            system=EXTRACT_SYSTEM,
            tools=[EXTRACT_TOOL],
            tool_choice={"type": "tool", "name": "emit_facts"},
            messages=[{"role": "user", "content": user}],
        )
    except Exception as e:
        log.warn("memory.extract.error", error=str(e))
        return [], 0, 0

    facts: list[ExtractedFact] = []
    for b in resp.content:
        if getattr(b, "type", "") == "tool_use" and b.name == "emit_facts":
            for f in b.input.get("facts", []):
                try:
                    facts.append(ExtractedFact(
                        text=f["text"].strip(),
                        category=f["category"],
                        confidence=float(f.get("confidence", 0.7)),
                    ))
                except (KeyError, ValueError):
                    continue
    return facts, resp.usage.input_tokens, resp.usage.output_tokens


async def _find_similar(
    session: AsyncSession, user_id: UUID, vec: list[float], threshold: float
) -> Memory | None:
    sql = text("""
        SELECT id, text,
               1.0 - (embedding <=> CAST(:q AS vector)) AS sim
        FROM memories
        WHERE owner_id = :user_id
          AND superseded_by IS NULL
          AND forgotten = false
        ORDER BY embedding <=> CAST(:q AS vector)
        LIMIT 1
    """)
    row = (await session.execute(
        sql,
        {"q": _vec_literal(vec), "user_id": str(user_id)},
    )).first()
    if row is None:
        return None
    if float(row.sim) < threshold:
        return None
    # Reload as ORM object for caller.
    return await session.get(Memory, row.id)


def _vec_literal(vec: list[float]) -> str:
    return "[" + ",".join(f"{v:.6f}" for v in vec) + "]"


def _content_hash(text: str) -> str:
    import hashlib
    return hashlib.sha256(text.lower().strip().encode()).hexdigest()[:16]


# ---------- background helper for streaming.py ----------


def fire_and_forget_extract(
    user_id: UUID,
    user_text: str,
    ai_text: str,
    conversation_id: UUID,
    source_message_id: UUID,
) -> None:
    """Dispatch extraction in the background; never raise into caller."""
    async def _run() -> None:
        try:
            await extract_and_store(
                user_id=user_id,
                user_text=user_text,
                ai_text=ai_text,
                conversation_id=conversation_id,
                source_message_id=source_message_id,
            )
        except Exception:
            log.exception("memory.extract.background.error")

    asyncio.create_task(_run())
