"""Daily per-user cost cap.

Tracks today's $-spent in Redis. Before each chat call, we check whether
the user has crossed `settings.daily_cost_cap_usd`. If yes, we do NOT block
— we downgrade to Sonnet (or stay on Sonnet if already there) so the
experience remains smooth, and we emit a calm system notice the first time
the cap is crossed today.

We accept rough $-per-call estimates; the precise cost is logged after the
call in `ai_calls`.
"""

from __future__ import annotations

import time
from uuid import UUID

from app.core.config import settings
from app.core.redis import get_redis

# Per-1M-token prices in USD (approximate). Tune as provider pricing moves.
_PRICES: dict[str, tuple[float, float]] = {
    # Anthropic
    "opus":                  (15.0, 75.0),
    "sonnet":                (3.0, 15.0),
    "haiku":                 (1.0, 5.0),
    # Google
    "gemini":                (3.5, 10.5),
    # Perplexity Sonar
    "perplexity-research":   (5.0, 25.0),   # deep research is expensive
    "perplexity-reasoning":  (3.0, 15.0),
}


def _today_key(user_id: UUID) -> str:
    day = time.strftime("%Y-%m-%d", time.gmtime())
    return f"cost:daily:{user_id}:{day}"


def _notice_key(user_id: UUID) -> str:
    day = time.strftime("%Y-%m-%d", time.gmtime())
    return f"cost:notice_sent:{user_id}:{day}"


def estimate_cost_usd(model: str, tokens_in: int, tokens_out: int) -> float:
    p_in, p_out = _PRICES.get(model, (3.0, 15.0))
    return (tokens_in / 1_000_000) * p_in + (tokens_out / 1_000_000) * p_out


async def add_cost(user_id: UUID, usd: float) -> float:
    """Increment today's cost; return cumulative."""
    if usd <= 0:
        return 0.0
    redis = get_redis()
    key = _today_key(user_id)
    new = await redis.incrbyfloat(key, usd)
    await redis.expire(key, 36 * 3600)  # ttl > 1 day so timezone slop is fine
    return float(new)


async def get_today_cost(user_id: UUID) -> float:
    redis = get_redis()
    raw = await redis.get(_today_key(user_id))
    try:
        return float(raw) if raw else 0.0
    except ValueError:
        return 0.0


async def is_capped(user_id: UUID) -> bool:
    return (await get_today_cost(user_id)) >= settings.daily_cost_cap_usd


async def consume_notice(user_id: UUID) -> bool:
    """Return True if THIS call should emit the cap-crossed notice (once/day)."""
    redis = get_redis()
    key = _notice_key(user_id)
    # SETNX-style: returns 1 only the first time today.
    return bool(await redis.set(key, "1", nx=True, ex=36 * 3600))
