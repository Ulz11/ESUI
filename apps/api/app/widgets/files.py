"""File upload + signed-URL endpoints."""

from __future__ import annotations

import asyncio
import hashlib
import os
from datetime import datetime
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, File as F, HTTPException, UploadFile, status
from pydantic import BaseModel
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import require_esui
from app.core.db import get_session
from app.core.errors import not_found
from app.integrations import r2
from app.models import File, User
from app.realtime.presence import touch_upload

router = APIRouter(prefix="/files", tags=["files"])


# Mapping of mime → file kind
_KIND_BY_MIME = {
    "application/pdf": "pdf",
    "image/png": "image",
    "image/jpeg": "image",
    "image/webp": "image",
    "image/gif": "image",
    "image/heic": "image",
    "image/heif": "image",
    "audio/mpeg": "audio",
    "audio/wav": "audio",
    "audio/x-wav": "audio",
    "audio/mp4": "audio",
    "audio/m4a": "audio",
    "video/mp4": "video",
    "video/quicktime": "video",
    "video/webm": "video",
    "video/x-matroska": "video",
    "video/x-msvideo": "video",
}

_DOC_MIMES = {
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
    "text/markdown",
}


def _kind_for(mime: str) -> str:
    if mime in _KIND_BY_MIME:
        return _KIND_BY_MIME[mime]
    if mime in _DOC_MIMES:
        return "doc"
    return "other"


class FileOut(BaseModel):
    id: str
    owner_id: str
    kind: str
    filename: str
    mime: str
    size_bytes: int
    width: int | None = None
    height: int | None = None
    ingest_status: str
    created_at: datetime


def _file_out(f: File) -> FileOut:
    return FileOut(
        id=str(f.id),
        owner_id=str(f.owner_id),
        kind=f.kind,
        filename=f.filename,
        mime=f.mime,
        size_bytes=f.size_bytes,
        width=f.width,
        height=f.height,
        ingest_status=f.ingest_status,
        created_at=f.created_at,
    )


# ---------- upload ----------


@router.post("", response_model=FileOut, status_code=201)
async def upload_file(
    file: UploadFile = F(...),
    user: User = Depends(require_esui),
    session: AsyncSession = Depends(get_session),
) -> FileOut:
    body = await file.read()
    if not body:
        raise HTTPException(400, "empty file")
    # Cap general uploads at 100 MB; documents are typically much smaller.
    # Together gallery has its own (larger) cap for video.
    if len(body) > 100 * 1024 * 1024:
        raise HTTPException(400, "file is too big — max 100 MB")
    sha = hashlib.sha256(body).digest()
    mime = file.content_type or "application/octet-stream"

    # Reuse existing row on identical sha for the same owner.
    existing = await session.execute(
        select(File).where(File.owner_id == user.id, File.sha256 == sha).limit(1)
    )
    e = existing.scalar_one_or_none()
    if e is not None:
        return _file_out(e)

    file_id = uuid4()
    ext = os.path.splitext(file.filename or "")[1].lstrip(".")
    key = r2.build_key(user.id, file_id, ext)

    await r2.put_bytes(key, body, content_type=mime)

    f = File(
        id=file_id,
        owner_id=user.id,
        kind=_kind_for(mime),
        filename=file.filename or "upload",
        mime=mime,
        size_bytes=len(body),
        r2_key=key,
        sha256=sha,
        ingest_status="pending",
    )
    session.add(f)
    await session.commit()
    await touch_upload(user.id)
    return _file_out(f)


# ---------- metadata + signed url ----------


@router.get("/{file_id}", response_model=FileOut)
async def get_file(
    file_id: UUID,
    user: User = Depends(require_esui),
    session: AsyncSession = Depends(get_session),
) -> FileOut:
    f = await session.get(File, file_id)
    if f is None or f.owner_id != user.id:
        raise not_found("file")
    return _file_out(f)


class SignedUrlOut(BaseModel):
    signed_url: str
    expires_in: int = 600


@router.post("/{file_id}/url", response_model=SignedUrlOut)
async def signed_url(
    file_id: UUID,
    user: User = Depends(require_esui),
    session: AsyncSession = Depends(get_session),
) -> SignedUrlOut:
    f = await session.get(File, file_id)
    if f is None or f.owner_id != user.id:
        raise not_found("file")
    url = await r2.presign_get(f.r2_key, expires_in=600)
    return SignedUrlOut(signed_url=url, expires_in=600)


@router.delete("/{file_id}", status_code=204)
async def delete_file(
    file_id: UUID,
    user: User = Depends(require_esui),
    session: AsyncSession = Depends(get_session),
) -> None:
    f = await session.get(File, file_id)
    if f is None or f.owner_id != user.id:
        raise not_found("file")
    key = f.r2_key
    await session.delete(f)
    await session.commit()
    asyncio.create_task(_safe_r2_delete(key))


@router.get("", response_model=list[FileOut])
async def list_files(
    user: User = Depends(require_esui),
    session: AsyncSession = Depends(get_session),
    kind: str | None = None,
    limit: int = 50,
) -> list[FileOut]:
    q = select(File).where(File.owner_id == user.id)
    if kind:
        q = q.where(File.kind == kind)
    q = q.order_by(desc(File.created_at)).limit(min(limit, 200))
    rows = await session.execute(q)
    return [_file_out(f) for f in rows.scalars().all()]


async def _safe_r2_delete(key: str) -> None:
    try:
        await r2.delete(key)
    except Exception:
        pass
