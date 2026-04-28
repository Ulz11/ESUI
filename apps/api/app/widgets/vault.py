"""Vault — markdown notes, semantic search, file import.

MVP scope: CRUD on documents, hybrid search (cosine + trigram), file import
that triggers the ingest pipeline asynchronously. Deferred: tags (auto-AI),
links (knowledge graph), graph view.
"""

from __future__ import annotations

import asyncio
from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import desc, func, or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import current_user
from app.core.db import SessionLocal, get_session
from app.core.errors import bad_request, not_found
from app.ingest.parse import ingest_file
from app.integrations.voyage import embed_one
from app.jobs.vault_jobs import auto_link, auto_tag
from app.models import File, User, VaultChunk, VaultDocument, VaultLink, VaultTag

router = APIRouter(prefix="/vault", tags=["vault"])


# ---------- schemas ----------


class DocumentOut(BaseModel):
    id: str
    owner_id: str
    title: str
    content_md: str
    content_type: str
    shared: bool
    source_file_id: str | None
    created_at: datetime
    updated_at: datetime


class DocumentCreate(BaseModel):
    title: str
    content_md: str = ""
    content_type: str = "note"
    shared: bool = False


class DocumentPatch(BaseModel):
    title: str | None = None
    content_md: str | None = None
    content_type: str | None = None
    shared: bool | None = None
    archived: bool | None = None


class SearchRequest(BaseModel):
    query: str
    limit: int = 10
    mode: str = "hybrid"  # 'hybrid' | 'semantic'


class SearchHit(BaseModel):
    document_id: str
    title: str
    snippet: str
    score: float


class ImportFileRequest(BaseModel):
    file_id: str
    title: str | None = None
    content_type: str = "reference"


def _doc_out(d: VaultDocument) -> DocumentOut:
    return DocumentOut(
        id=str(d.id),
        owner_id=str(d.owner_id),
        title=d.title,
        content_md=d.content_md,
        content_type=d.content_type,
        shared=d.shared,
        source_file_id=str(d.source_file_id) if d.source_file_id else None,
        created_at=d.created_at,
        updated_at=d.updated_at,
    )


def _visible_filter(owner_id: UUID, partner_id: UUID | None):
    """Either I own it OR partner owns + shared=true."""
    if partner_id is None:
        return VaultDocument.owner_id == owner_id
    return or_(
        VaultDocument.owner_id == owner_id,
        (VaultDocument.owner_id == partner_id) & (VaultDocument.shared.is_(True)),
    )


async def _partner_id(session: AsyncSession, user: User) -> UUID | None:
    other = await session.execute(
        select(User.id).where(User.id != user.id).limit(1)
    )
    return other.scalar_one_or_none()


# ---------- CRUD ----------


@router.get("/documents", response_model=list[DocumentOut])
async def list_documents(
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
    archived: bool = False,
    shared_only: bool = False,
    limit: int = 50,
) -> list[DocumentOut]:
    partner = await _partner_id(session, user)
    q = select(VaultDocument).where(_visible_filter(user.id, partner))
    if shared_only:
        q = q.where(VaultDocument.shared.is_(True))
    q = q.where(
        VaultDocument.archived_at.is_(None) if not archived
        else VaultDocument.archived_at.is_not(None)
    )
    q = q.order_by(desc(VaultDocument.updated_at)).limit(min(limit, 200))
    rows = await session.execute(q)
    return [_doc_out(d) for d in rows.scalars().all()]


