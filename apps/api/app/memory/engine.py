"""Memory engine — write embeddings for messages + manual memories.

MVP: no Mem0 fact extraction. We rely on dense retrieval over message
embeddings + vault chunks. The `memories` table is kept available for v2 and
for manual user-added facts via /memory POST.
"""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.integrations.voyage import embed_one
from app.models import Memory, MessageEmbedding


async def index_message(
    session: AsyncSession, *, message_id: UUID, text: str
) -> None:
    """Embed a message body and persist for later retrieval."""
    if not text or len(text.strip()) < 30:
        return
    vec = await embed_one(text, input_type="document")
    await session.execute(
        insert(MessageEmbedding).values(
            message_id=message_id,
            embedding=vec,
            text_indexed=text[:8000],
        )
    )


async def add_manual_memory(
    session: AsyncSession,
    *,
    owner_id: UUID,
    text: str,
    category: str | None = None,
    scope: str = "global",
    source_kind: str = "manual",
    source_id: UUID | None = None,
) -> Memory:
    vec = await embed_one(text, input_type="document")
    mem = Memory(
        owner_id=owner_id,
        text=text,
        category=category,
        scope=scope,
        source_kind=source_kind,
        source_id=source_id,
        embedding=vec,
    )
    session.add(mem)
    await session.flush()
    return mem
