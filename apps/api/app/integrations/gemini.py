"""Google Gemini client (HTTP/SSE).

Used for: chat turns where the user's intent is `market_research` (web grounding),
and for any task that benefits from Google's grounding tool. Streams in the same
StreamChunk shape as integrations/anthropic.py so the dispatcher is provider-agnostic.

Model IDs are read from settings (`gemini_model_id`) so new releases land via
env var.
"""

from __future__ import annotations

import json
from collections.abc import AsyncIterator
from typing import Any

import httpx

from app.core.config import settings
from app.integrations.anthropic import StreamChunk

GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta"


def model_id() -> str:
    return settings.gemini_model_id


def _to_gemini_messages(messages: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Anthropic-style messages → Gemini contents.

    Anthropic input items look like:
      { role: 'user'|'assistant', content: [{type:'text', text:'...'}] }
    Gemini wants:
      { role: 'user'|'model', parts: [{text: '...'}] }
    """
    out: list[dict[str, Any]] = []
    for m in messages:
        role = "model" if m.get("role") == "assistant" else "user"
        parts: list[dict[str, str]] = []
        content = m.get("content", "")
        if isinstance(content, str):
            parts.append({"text": content})
        else:
            for block in content:
                if block.get("type") == "text":
                    parts.append({"text": block.get("text", "")})
        if not parts:
            continue
        out.append({"role": role, "parts": parts})
    return out


async def stream_chat(
    *,
    system: str,
    messages: list[dict[str, Any]],
    temperature: float = 0.7,
    max_tokens: int = 4096,
    web_grounding: bool = True,
) -> AsyncIterator[StreamChunk]:
    """Stream Gemini text. Optionally enables Google Search grounding."""
    url = (
        f"{GEMINI_BASE}/models/{model_id()}:streamGenerateContent"
        f"?key={settings.google_api_key}&alt=sse"
    )
    body: dict[str, Any] = {
        "contents": _to_gemini_messages(messages),
        "systemInstruction": {"parts": [{"text": system}]},
        "generationConfig": {
            "temperature": temperature,
            "maxOutputTokens": max_tokens,
        },
    }
    if web_grounding:
        body["tools"] = [{"google_search": {}}]

    tokens_in = tokens_out = 0
    citations: list[str] = []

    async with httpx.AsyncClient(timeout=180) as client:
        async with client.stream("POST", url, json=body) as resp:
            resp.raise_for_status()
            async for line in resp.aiter_lines():
                if not line or not line.startswith("data: "):
                    continue
                payload = line[6:].strip()
                if not payload:
                    continue
                try:
                    data = json.loads(payload)
                except json.JSONDecodeError:
                    continue

                # Text deltas
                for cand in data.get("candidates", []):
                    for part in cand.get("content", {}).get("parts", []):
                        text = part.get("text", "")
                        if text:
                            yield StreamChunk(kind="text", text=text)
                    # Grounding citations (URLs from Google Search)
                    grounding = cand.get("groundingMetadata", {})
                    for ref in grounding.get("groundingChunks", []):
                        url_ = ref.get("web", {}).get("uri")
                        if url_ and url_ not in citations:
                            citations.append(url_)
                            yield StreamChunk(kind="text", text="")  # no-op tick
                # Usage (only on the final chunk)
                usage = data.get("usageMetadata") or {}
                if usage:
                    tokens_in = usage.get("promptTokenCount", tokens_in) or 0
                    tokens_out = usage.get("candidatesTokenCount", tokens_out) or 0

    # Emit a single citations pseudo-chunk if any landed.
    for u in citations:
        yield StreamChunk(kind="tool_use", tool_name="cite", tool_input={"url": u})

    yield StreamChunk(
        kind="complete",
        tokens_in=tokens_in,
        tokens_out=tokens_out,
    )


async def complete(
    *,
    system: str,
    messages: list[dict[str, Any]],
    temperature: float = 0.5,
    max_tokens: int = 1024,
    web_grounding: bool = True,
) -> tuple[str, int, int]:
    url = (
        f"{GEMINI_BASE}/models/{model_id()}:generateContent"
        f"?key={settings.google_api_key}"
    )
    body: dict[str, Any] = {
        "contents": _to_gemini_messages(messages),
        "systemInstruction": {"parts": [{"text": system}]},
        "generationConfig": {
            "temperature": temperature,
            "maxOutputTokens": max_tokens,
        },
    }
    if web_grounding:
        body["tools"] = [{"google_search": {}}]

    async with httpx.AsyncClient(timeout=120) as client:
        resp = await client.post(url, json=body)
        resp.raise_for_status()
        data = resp.json()

    text_parts: list[str] = []
    for cand in data.get("candidates", []):
        for part in cand.get("content", {}).get("parts", []):
            t = part.get("text", "")
            if t:
                text_parts.append(t)
    usage = data.get("usageMetadata") or {}
    return (
        "".join(text_parts),
        usage.get("promptTokenCount", 0) or 0,
        usage.get("candidatesTokenCount", 0) or 0,
    )
