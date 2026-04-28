"""Remove.bg API client — strip background to PNG with alpha."""

from __future__ import annotations

import httpx

from app.core.config import settings


async def remove_background(image_bytes: bytes) -> bytes:
    """Returns PNG bytes with transparent background."""
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(
            "https://api.remove.bg/v1.0/removebg",
            headers={"X-Api-Key": settings.remove_bg_api_key},
            files={"image_file": ("image.png", image_bytes)},
            data={"size": "auto", "format": "png"},
        )
        resp.raise_for_status()
        return resp.content
