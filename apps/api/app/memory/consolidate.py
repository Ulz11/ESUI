"""Nightly memory consolidation.

For each user, cluster recent memories by embedding similarity (>0.85),
ask Sonnet to merge each cluster into a single canonical statement, then
mark the originals as superseded_by the canonical.

Also runs salience decay: salience *= 0.97 for memories not used in 24h.
"""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import SessionLocal
from app.core.log import log
from app.integrations.anthropic import MODEL_IDS, get_client
from app.integrations.voyage import embed_one
from app.models import AICall, Memory, User

CONSOLIDATE_SYSTEM = """You merge near-duplicate memories about a user into ONE
canonical statement. Preserve the newest evidence; discard older phrasings.
Output a single concise third-person sentence."""


CONSOLIDATE_TOOL = {
    "name": "emit_canonical",
    "description": "Emit the merged canonical memory statement.",
    "input_schema": {
        "type": "object",
        "properties": {
            "text": {"type": "string"},
            "category": {"type": "string"},
        },
        "required": ["text", "category"],
    },
}


CLUSTER_THRESHOLD = 0.85
SALIENCE_DECAY = 0.97


async def consolidate_for_user(user_id: UUID) -> int:
    """Returns the number of memories superseded."""
    async with SessionLocal() as session:
        recent = await _recent_memories(session, user_id, hours=36)
        if len(recent) < 2:
            await _decay_salience(session, user_id)
            await session.commit()
            return 0

        clusters = _greedy_cluster(recent, CLUSTER_THRESHOLD)
        merged_count = 0

        for cluster in clusters:
            if len(cluster) < 2:
                continue
            canonical_text, category = await _merge_cluster(cluster)
            if not canonical_text:
                continue
            new_vec = await embed_one(canonical_text, input_type="document")

            canonical = Memory(
                owner_id=user_id,
                scope="global",
                text=canonical_text,
                category=category or cluster[0].category,
                embedding=new_vec,
                source_kind="chat",
                salience=max(m.salience for m in cluster),
                confidence=max(m.confidence for m in cluster),
            )
            session.add(canonical)
            await session.flush()

            for old in cluster:
                old.superseded_by = canonical.id
                merged_count += 1

            session.add(AICall(
                user_id=user_id,
                task="memory.consolidate",
                provider="anthropic",
                model_id="claude-sonnet",
            ))

        await _decay_salience(session, user_id)
        await session.commit()

        log.info("memory.consolidate.done", user_id=str(user_id),
                 superseded=merged_count, clusters=len(clusters))
        return merged_count


async def consolidate_all() -> None:
    """Iterate all users; runs nightly via APScheduler."""
    async with SessionLocal() as session:
        users = (await session.execute(select(User))).scalars().all()
    for u in users:
        try:
            await consolidate_for_user(u.id)
        except Exception:
            log.exception("memory.consolidate.user.error", user_id=str(u.id))


# ---------- internals ----------


async def _recent_memories(
    session: AsyncSession, user_id: UUID, hours: int
) -> list[Memory]:
    rows = await session.execute(text(f"""
        SELECT id FROM memories
        WHERE owner_id = :user_id
          AND superseded_by IS NULL
          AND forgotten = false
          AND created_at > now() - interval '{hours} hours'
    """), {"user_id": str(user_id)})
    ids = [r.id for r in rows]
    if not ids:
        return []
    res = await session.execute(
        select(Memory).where(Memory.id.in_(ids))
    )
    return list(res.scalars().all())


def _greedy_cluster(memories: list[Memory], threshold: float) -> list[list[Memory]]:
    """O(n²) single-pass clustering. Fine for low hundreds of new memories per day."""
    clusters: list[list[Memory]] = []
    used: set[UUID] = set()

    for m in memories:
        if m.id in used:
            continue
        cluster = [m]
        used.add(m.id)
        for o in memories:
            if o.id in used:
                continue
            if _cosine(m.embedding, o.embedding) >= threshold:
                cluster.append(o)
                used.add(o.id)
        clusters.append(cluster)
    return clusters


def _cosine(a: list[float], b: list[float]) -> float:
    if not a or not b:
        return 0.0
    dot = sum(x * y for x, y in zip(a, b, strict=True))
    na = sum(x * x for x in a) ** 0.5
    nb = sum(y * y for y in b) ** 0.5
    if na == 0 or nb == 0:
        return 0.0
    return dot / (na * nb)


async def _merge_cluster(cluster: list[Memory]) -> tuple[str, str | None]:
    items = "\n".join(f"- ({m.category or 'fact'}) {m.text}" for m in cluster)
    user = (
        "Merge these into one canonical memory. Pick the freshest, most "
        "specific phrasing. Preserve any committed decisions.\n\n" + items
    )
    client = get_client()
    try:
        resp = await client.messages.create(
            model=MODEL_IDS["sonnet"],
            max_tokens=400,
            temperature=0.2,
            system=CONSOLIDATE_SYSTEM,
            tools=[CONSOLIDATE_TOOL],
            tool_choice={"type": "tool", "name": "emit_canonical"},
            messages=[{"role": "user", "content": user}],
        )
    except Exception as e:
        log.warn("memory.consolidate.merge.error", error=str(e))
        return "", None
    for b in resp.content:
        if getattr(b, "type", "") == "tool_use" and b.name == "emit_canonical":
            return b.input.get("text", "").strip(), b.input.get("category")
    return "", None


async def _decay_salience(session: AsyncSession, user_id: UUID) -> None:
    await session.execute(text(f"""
        UPDATE memories
        SET salience = salience * {SALIENCE_DECAY}
        WHERE owner_id = :user_id
          AND superseded_by IS NULL
          AND forgotten = false
          AND (last_used_at IS NULL OR last_used_at < now() - interval '24 hours')
    """), {"user_id": str(user_id)})
