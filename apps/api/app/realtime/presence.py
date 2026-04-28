"""Presence + activity tracking via Redis.

Used by the Together prompt scheduler to determine "low-intensity session":
  - presence:active:<user_id>     — any user-driven event in last 30 min
  - presence:last_chat:<user_id>  — last chat send timestamp
  - presence:last_upload:<user_id>— last file upload timestamp
  - presence:in_exam:<user_id>    — flag while focused on /exam (60s TTL refreshed)
"""

from __future__ import annotations

import time
from uuid import UUID

from app.core.redis import get_redis

ACTIVE_TTL = 30 * 60   # 30 min
EXAM_TTL = 60          # refresh while present


async def touch_active(user_id: UUID) -> None:
    redis = get_redis()
    await redis.setex(f"presence:active:{user_id}", ACTIVE_TTL, str(int(time.time())))


async def touch_chat(user_id: UUID) -> None:
    redis = get_redis()
    now = str(int(time.time()))
    await redis.setex(f"presence:last_chat:{user_id}", ACTIVE_TTL, now)
    await redis.setex(f"presence:active:{user_id}", ACTIVE_TTL, now)


async def touch_upload(user_id: UUID) -> None:
    redis = get_redis()
    now = str(int(time.time()))
    await redis.setex(f"presence:last_upload:{user_id}", ACTIVE_TTL, now)
    await redis.setex(f"presence:active:{user_id}", ACTIVE_TTL, now)


async def touch_in_exam(user_id: UUID) -> None:
    redis = get_redis()
    await redis.setex(f"presence:in_exam:{user_id}", EXAM_TTL, "1")


async def is_active(user_id: UUID) -> bool:
    redis = get_redis()
    return bool(await redis.get(f"presence:active:{user_id}"))


async def is_in_exam(user_id: UUID) -> bool:
    redis = get_redis()
    return bool(await redis.get(f"presence:in_exam:{user_id}"))


async def seconds_since_chat(user_id: UUID) -> int | None:
    redis = get_redis()
    raw = await redis.get(f"presence:last_chat:{user_id}")
    if not raw:
        return None
    try:
        return int(time.time()) - int(raw)
    except ValueError:
        return None


async def seconds_since_upload(user_id: UUID) -> int | None:
    redis = get_redis()
    raw = await redis.get(f"presence:last_upload:{user_id}")
    if not raw:
        return None
    try:
        return int(time.time()) - int(raw)
    except ValueError:
        return None
