"""Together — a clean, formal gallery.

Esui (or Badrushk) drops images and videos here. Each item is a `together_media`
row pointing at a `files` row. Optional caption + taken_at.

The composite/prompt machinery has been removed. This is a plain CRUD surface.
"""

from __future__ import annotations

import asyncio
import hashlib
import os
from datetime import datetime
from typing import Optional
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, File as F, Form, UploadFile
from pydantic import BaseModel
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import current_user, require_esui
from app.core.db import get_session
from app.core.errors import bad_request, not_found
from app.integrations import r2
from app.models import File, TogetherMedia, User

router = APIRouter(prefix="/together", tags=["together"])


# ---------- mime → kind ----------

_VIDEO_MIMES = {
    "video/mp4", "video/quicktime", "video/webm",
    "video/x-matroska", "video/x-msvideo",
}
_IMAGE_MIMES = {
    "image/png", "image/jpeg", "image/webp", "image/gif", "image/heic", "image/heif",
}

# Cap in-memory upload size. Bigger files would need multipart streaming;
# defer that until either user has a clip that hits the limit.
MAX_UPLOAD_BYTES = 200 * 1024 * 1024  # 200 MB


def _kind_for(mime: str) -> str:
    if mime in _IMAGE_MIMES:
        return "image"
    if mime in _VIDEO_MIMES:
        return "video"
    return "other"


# ---------- schemas ----------


class MediaOut(BaseModel):
    id: str
    file_id: str
    kind: str
    mime: str
    filename: str
    width: int | None = None
    height: int | None = None
    duration_sec: int | None = None
    caption: str | None
    taken_at: datetime | None
    added_by: str
    created_at: datetime
    # Signed URL pre-resolved at list/upload time so the frontend doesn't have
    # to round-trip per card. Valid ~10 min; clients should refresh on stale.
    url: str | None = None
    url_expires_in: int | None = None


def _media_out(m: TogetherMedia, f: File, *, url: str | None = None) -> MediaOut:
    return MediaOut(
        id=str(m.id),
        file_id=str(f.id),
        kind=f.kind,
        mime=f.mime,
        filename=f.filename,
        width=f.width,
        height=f.height,
        duration_sec=f.duration_sec,
        caption=m.caption,
        taken_at=m.taken_at,
        added_by=str(m.added_by),
        created_at=m.created_at,
        url=url,
        url_expires_in=600 if url else None,
    )


# ---------- endpoints ----------


@router.get("/media", response_model=list[MediaOut])
async def list_media(
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
    limit: int = 200,
) -> list[MediaOut]:
    """Shared gallery: both users see all media. Pre-signs each item's URL
    so the frontend renders the whole grid without per-card round-trips.
    """
    rows = await session.execute(
        select(TogetherMedia, File)
        .join(File, File.id == TogetherMedia.file_id)
        .order_by(desc(TogetherMedia.created_at))
        .limit(min(limit, 500))
    )
    pairs = list(rows.all())
    # Pre-sign in parallel.
    keys = [f.r2_key for (_, f) in pairs]
    urls = await asyncio.gather(*[r2.presign_get(k, expires_in=600) for k in keys])
    return [
        _media_out(m, f, url=url) for (m, f), url in zip(pairs, urls, strict=True)
    ]


@router.post("/media", response_model=MediaOut, status_code=201)
async def upload_media(
    file: UploadFile = F(...),
    caption: Optional[str] = Form(None),
    taken_at: Optional[datetime] = Form(None),
    user: User = Depends(require_esui),
    session: AsyncSession = Depends(get_session),
) -> MediaOut:
    """Drop an image or video into the gallery."""
    body = await file.read()
    if not body:
        raise bad_request("empty file")
    if len(body) > MAX_UPLOAD_BYTES:
        raise bad_request(
            f"file is too big — max {MAX_UPLOAD_BYTES // (1024 * 1024)} MB"
        )
    mime = file.content_type or "application/octet-stream"
    kind = _kind_for(mime)
    if kind == "other":
        raise bad_request(f"unsupported media type: {mime}")

    sha = hashlib.sha256(body).digest()

    # Reuse identical file by sha for the same owner.
    existing = (await session.execute(
        select(File).where(File.owner_id == user.id, File.sha256 == sha).limit(1)
    )).scalar_one_or_none()

    if existing is not None:
        f = existing
    else:
        file_id = uuid4()
        ext = os.path.splitext(file.filename or "")[1].lstrip(".")
        key = r2.build_key(user.id, file_id, ext)
        await r2.put_bytes(key, body, content_type=mime)
        f = File(
            id=file_id,
            owner_id=user.id,
            kind=kind,
            filename=file.filename or "upload",
            mime=mime,
            size_bytes=len(body),
            r2_key=key,
            sha256=sha,
            ingest_status="skipped",  # not chunked/embedded
        )
        session.add(f)
        await session.flush()

    media = TogetherMedia(
        file_id=f.id,
        caption=caption,
        taken_at=taken_at,
        added_by=user.id,
    )
    session.add(media)
    await session.commit()
    url = await r2.presign_get(f.r2_key, expires_in=600)
    return _media_out(media, f, url=url)


@router.patch("/media/{media_id}", response_model=MediaOut)
async def update_media(
    media_id: UUID,
    body: dict[str, str | None],
    user: User = Depends(require_esui),
    session: AsyncSession = Depends(get_session),
) -> MediaOut:
    m = await session.get(TogetherMedia, media_id)
    if m is None:
        raise not_found("media")
    if "caption" in body:
        m.caption = body["caption"]
    if "taken_at" in body and body["taken_at"]:
        try:
            m.taken_at = datetime.fromisoformat(body["taken_at"])
        except ValueError:
            pass
    await session.commit()
    f = await session.get(File, m.file_id)
    return _media_out(m, f)  # type: ignore[arg-type]


@router.delete("/media/{media_id}", status_code=204)
async def delete_media(
    media_id: UUID,
    user: User = Depends(require_esui),
    session: AsyncSession = Depends(get_session),
) -> None:
    m = await session.get(TogetherMedia, media_id)
    if m is None:
        raise not_found("media")
    file_id = m.file_id
    await session.delete(m)
    await session.commit()

    # Also clean up the underlying file if no other media row references it.
    f = await session.get(File, file_id)
    if f is not None:
        ref = await session.execute(
            select(TogetherMedia).where(TogetherMedia.file_id == file_id).limit(1)
        )
        if ref.scalar_one_or_none() is None:
            r2_key = f.r2_key
            await session.delete(f)
            await session.commit()
            asyncio.create_task(_safe_r2_delete(r2_key))


@router.post("/media/{media_id}/url", response_model=dict[str, str | int])
async def media_signed_url(
    media_id: UUID,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> dict[str, str | int]:
    """Issue a signed GET URL (10 min) for streaming the original."""
    m = await session.get(TogetherMedia, media_id)
    if m is None:
        raise not_found("media")
    f = await session.get(File, m.file_id)
    if f is None:
        raise not_found("file")
    url = await r2.presign_get(f.r2_key, expires_in=600)
    return {"url": url, "expires_in": 600}


async def _safe_r2_delete(key: str) -> None:
    try:
        await r2.delete(key)
    except Exception:
        pass
