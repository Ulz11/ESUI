"""Voyage AI embeddings — voyage-3, 1024-dim, cosine."""

from __future__ import annotations

from typing import Literal

import voyageai

from app.core.config import settings

EMBED_MODEL = "voyage-3"
DIM = 1024

_client: voyageai.AsyncClient | None = None


def get_client() -> voyageai.AsyncClient:
    global _client
    if _client is None:
        _client = voyageai.AsyncClient(api_key=settings.voyage_api_key)
    return _client


async def embed(
    texts: list[str],
    *,
    input_type: Literal["query", "document"] = "document",
) -> list[list[float]]:
    """Batch-embed texts. Voyage handles up to 128 inputs per call.

    Use input_type='query' for retrieval queries; 'document' for stored chunks.
    """
    if not texts:
        return []
    client = get_client()
    out: list[list[float]] = []
    for i in range(0, len(texts), 64):
        batch = texts[i : i + 64]
        resp = await client.embed(batch, model=EMBED_MODEL, input_type=input_type)
        out.extend(resp.embeddings)
    return out


async def embed_one(text: str, *, input_type: Literal["query", "document"] = "document") -> list[float]:
    result = await embed([text], input_type=input_type)
    return result[0]
