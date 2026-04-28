"""Semantic chunker — turns parsed blocks into ~512-token chunks.

Approach: greedy aggregation by token estimate (4 chars/token), respecting
sentence boundaries and section-path attribution. Adds a 64-token overlap
between consecutive chunks of the same section.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

from app.integrations.unstructured import ParsedBlock

TARGET_TOKENS = 512
MAX_TOKENS = 768
OVERLAP_TOKENS = 64

# rough split on sentence terminators that survive most languages decently
_SENTENCE_RE = re.compile(r"(?<=[.!?])\s+")


@dataclass
class Chunk:
    text: str
    token_count: int
    section_path: str | None
    page_start: int | None
    page_end: int | None


def estimate_tokens(text: str) -> int:
    return max(1, len(text) // 4)


def chunk_blocks(blocks: list[ParsedBlock]) -> list[Chunk]:
    if not blocks:
        return []

    # Group sentences with their (section_path, page) so chunks stay coherent.
    sentences: list[tuple[str, str | None, int | None]] = []
    for b in blocks:
        for s in _SENTENCE_RE.split(b.text):
            s = s.strip()
            if s:
                sentences.append((s, b.section_path, b.page_number))

    chunks: list[Chunk] = []
    buf: list[tuple[str, str | None, int | None]] = []
    buf_tokens = 0

    def flush() -> None:
        nonlocal buf, buf_tokens
        if not buf:
            return
        text = " ".join(s for s, _, _ in buf)
        sec = next((sp for _, sp, _ in buf if sp), None)
        pages = [p for _, _, p in buf if p is not None]
        chunks.append(Chunk(
            text=text,
            token_count=estimate_tokens(text),
            section_path=sec,
            page_start=min(pages) if pages else None,
            page_end=max(pages) if pages else None,
        ))
        # Build overlap tail (last N tokens worth of sentences)
        tail: list[tuple[str, str | None, int | None]] = []
        tail_tokens = 0
        for sent in reversed(buf):
            ttok = estimate_tokens(sent[0])
            if tail_tokens + ttok > OVERLAP_TOKENS:
                break
            tail.append(sent)
            tail_tokens += ttok
        tail.reverse()
        buf = tail
        buf_tokens = sum(estimate_tokens(s) for s, _, _ in buf)

    for sent in sentences:
        stoks = estimate_tokens(sent[0])
        if buf_tokens + stoks > MAX_TOKENS:
            flush()
        buf.append(sent)
        buf_tokens += stoks
        if buf_tokens >= TARGET_TOKENS:
            flush()
    flush()
    # Drop the artificial trailing overlap-only chunk if any
    return [c for c in chunks if c.token_count >= 16]
