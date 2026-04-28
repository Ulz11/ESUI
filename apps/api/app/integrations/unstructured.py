"""unstructured.io API client — parse PDFs/Word/etc into sectioned blocks."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import httpx

from app.core.config import settings


@dataclass
class ParsedBlock:
    text: str
    type: str               # 'NarrativeText' | 'Title' | 'ListItem' | ...
    page_number: int | None
    section_path: str | None  # built from preceding Title elements


async def parse(file_bytes: bytes, filename: str) -> list[ParsedBlock]:
    """Parse a document into ordered blocks with section path attribution.

    Strategy: 'fast' for everything < 5MB; 'hi_res' otherwise (tables/figures).
    """
    strategy = "hi_res" if len(file_bytes) > 5 * 1024 * 1024 else "fast"

    async with httpx.AsyncClient(timeout=180) as client:
        resp = await client.post(
            f"{settings.unstructured_api_url}/general/v0/general",
            headers={"unstructured-api-key": settings.unstructured_api_key},
            files={"files": (filename, file_bytes)},
            data={"strategy": strategy, "languages": "eng"},
        )
        resp.raise_for_status()
        elements: list[dict[str, Any]] = resp.json()

    return _attach_section_paths(elements)


def _attach_section_paths(elements: list[dict[str, Any]]) -> list[ParsedBlock]:
    out: list[ParsedBlock] = []
    section_stack: list[str] = []

    for el in elements:
        etype = el.get("type", "")
        text = el.get("text", "").strip()
        if not text:
            continue
        page = el.get("metadata", {}).get("page_number")

        if etype == "Title":
            # Reset section stack at each new title (simple v1 model)
            section_stack = [text]
            continue

        path = " > ".join(section_stack) if section_stack else None
        out.append(ParsedBlock(text=text, type=etype, page_number=page, section_path=path))

    return out
