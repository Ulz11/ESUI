"""Together Photos composite worker.

Orchestrates: pick Badrushk photo → scene prompt (Sonnet) → Remove.bg both →
Stability scene → PIL composite → R2 upload → DB update → emit event.
"""

from __future__ import annotations

import random
from datetime import datetime, timezone
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import SessionLocal
from app.core.log import log
from app.integrations import r2, removebg, stability
from app.integrations.anthropic import MODEL_IDS, get_client
from app.models import File, TogetherPhoto, User


SCENE_SYSTEM = """You write 1-2 sentence cinematic scene descriptions for a
photo of a couple together. Output ONE compact scene only, photorealistic,
warm-toned, natural lighting. Do not describe the people. Avoid clichés."""


async def compose_together_photo(*, photo_id: UUID, esui_id: UUID, badrushk_id: UUID) -> None:
    """Run the full composite pipeline. Idempotent on success.

    The supplied photo_id row must already have esui_photo_file_id set; we
    pick a Badrushk eligible photo here and finish the pipeline.
    """
    try:
        async with SessionLocal() as session:
            photo = await session.get(TogetherPhoto, photo_id)
            if photo is None or photo.status == "ready":
                return
            esui_file = await session.get(File, photo.esui_photo_file_id)
            if esui_file is None:
                _set_failed(session, photo, "esui photo missing")
                await session.commit()
                return

            # Pick a Badrushk photo
            badrushk_photos = (await session.execute(
                select(File).where(
                    File.owner_id == badrushk_id,
                    File.together_eligible.is_(True),
                    File.kind == "image",
                )
            )).scalars().all()
            if not badrushk_photos:
                _set_failed(session, photo, "no eligible Badrushk photos")
                await session.commit()
                return
            badrushk_file = random.choice(badrushk_photos)

            photo.badrushk_photo_file_id = badrushk_file.id
            photo.status = "removing_bg"
            await session.commit()

        # Download both originals
        esui_bytes = await r2.get_bytes(esui_file.r2_key)
        badrushk_bytes = await r2.get_bytes(badrushk_file.r2_key)

        # Background removal in parallel
        import asyncio as _a
        esui_cut, badrushk_cut = await _a.gather(
            removebg.remove_background(esui_bytes),
            removebg.remove_background(badrushk_bytes),
        )

        # Save intermediates
        await r2.put_bytes(
            f"together/intermediates/{photo_id}/esui_nobg.png",
            esui_cut, "image/png",
        )
        await r2.put_bytes(
            f"together/intermediates/{photo_id}/badrushk_nobg.png",
            badrushk_cut, "image/png",
        )

        # Scene prompt (Sonnet)
        scene_prompt = await _generate_scene_prompt()

        async with SessionLocal() as session:
            photo = await session.get(TogetherPhoto, photo_id)
            if photo:
                photo.status = "composing"
                photo.scene_prompt = scene_prompt
                await session.commit()

        # Stability AI background scene
        scene_png = await stability.generate_scene(
            f"{scene_prompt} photorealistic candid photograph, natural light"
        )

        # PIL composite
        composite_png = stability.composite_subjects_on_scene(
            scene_png, esui_cut, badrushk_cut
        )

        # Upload final
        composite_file_id = uuid4()
        composite_key = f"together/composites/{photo_id}.png"
        await r2.put_bytes(composite_key, composite_png, "image/png")

        async with SessionLocal() as session:
            f = File(
                id=composite_file_id,
                owner_id=esui_id,
                kind="image",
                filename=f"together-{photo_id}.png",
                mime="image/png",
                size_bytes=len(composite_png),
                r2_key=composite_key,
                sha256=_sha(composite_png),
                ingest_status="skipped",
            )
            session.add(f)
            photo = await session.get(TogetherPhoto, photo_id)
            if photo:
                photo.composite_file_id = composite_file_id
                photo.status = "ready"
                photo.ready_at = datetime.now(tz=timezone.utc)
            await session.commit()

        log.info("together.composite.ready", photo_id=str(photo_id))

    except Exception as e:
        log.exception("together.composite.error", photo_id=str(photo_id), error=str(e))
        async with SessionLocal() as session:
            photo = await session.get(TogetherPhoto, photo_id)
            if photo:
                _set_failed(session, photo, str(e)[:500])
                await session.commit()


# ---------- helpers ----------


def _set_failed(session: AsyncSession, photo: TogetherPhoto, error: str) -> None:
    photo.status = "failed"
    photo.error = error


async def _generate_scene_prompt() -> str:
    client = get_client()
    resp = await client.messages.create(
        model=MODEL_IDS["sonnet"],
        max_tokens=120,
        temperature=0.95,
        system=SCENE_SYSTEM,
        messages=[{"role": "user", "content": "Generate one scene."}],
    )
    text = "".join(b.text for b in resp.content if getattr(b, "type", "") == "text")
    return text.strip() or "A quiet sunlit afternoon in a sunlit garden, warm golden hour."


def _sha(b: bytes) -> bytes:
    import hashlib
    return hashlib.sha256(b).digest()
