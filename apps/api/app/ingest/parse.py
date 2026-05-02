"""End-to-end ingest: download → parse → chunk → embed → persist.

Dispatch target via `target`:
  - 'file_chunks'  → for chat-attached files; chunks belong to the file
  - 'vault_chunks' → for vault import; chunks belong to a vault_document

Emits Socket.io progress events on the `/system` ASGI channel via the supplied
emit closure (caller passes `sio.emit` bound to the user's room).
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from typing import Any, Literal
from uuid import UUID

from app.core.db import SessionLocal
from app.core.log import log
from app.ingest.chunk import chunk_blocks
from app.ingest.embed import embed_texts
from app.integrations import r2, unstructured
from app.models import File, FileChunk, VaultChunk

EmitFn = Callable[[str, dict[str, Any]], Awaitable[None]]
Target = Literal["file_chunks", "vault_chunks"]


async def ingest_file(
    *,
    file_id: UUID,
    target: Target = "file_chunks",
    vault_document_id: UUID | None = None,
    emit: EmitFn | None = None,
) -> None:
    """Run the full ingest pipeline for one file. Idempotent on success."""

    async def _emit(step: str, percent: int) -> None:
        if emit is None:
            return
        try:
            await emit("ingest:progress", {
                "file_id": str(file_id), "step": step, "percent": percent,
            })
        except Exception:
            pass  # Non-fatal; logging only.

    async with SessionLocal() as session:
        f = await session.get(File, file_id)
        if f is None:
            log.warn("ingest.missing_file", file_id=str(file_id))
            return
        if f.ingest_status == "ready":
            return  # idempotent

        f.ingest_status = "processing"
        await session.commit()

    await _emit("downloading", 5)

    try:
        body = await r2.get_bytes(f.r2_key)
        await _emit("parsing", 20)

        blocks = await unstructured.parse(body, f.filename)
        if not blocks:
            await _set_status(file_id, "skipped", "no parseable content")
            await _emit("complete", 100)
            return

        await _emit("chunking", 40)
        chunks = chunk_blocks(blocks)
        if not chunks:
            await _set_status(file_id, "skipped", "no chunks produced")
            await _emit("complete", 100)
            return

        await _emit("embedding", 60)
        vectors = await embed_texts([c.text for c in chunks])

        await _emit("persisting", 90)
        async with SessionLocal() as session:
            if target == "file_chunks":
                for i, (c, v) in enumerate(zip(chunks, vectors, strict=True)):
                    session.add(FileChunk(
                        file_id=file_id,
                        chunk_index=i,
                        text=c.text,
                        section_path=c.section_path,
                        page_start=c.page_start,
                        page_end=c.page_end,
                        embedding=v,
                        token_count=c.token_count,
                    ))
            else:
                if vault_document_id is None:
                    raise ValueError("vault_document_id required for vault target")
                for i, (c, v) in enumerate(zip(chunks, vectors, strict=True)):
                    session.add(VaultChunk(
                        document_id=vault_document_id,
                        chunk_index=i,
                        text=c.text,
                        embedding=v,
                        token_count=c.token_count,
                    ))
            await session.commit()

        await _set_status(file_id, "ready", None)
        await _emit("complete", 100)

    except Exception as e:
        log.exception("ingest.error", file_id=str(file_id), error=str(e))
        await _set_status(file_id, "failed", str(e)[:500])
        if emit:
            await emit("ingest:error", {"file_id": str(file_id), "error": str(e)})


async def _set_status(file_id: UUID, status: str, error: str | None) -> None:
    async with SessionLocal() as session:
        f = await session.get(File, file_id)
        if f is None:
            return
        f.ingest_status = status
        f.ingest_error = error
        await session.commit()