@router.post("/documents", response_model=DocumentOut, status_code=201)
async def create_document(
    body: DocumentCreate,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> DocumentOut:
    d = VaultDocument(
        owner_id=user.id,
        title=body.title,
        content_md=body.content_md,
        content_type=body.content_type,
        shared=body.shared,
    )
    session.add(d)
    await session.commit()
    # async: embed chunks → tag → link
    asyncio.create_task(_reindex_then_enrich(d.id, body.content_md))
    return _doc_out(d)


@router.get("/documents/{doc_id}", response_model=DocumentOut)
async def get_document(
    doc_id: UUID,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> DocumentOut:
    d = await session.get(VaultDocument, doc_id)
    if d is None:
        raise not_found("document")
    partner = await _partner_id(session, user)
    if d.owner_id != user.id and not (d.shared and d.owner_id == partner):
        raise not_found("document")
    return _doc_out(d)


@router.patch("/documents/{doc_id}", response_model=DocumentOut)
async def patch_document(
    doc_id: UUID,
    body: DocumentPatch,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> DocumentOut:
    d = await session.get(VaultDocument, doc_id)
    if d is None or d.owner_id != user.id:
        raise not_found("document")

    content_changed = False
    if body.title is not None:
        d.title = body.title
    if body.content_md is not None and body.content_md != d.content_md:
        d.content_md = body.content_md
        content_changed = True
    if body.content_type is not None:
        d.content_type = body.content_type
    if body.shared is not None:
        d.shared = body.shared
    if body.archived is True:
        d.archived_at = func.now()
    if body.archived is False:
        d.archived_at = None
    d.updated_at = func.now()
    await session.commit()

    if content_changed:
        asyncio.create_task(_reindex_then_enrich(d.id, d.content_md))

    return _doc_out(d)


@router.delete("/documents/{doc_id}", status_code=204)
async def delete_document(
    doc_id: UUID,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> None:
    d = await session.get(VaultDocument, doc_id)
    if d is None or d.owner_id != user.id:
        raise not_found("document")
    await session.delete(d)
    await session.commit()


# ---------- search ----------


@router.post("/search", response_model=list[SearchHit])
async def search(
    body: SearchRequest,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> list[SearchHit]:
    if not body.query.strip():
        raise bad_request("empty query")

    qvec = await embed_one(body.query, input_type="query")
    partner = await _partner_id(session, user)
    partner_id = str(partner) if partner else None

    sql = text("""
        WITH semantic AS (
          SELECT vc.document_id,
                 vd.title,
                 vc.text AS snippet,
                 1.0 - (vc.embedding <=> CAST(:q AS vector)) AS sim
          FROM vault_chunks vc
          JOIN vault_documents vd ON vd.id = vc.document_id
          WHERE vd.archived_at IS NULL
            AND (vd.owner_id = :user_id
                 OR (vd.shared = true AND vd.owner_id = :partner_id))
          ORDER BY vc.embedding <=> CAST(:q AS vector)
          LIMIT 30
        ),
        agg AS (
          SELECT document_id,
                 MAX(title) AS title,
                 MAX(sim)   AS top_sim,
                 (ARRAY_AGG(snippet ORDER BY sim DESC))[1] AS snippet
          FROM semantic
          GROUP BY document_id
          ORDER BY top_sim DESC
          LIMIT :limit
        )
        SELECT * FROM agg
    """)
    rows = (await session.execute(
        sql,
        {
            "q": "[" + ",".join(f"{v:.6f}" for v in qvec) + "]",
            "user_id": str(user.id),
            "partner_id": partner_id,
            "limit": body.limit,
        },
    )).all()

    return [
        SearchHit(
            document_id=str(r.document_id),
            title=r.title,
            snippet=(r.snippet[:300] + "...") if len(r.snippet) > 300 else r.snippet,
            score=float(r.top_sim),
        )
        for r in rows
    ]


# ---------- tags ----------


class TagBody(BaseModel):
    tag: str


@router.get("/documents/{doc_id}/tags", response_model=list[dict[str, str]])
async def list_tags(
    doc_id: UUID,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> list[dict[str, str]]:
    d = await session.get(VaultDocument, doc_id)
    if d is None:
        raise not_found("document")
    partner = await _partner_id(session, user)
    if d.owner_id != user.id and not (d.shared and d.owner_id == partner):
        raise not_found("document")
    rows = await session.execute(select(VaultTag).where(VaultTag.document_id == doc_id))
    return [{"tag": t.tag, "source": t.source} for t in rows.scalars().all()]


@router.post("/documents/{doc_id}/tags", status_code=201)
async def add_tag(
    doc_id: UUID,
    body: TagBody,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> dict[str, str]:
    d = await session.get(VaultDocument, doc_id)
    if d is None or d.owner_id != user.id:
        raise not_found("document")
    from sqlalchemy.dialects.postgresql import insert as pg_insert
    stmt = pg_insert(VaultTag).values(
        document_id=doc_id,
        tag=body.tag.strip().lower()[:48],
        source="user",
    ).on_conflict_do_nothing()
    await session.execute(stmt)
    await session.commit()
    return {"ok": "true"}


@router.delete("/documents/{doc_id}/tags/{tag}", status_code=204)
async def delete_tag(
    doc_id: UUID,
    tag: str,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> None:
    d = await session.get(VaultDocument, doc_id)
    if d is None or d.owner_id != user.id:
        raise not_found("document")
    await session.execute(text(
        "DELETE FROM vault_tags WHERE document_id = :doc AND tag = :tag"
    ), {"doc": str(doc_id), "tag": tag})
    await session.commit()


# ---------- knowledge graph ----------


class GraphNode(BaseModel):
    id: str
    title: str
    tags: list[str]
    updated_at: datetime
    content_type: str


class GraphEdge(BaseModel):
    source: str
    target: str
    kind: str
    strength: float | None = None
    note: str | None = None


class GraphOut(BaseModel):
    nodes: list[GraphNode]
    edges: list[GraphEdge]


@router.get("/graph", response_model=GraphOut)
async def vault_graph(
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
    center: UUID | None = None,
    depth: int = 2,
    max_nodes: int = 80,
) -> GraphOut:
    partner = await _partner_id(session, user)
    visible_owner = (str(user.id), str(partner) if partner else None)

    # BFS from center if given; else top-N most-recently-updated docs.
    if center is not None:
        seen: set[str] = {str(center)}
        frontier: list[str] = [str(center)]
        for _ in range(max(0, depth)):
            if not frontier or len(seen) >= max_nodes:
                break
            placeholders = ",".join(f":d{i}" for i in range(len(frontier)))
            params = {f"d{i}": v for i, v in enumerate(frontier)}
            params["limit"] = max_nodes - len(seen)
            rows = await session.execute(text(f"""
                SELECT DISTINCT
                  CASE WHEN source_doc_id::text IN ({placeholders}) THEN target_doc_id::text
                       ELSE source_doc_id::text END AS neighbor
                FROM vault_links
                WHERE source_doc_id::text IN ({placeholders})
                   OR target_doc_id::text IN ({placeholders})
                LIMIT :limit
            """), params)
            new = [r.neighbor for r in rows if r.neighbor not in seen]
            seen.update(new)
            frontier = new
        node_ids = list(seen)
    else:
        rows = await session.execute(
            select(VaultDocument.id)
            .where(_visible_filter(user.id, partner))
            .where(VaultDocument.archived_at.is_(None))
            .order_by(desc(VaultDocument.updated_at))
            .limit(max_nodes)
        )
        node_ids = [str(r) for r in rows.scalars().all()]

    if not node_ids:
        return GraphOut(nodes=[], edges=[])

    docs = await session.execute(
        select(VaultDocument).where(VaultDocument.id.in_(node_ids))
    )
    doc_list = list(docs.scalars().all())
    doc_ids_set = {str(d.id) for d in doc_list}

    tags_rows = await session.execute(
        select(VaultTag).where(VaultTag.document_id.in_(node_ids))
    )
    tag_map: dict[str, list[str]] = {}
    for t in tags_rows.scalars().all():
        tag_map.setdefault(str(t.document_id), []).append(t.tag)

    nodes = [
        GraphNode(
            id=str(d.id),
            title=d.title,
            tags=tag_map.get(str(d.id), []),
            updated_at=d.updated_at,
            content_type=d.content_type,
        )
        for d in doc_list
        if d.owner_id == user.id or (d.shared and d.owner_id == partner)
    ]

    edge_rows = await session.execute(
        select(VaultLink).where(
            VaultLink.source_doc_id.in_(node_ids),
            VaultLink.target_doc_id.in_(node_ids),
        )
    )
    edges = [
        GraphEdge(
            source=str(e.source_doc_id),
            target=str(e.target_doc_id),
            kind=e.kind,
            strength=e.strength,
            note=e.note,
        )
        for e in edge_rows.scalars().all()
        if str(e.source_doc_id) in doc_ids_set and str(e.target_doc_id) in doc_ids_set
    ]

    return GraphOut(nodes=nodes, edges=edges)


# ---------- import from file ----------


@router.post("/import-file", response_model=DocumentOut, status_code=201)
async def import_file(
    body: ImportFileRequest,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> DocumentOut:
    file_id = UUID(body.file_id)
    f = await session.get(File, file_id)
    if f is None or f.owner_id != user.id:
        raise not_found("file")

    title = body.title or f.filename
    d = VaultDocument(
        owner_id=user.id,
        title=title,
        content_md=f"_Imported from {f.filename}._",
        content_type=body.content_type,
        source_file_id=file_id,
    )
    session.add(d)
    await session.commit()

    # Async: parse → chunk → embed → vault_chunks
    asyncio.create_task(ingest_file(
        file_id=file_id,
        target="vault_chunks",
        vault_document_id=d.id,
    ))
    return _doc_out(d)


# ---------- internal: re-embed on edit ----------


async def _reindex_then_enrich(doc_id: UUID, content_md: str) -> None:
    """Re-chunk + embed → auto-tag → auto-link. Each step survives the others."""
    await _reindex_document(doc_id, content_md)
    try:
        await auto_tag(doc_id)
    except Exception:
        from app.core.log import log
        log.exception("vault.auto_tag.dispatch.error", doc_id=str(doc_id))
    try:
        await auto_link(doc_id)
    except Exception:
        from app.core.log import log
        log.exception("vault.auto_link.dispatch.error", doc_id=str(doc_id))


async def _reindex_document(doc_id: UUID, content_md: str) -> None:
    """Naive re-index on edit: drop existing chunks, embed new ones."""
    if not content_md.strip():
        return
    try:
        from app.ingest.embed import embed_texts
        paragraphs = [p.strip() for p in content_md.split("\n\n") if p.strip()]
        if not paragraphs:
            return
        chunks: list[str] = []
        buf = ""
        for p in paragraphs:
            if len(buf) + len(p) + 2 > 1800:
                if buf:
                    chunks.append(buf.strip())
                buf = p
            else:
                buf = (buf + "\n\n" + p) if buf else p
        if buf:
            chunks.append(buf.strip())

        vectors = await embed_texts(chunks)

        async with SessionLocal() as session:
            await session.execute(
                text("DELETE FROM vault_chunks WHERE document_id = :doc_id"),
                {"doc_id": str(doc_id)},
            )
            for i, (c, v) in enumerate(zip(chunks, vectors, strict=True)):
                session.add(VaultChunk(
                    document_id=doc_id,
                    chunk_index=i,
                    text=c,
                    embedding=v,
                    token_count=max(1, len(c) // 4),
                ))
            await session.commit()
    except Exception:
        from app.core.log import log
        log.exception("vault.reindex.error", doc_id=str(doc_id))
