"""Multi-source retrieval for AI prompts.

Embeds the query once, runs cosine top-k against four sources, merges,
re-ranks with a small weighted scorer, and returns a labeled text block
ready to drop into the system prompt.

Sources (MVP):
  - vault_chunks   (top-15)
  - message_embeddings (top-10, restricted to current conversation)
  - memories       (top-10) -- empty until v2 fact extraction lands
  - file_chunks    (top-5, only files attached in this conversation)
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Literal
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.integrations.voyage import embed_one
from app.orchestrator.modes import Mode

Source = Literal["vault", "message", "memory", "file"]


@dataclass
class RetrievalHit:
    source: Source
    text: str
    label: str       # short human-readable label ("vault: Tarski notes")
    score: float
    raw_id: UUID
    age_days: float | None = None


# Mode bias: which categories of memory get a small boost.
_ULZII_MEMORY_BOOST = {"fact_about_user", "fact_about_world", "preference"}
_OBAMA_MEMORY_BOOST = {"decision", "project_state", "goal"}


async def retrieve_for_chat(
    *,
    session: AsyncSession,
    query: str,
    user_id: UUID,
    partner_id: UUID | None,
    conversation_id: UUID,
    mode: Mode,
    token_budget: int = 2000,
) -> str:
    """Returns a formatted retrieval block (markdown-ish), sized to budget."""
    qvec = await embed_one(query, input_type="query")

    hits: list[RetrievalHit] = []
    hits += await _search_vault(session, qvec, user_id, partner_id)
    hits += await _search_messages(session, qvec, conversation_id)
    hits += await _search_memories(session, qvec, user_id, mode)
    hits += await _search_file_chunks(session, qvec, conversation_id)

    if not hits:
        return ""

    # Re-rank with mode-aware weights.
    weights = _weights_for(mode)
    for h in hits:
        h.score = _composite_score(h, weights)

    hits.sort(key=lambda h: h.score, reverse=True)

    # Touch last_used_at on the memories we surfaced — keeps salience decay honest.
    used_memory_ids = [h.raw_id for h in hits[:10] if h.source == "memory"]
    if used_memory_ids:
        try:
            await session.execute(text("""
                UPDATE memories
                SET last_used_at = now()
                WHERE id = ANY(:ids)
            """), {"ids": [str(i) for i in used_memory_ids]})
            await session.commit()
        except Exception:
            await session.rollback()

    return _format_block(hits, token_budget)


# ---------- per-source searches ----------


async def _search_vault(
    session: AsyncSession, qvec: list[float], user_id: UUID, partner_id: UUID | None
) -> list[RetrievalHit]:
    # cosine distance via pgvector <=> operator; lower is closer.
    sql = text("""
        SELECT
            vc.id, vc.text, vc.document_id,
            vd.title,
            vd.updated_at,
            (vc.embedding <=> CAST(:q AS vector)) AS distance
        FROM vault_chunks vc
        JOIN vault_documents vd ON vd.id = vc.document_id
        WHERE vd.archived_at IS NULL
          AND (vd.owner_id = :user_id OR (vd.shared = true AND vd.owner_id = :partner_id))
        ORDER BY vc.embedding <=> CAST(:q AS vector)
        LIMIT 15
    """)
    rows = (await session.execute(
        sql,
        {"q": _vec_literal(qvec), "user_id": str(user_id), "partner_id": str(partner_id) if partner_id else None},
    )).all()

    out: list[RetrievalHit] = []
    for r in rows:
        sim = 1.0 - float(r.distance)
        age = _age_days(r.updated_at)
        out.append(RetrievalHit(
            source="vault",
            text=r.text,
            label=f"vault: {r.title}",
            score=sim,
            raw_id=r.id,
            age_days=age,
        ))
    return out


async def _search_messages(
    session: AsyncSession, qvec: list[float], conversation_id: UUID
) -> list[RetrievalHit]:
    sql = text("""
        SELECT
            me.message_id, me.text_indexed, m.created_at,
            (me.embedding <=> CAST(:q AS vector)) AS distance
        FROM message_embeddings me
        JOIN messages m ON m.id = me.message_id
        WHERE m.conversation_id = :conv_id
        ORDER BY me.embedding <=> CAST(:q AS vector)
        LIMIT 10
    """)
    rows = (await session.execute(
        sql, {"q": _vec_literal(qvec), "conv_id": str(conversation_id)}
    )).all()

    out: list[RetrievalHit] = []
    for r in rows:
        sim = 1.0 - float(r.distance)
        out.append(RetrievalHit(
            source="message",
            text=r.text_indexed,
            label="recent in this conversation",
            score=sim,
            raw_id=r.message_id,
            age_days=_age_days(r.created_at),
        ))
    return out


async def _search_memories(
    session: AsyncSession, qvec: list[float], user_id: UUID, mode: Mode
) -> list[RetrievalHit]:
    sql = text("""
        SELECT
            m.id, m.text, m.category, m.salience, m.created_at,
            (m.embedding <=> CAST(:q AS vector)) AS distance
        FROM memories m
        WHERE m.owner_id = :user_id
          AND m.superseded_by IS NULL
          AND m.forgotten = false
        ORDER BY m.embedding <=> CAST(:q AS vector)
        LIMIT 10
    """)
    rows = (await session.execute(
        sql, {"q": _vec_literal(qvec), "user_id": str(user_id)}
    )).all()

    boost_categories = (
        _ULZII_MEMORY_BOOST if mode == "ulzii" else _OBAMA_MEMORY_BOOST
    )
    out: list[RetrievalHit] = []
    for r in rows:
        sim = 1.0 - float(r.distance)
        boost = 1.15 if r.category in boost_categories else 1.0
        out.append(RetrievalHit(
            source="memory",
            text=r.text,
            label=f"memory[{r.category}]" if r.category else "memory",
            score=sim * boost * float(r.salience),
            raw_id=r.id,
            age_days=_age_days(r.created_at),
        ))
    return out


async def _search_file_chunks(
    session: AsyncSession, qvec: list[float], conversation_id: UUID
) -> list[RetrievalHit]:
    """Only files attached to messages in this conversation."""
    sql = text("""
        SELECT DISTINCT
            fc.id, fc.text, fc.section_path, fc.page_start, fc.page_end,
            f.filename,
            (fc.embedding <=> CAST(:q AS vector)) AS distance
        FROM file_chunks fc
        JOIN files f ON f.id = fc.file_id
        JOIN message_files mf ON mf.file_id = f.id
        JOIN messages m ON m.id = mf.message_id
        WHERE m.conversation_id = :conv_id
        ORDER BY fc.embedding <=> CAST(:q AS vector)
        LIMIT 5
    """)
    rows = (await session.execute(
        sql, {"q": _vec_literal(qvec), "conv_id": str(conversation_id)}
    )).all()
    out: list[RetrievalHit] = []
    for r in rows:
        sim = 1.0 - float(r.distance)
        loc = ""
        if r.page_start:
            loc = f" · p.{r.page_start}"
            if r.page_end and r.page_end != r.page_start:
                loc = f" · p.{r.page_start}-{r.page_end}"
        label = f"file: {r.filename}{loc}"
        if r.section_path:
            label += f" — {r.section_path}"
        out.append(RetrievalHit(
            source="file", text=r.text, label=label, score=sim, raw_id=r.id,
        ))
    return out


# ---------- ranking ----------


def _weights_for(mode: Mode) -> dict[str, float]:
    if mode == "obama":
        return {"sim": 0.55, "recency": 0.25, "salience": 0.10, "pin": 0.10}
    return {"sim": 0.65, "recency": 0.10, "salience": 0.15, "pin": 0.10}


def _composite_score(h: RetrievalHit, weights: dict[str, float]) -> float:
    sim = h.score
    recency = math.exp(-(h.age_days or 0.0) / 30.0)
    return weights["sim"] * sim + weights["recency"] * recency


# ---------- formatting ----------


def _format_block(hits: list[RetrievalHit], token_budget: int) -> str:
    """Approximate 4 chars/token. Truncate hits to fit budget."""
    char_budget = token_budget * 4

    grouped: dict[Source, list[RetrievalHit]] = {
        "memory": [], "vault": [], "file": [], "message": [],
    }
    for h in hits:
        grouped[h.source].append(h)

    lines: list[str] = ["<retrieved>"]
    used = 0

    def emit(s: str) -> bool:
        nonlocal used
        if used + len(s) > char_budget:
            return False
        lines.append(s)
        used += len(s)
        return True

    section_titles = {
        "memory": "## Memories",
        "vault": "## Vault",
        "file": "## Files",
        "message": "## Recent in this conversation",
    }

    for src in ("memory", "vault", "file", "message"):
        if not grouped[src]:
            continue
        if not emit(section_titles[src]):
            break
        for h in grouped[src][:5]:
            snippet = h.text.replace("\n", " ").strip()
            if len(snippet) > 240:
                snippet = snippet[:237] + "..."
            line = f"- [{h.label}] {snippet}"
            if not emit(line):
                break

    lines.append("</retrieved>")
    return "\n".join(lines)


# ---------- helpers ----------


def _vec_literal(vec: list[float]) -> str:
    """Format a Python list as a pgvector literal, e.g. '[0.1,0.2,...]'."""
    return "[" + ",".join(f"{v:.6f}" for v in vec) + "]"


def _age_days(ts: datetime | None) -> float:
    if ts is None:
        return 0.0
    if ts.tzinfo is None:
        ts = ts.replace(tzinfo=UTC)
    return (datetime.now(tz=UTC) - ts).total_seconds() / 86400.0
