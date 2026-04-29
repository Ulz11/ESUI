"""Perplexity Sonar client (HTTP/SSE, OpenAI-compatible).

Used for: deep-research and reasoning queries. Sonar models bring native web
search + citation. We expose two aliases:
  - 'perplexity-research'  → settings.perplexity_research_model_id (deep, slow)
  - 'perplexity-reasoning' → settings.perplexity_reasoning_model_id (fast thinking)

Streams in the same StreamChunk shape as integrations/anthropic.py.
"""

from __future__ import annotations

import json
from collections.abc import AsyncIterator
from typing import Any, Literal

import httpx

from app.core.config import settings
from app.integrations.anthropic import StreamChunk

PERPLEXITY_BASE = "https://api.perplexity.ai"

PerplexityAlias = Literal["perplexity-research", "perplexity-reasoning"]


def model_id_for(alias: PerplexityAlias) -> str:
    if alias == "perplexity-research":
        return settings.perplexity_research_model_id
    return settings.perplexity_reasoning_model_id


def _to_oai_messages(
    system: str, messages: list[dict[str, Any]]
) -> list[dict[str, str]]:
    """Anthropic-shape messages → OpenAI-shape messages with system prepended."""
    out: list[dict[str, str]] = [{"role": "system", "content": system}]
    for m in messages:
        role = m.get("role", "user")
        content = m.get("content", "")
        if isinstance(content, list):
            text = "\n\n".join(
                b.get("text", "") for b in content if b.get("type") == "text"
            )
        else:
            text = content
        if text:
            out.append({"role": role, "content": text})
    return out


async def stream_chat(
    *,
    alias: PerplexityAlias,
    system: str,
    messages: list[dict[str, Any]],
    temperature: float = 0.4,
    max_tokens: int = 4096,
    return_citations: bool = True,
) -> AsyncIterator[StreamChunk]:
    """Stream Sonar response. Citations arrive as `tool_use:cite` chunks at end."""
    url = f"{PERPLEXITY_BASE}/chat/completions"
    headers = {
        "Authorization": f"Bearer {settings.perplexity_api_key}",
        "Content-Type": "application/json",
    }
    body = {
        "model": model_id_for(alias),
        "messages": _to_oai_messages(system, messages),
        "temperature": temperature,
        "max_tokens": max_tokens,
        "stream": True,
        "return_citations": return_citations,
    }

    tokens_in = tokens_out = 0
    citations: list[str] = []

    async with httpx.AsyncClient(timeout=300) as client:
        async with client.stream("POST", url, json=body, headers=headers) as resp:
            resp.raise_for_status()
            async for line in resp.aiter_lines():
                if not line:
                    continue
                if line.startswith("data: "):
                    payload = line[6:].strip()
                else:
                    payload = line.strip()
                if not payload or payload == "[DONE]":
                    continue
                try:
                    data = json.loads(payload)
                except json.JSONDecodeError:
                    continue

                # Text deltas
                for choice in data.get("choices", []):
                    delta = choice.get("delta", {})
                    text = delta.get("content", "")
                    if text:
                        yield StreamChunk(kind="text", text=text)

                # Citations (Perplexity emits an array on early/final chunks)
                for url_ in data.get("citations", []) or []:
                    if url_ and url_ not in citations:
                        citations.append(url_)

                # Usage (only on the final chunk for OpenAI-compat streams)
                usage = data.get("usage") or {}
                if usage:
                    tokens_in = usage.get("prompt_tokens", tokens_in) or 0
                    tokens_out = usage.get("completion_tokens", tokens_out) or 0

    for u in citations:
        yield StreamChunk(kind="tool_use", tool_name="cite", tool_input={"url": u})

    yield StreamChunk(
        kind="complete",
        tokens_in=tokens_in,
        tokens_out=tokens_out,
    )


async def complete(
    *,
    alias: PerplexityAlias,
    system: str,
    messages: list[dict[str, Any]],
    temperature: float = 0.3,
    max_tokens: int = 2048,
    return_citations: bool = True,
) -> tuple[str, list[str], int, int]:
    """Non-streaming. Returns (text, citations, tokens_in, tokens_out)."""
    url = f"{PERPLEXITY_BASE}/chat/completions"
    headers = {
        "Authorization": f"Bearer {settings.perplexity_api_key}",
        "Content-Type": "application/json",
    }
    body = {
        "model": model_id_for(alias),
        "messages": _to_oai_messages(system, messages),
        "temperature": temperature,
        "max_tokens": max_tokens,
        "return_citations": return_citations,
    }
    async with httpx.AsyncClient(timeout=300) as client:
        resp = await client.post(url, json=body, headers=headers)
        resp.raise_for_status()
        data = resp.json()

    choices = data.get("choices") or []
    text = choices[0]["message"]["content"] if choices else ""
    citations = list(data.get("citations") or [])
    usage = data.get("usage") or {}
    return (
        text,
        citations,
        usage.get("prompt_tokens", 0) or 0,
        usage.get("completion_tokens", 0) or 0,
    )
