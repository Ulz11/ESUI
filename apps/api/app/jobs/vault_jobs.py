"""Vault auto-tag + auto-link jobs.

Run after a document is created or its content changes (chunks rebuilt).
"""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import text
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.core.db import SessionLocal
from app.core.log import log
from app.integrations.anthropic import MODEL_IDS, get_client
from app.models import VaultDocument, VaultLink, VaultTag

# ---------- auto-tag ----------


TAG_TOOL = {
    "name": "emit_tags",
    "description": "Emit up to 5 short, lowercase, hyphenated tags for the document.",
    "input_schema": {
        "type": "object",
        "properties": {
            "tags": {
                "type": "array",
                "maxItems": 5,
                "items": {"type": "string"},
            }
        },
        "required": ["tags"],
    },
}


TAG_SYSTEM = """You tag documents for a personal knowledge vault. Output 1–5
short, lowercase, hyphenated tags. Tags are categorical (e.g. 'real-analysis',
'product-strategy'), not adjectives. Be specific over generic."""


async def auto_tag(doc_id: UUID) -> None:
    async with SessionLocal() as session:
        d = await session.get(VaultDocument, doc_id)
        if d is None or not d.content_md.strip():
            return

        try:
            tags = await _haiku_tags(f"{d.title}\n\n{d.content_md[:6000]}")
        except Exception as e:
            log.warn("vault.auto_tag.error", doc_id=str(doc_id), error=str(e))
            return
        if not tags:
            return

        # Drop existing AI tags first; preserve user tags.
        await session.execute(text("""
            DELETE FROM vault_tags
            WHERE document_id = :doc_id AND source = 'ai'
        """), {"doc_id": str(doc_id)})

        for t in tags:
            t_norm = _normalize_tag(t)
            if not t_norm:
                continue
            stmt = pg_insert(VaultTag).values(
                document_id=doc_id, tag=t_norm, source="ai"
            ).on_conflict_do_nothing()
            await session.execute(stmt)
        await session.commit()
    log.info("vault.auto_tag.done", doc_id=str(doc_id), count=len(tags))


def _normalize_tag(t: str) -> str:
    t = t.strip().lower()
    t = "".join(c if c.isalnum() else "-" for c in t)
    t = "-".join(p for p in t.split("-") if p)
    return t[:48]


async def _haiku_tags(content: str) -> list[str]:
    client = get_client()
    resp = await client.messages.create(
        model=MODEL_IDS["haiku"],
        max_tokens=200,
        temperature=0.3,
        system=TAG_SYSTEM,
        tools=[TAG_TOOL],
        tool_choice={"type": "tool", "name": "emit_tags"},
        messages=[{"role": "user", "content": content}],
    )
    for b in resp.content:
        if getattr(b, "type", "") == "tool_use" and b.name == "emit_tags":
            return [t for t in b.input.get("tags", []) if isinstance(t, str)]
    return []


# ---------- auto-link ----------

LINK_THRESHOLD = 0.78
LINK_TOP_K = 5


async def auto_link(doc_id: UUID) -> None:
    """Find top semantic neighbors and write bidirectional links."""
    async with SessionLocal() as session:
        d = await session.get(VaultDocument, doc_id)
        if d is None:
            return

        # Use the avg of this doc's chunk embeddings as the doc vector.
        sql = text("""
            WITH this_doc_avg AS (
              SELECT avg(embedding) AS v
              FROM vault_chunks
              WHERE document_id = :doc_id
            )
            SELECT vc.document_id,
                   1.0 - (avg(vc.embedding) <=> (SELECT v FROM this_doc_avg)) AS sim
            FROM vault_chunks vc
            JOIN vault_documents vd ON vd.id = vc.document_id
            WHERE vc.document_id != :doc_id
              AND vd.archived_at IS NULL
              AND vd.owner_id = :owner_id
            GROUP BY vc.document_id
            HAVING 1.0 - (avg(vc.embedding) <=> (SELECT v FROM this_doc_avg)) >= :threshold
            ORDER BY sim DESC
            LIMIT :limit
        """)
        rows = (await session.execute(sql, {
            "doc_id": str(doc_id),
            "owner_id": str(d.owner_id),
            "threshold": LINK_THRESHOLD,
            "limit": LINK_TOP_K,
        })).all()

        if not rows:
            return

        # Drop stale semantic links from this doc, then insert fresh ones (bidirectional).
        await session.execute(text("""
            DELETE FROM vault_links
            WHERE kind = 'semantic'
              AND (source_doc_id = :doc_id OR target_doc_id = :doc_id)
        """), {"doc_id": str(doc_id)})

        for r in rows:
            for src, tgt in ((doc_id, r.document_id), (r.document_id, doc_id)):
                stmt = pg_insert(VaultLink).values(
                    source_doc_id=src,
                    target_doc_id=tgt,
                    kind="semantic",
                    strength=float(r.sim),
                ).on_conflict_do_nothing()
                await session.execute(stmt)
        await session.commit()
    log.info("vault.auto_link.done", doc_id=str(doc_id), count=len(rows))
