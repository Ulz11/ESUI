"""Memory CRUD — Esui can audit, edit, and forget anything the AI remembers.

Transparency is intentional: the AI's mental model of her should never feel
like a black box.
"""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import desc, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import current_user
from app.core.db import get_session
from app.core.errors import bad_request, not_found
from app.core.redis import get_redis
from app.integrations.voyage import embed_one
from app.memory.engine import add_manual_memory
from app.models import Memory, User

router = APIRouter(prefix="/memory", tags=["memory"])


# ---------- schemas ----------


class MemoryOut(BaseModel):
    id: str
    owner_id: str
    scope: str
    text: str
    category: str | None
    salience: float
    confidence: float
    source_kind: str | None
    created_at: datetime
    last_used_at: datetime | None


class MemoryCreate(BaseModel):
    text: str
    category: str | None = None
    scope: str = "global"


class MemoryPatch(BaseModel):
    text: str | None = None
    category: str | None = None
    salience: float | None = None


class MemorySearch(BaseModel):
    query: str
    limit: int = 20


def _mem_out(m: Memory) -> MemoryOut:
    return MemoryOut(
        id=str(m.id),
        owner_id=str(m.owner_id),
        scope=m.scope,
        text=m.text,
        category=m.category,
        salience=m.salience,
        confidence=m.confidence,
        source_kind=m.source_kind,
        created_at=m.created_at,
        last_used_at=m.last_used_at,
    )


# ---------- endpoints ----------


@router.get("", response_model=list[MemoryOut])
async def list_memories(
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
    category: str | None = None,
    scope: str | None = None,
    include_forgotten: bool = False,
    limit: int = 100,
) -> list[MemoryOut]:
    q = select(Memory).where(
        Memory.owner_id == user.id,
        Memory.superseded_by.is_(None),
    )
    if not include_forgotten:
        q = q.where(Memory.forgotten.is_(False))
    if category:
        q = q.where(Memory.category == category)
    if scope:
        q = q.where(Memory.scope == scope)
    q = q.order_by(desc(Memory.salience), desc(Memory.created_at)).limit(min(limit, 500))
    rows = await session.execute(q)
    return [_mem_out(m) for m in rows.scalars().all()]


@router.post("", response_model=MemoryOut, status_code=201)
async def create_memory(
    body: MemoryCreate,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> MemoryOut:
    if not body.text.strip():
        raise bad_request("empty memory")
    mem = await add_manual_memory(
        session,
        owner_id=user.id,
        text=body.text.strip(),
        category=body.category,
        scope=body.scope,
        source_kind="manual",
    )
    await session.commit()
    return _mem_out(mem)


@router.patch("/{memory_id}", response_model=MemoryOut)
async def patch_memory(
    memory_id: UUID,
    body: MemoryPatch,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> MemoryOut:
    m = await session.get(Memory, memory_id)
    if m is None or m.owner_id != user.id:
        raise not_found("memory")
    text_changed = False
    if body.text is not None and body.text.strip() != m.text:
        m.text = body.text.strip()
        text_changed = True
    if body.category is not None:
        m.category = body.category
    if body.salience is not None:
        m.salience = max(0.0, min(1.0, body.salience))

    if text_changed:
        m.embedding = await embed_one(m.text, input_type="document")

    await session.commit()
    return _mem_out(m)


@router.post("/{memory_id}/forget", status_code=204)
async def forget_memory(
    memory_id: UUID,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> None:
    m = await session.get(Memory, memory_id)
    if m is None or m.owner_id != user.id:
        raise not_found("memory")
    m.forgotten = True
    m.salience = 0.0
    await session.commit()

    # Add to "do not re-learn" set for 90 days.
    redis = get_redis()
    forget_key = f"memory:forget_hashes:{user.id}"
    import hashlib
    h = hashlib.sha256(m.text.lower().strip().encode()).hexdigest()[:16]
    await redis.sadd(forget_key, h)
    await redis.expire(forget_key, 90 * 86400)


@router.post("/search", response_model=list[MemoryOut])
async def search_memories(
    body: MemorySearch,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> list[MemoryOut]:
    if not body.query.strip():
        raise bad_request("empty query")
    qvec = await embed_one(body.query, input_type="query")
    sql = text("""
        SELECT id
        FROM memories
        WHERE owner_id = :user_id
          AND superseded_by IS NULL
          AND forgotten = false
        ORDER BY embedding <=> CAST(:q AS vector)
        LIMIT :limit
    """)
    rows = (await session.execute(sql, {
        "q": "[" + ",".join(f"{v:.6f}" for v in qvec) + "]",
        "user_id": str(user.id),
        "limit": body.limit,
    })).all()
    ids = [r.id for r in rows]
    if not ids:
        return []
    res = await session.execute(select(Memory).where(Memory.id.in_(ids)))
    mems = {m.id: m for m in res.scalars().all()}
    # Preserve cosine order.
    return [_mem_out(mems[i]) for i in ids if i in mems]
