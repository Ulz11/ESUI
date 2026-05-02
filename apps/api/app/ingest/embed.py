"""Embedding orchestration — wraps Voyage with batching + retry."""

from __future__ import annotations

import asyncio

from app.core.log import log
from app.integrations.voyage import embed


async def embed_texts(texts: list[str], retries: int = 3) -> list[list[float]]:
    last_err: Exception | None = None
    for attempt in range(retries):
        try:
            return await embed(texts, input_type="document")
        except Exception as e:
            last_err = e
            log.warn("embed.retry", attempt=attempt, error=str(e))
            await asyncio.sleep(2**attempt)
    raise last_err  # type: ignore[misc]
