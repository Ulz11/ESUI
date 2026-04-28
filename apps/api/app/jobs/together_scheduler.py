"""Together prompt scheduler.

Every 15 minutes the scheduler decides whether to surface a soft "want a
photo together?" prompt to Esui. The decision uses Redis-tracked presence
so we only interrupt during low-intensity sessions.

Conditions (ALL must hold):
  - Esui is active (presence:active set in last 30 min)
  - Esui is NOT currently in /exam (presence:in_exam not set)
  - last chat send was ≥ 90 s ago (or never)
  - last upload was ≥ 5 min ago (or never)
  - cooldown not set (together:cooldown:<esui_id>)
  - ≥ 3 unused Badrushk eligible photos exist
  - 30% probability roll
"""

from __future__ import annotations

import random

from sqlalchemy import select

from app.core.db import SessionLocal
from app.core.log import log
from app.core.redis import get_redis
from app.models import File, TogetherPrompt, User
from app.realtime.presence import (
    is_active,
    is_in_exam,
    seconds_since_chat,
    seconds_since_upload,
)

COOLDOWN_SEC = 6 * 60 * 60
PROMPT_PROBABILITY = 0.30
MIN_ELIGIBLE_PHOTOS = 3
MIN_QUIET_CHAT_SEC = 90
MIN_QUIET_UPLOAD_SEC = 300


async def maybe_surface_prompt() -> None:
    redis = get_redis()

    async with SessionLocal() as session:
        esui = (await session.execute(
            select(User).where(User.role == "esui").limit(1)
        )).scalar_one_or_none()
        if esui is None:
            return

        cooldown_key = f"together:cooldown:{esui.id}"
        if await redis.get(cooldown_key):
            return

        if not await is_active(esui.id):
            return  # she's not even here
        if await is_in_exam(esui.id):
            return  # respect deep work

        sec_chat = await seconds_since_chat(esui.id)
        if sec_chat is not None and sec_chat < MIN_QUIET_CHAT_SEC:
            return
        sec_upload = await seconds_since_upload(esui.id)
        if sec_upload is not None and sec_upload < MIN_QUIET_UPLOAD_SEC:
            return

        badrushk = (await session.execute(
            select(User).where(User.role == "badrushk").limit(1)
        )).scalar_one_or_none()
        if badrushk is None:
            return

        eligible = (await session.execute(
            select(File).where(
                File.owner_id == badrushk.id,
                File.kind == "image",
                File.together_eligible.is_(True),
            )
        )).scalars().all()
        if len(eligible) < MIN_ELIGIBLE_PHOTOS:
            return

        if random.random() > PROMPT_PROBABILITY:
            return

        prompt = TogetherPrompt(shown_to_user=esui.id)
        session.add(prompt)
        await session.commit()
        prompt_id = prompt.id
        shown_at = prompt.shown_at

    await redis.setex(cooldown_key, COOLDOWN_SEC, "1")

    try:
        from app.main import sio
        await sio.emit("prompt:appear", {
            "prompt_id": str(prompt_id),
            "shown_at": shown_at.isoformat() if shown_at else None,
        })
    except Exception:
        pass

    log.info("together.prompt.surfaced", prompt_id=str(prompt_id))
