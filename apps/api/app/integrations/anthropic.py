"""Anthropic SDK wrapper.

Streaming chat with prompt caching. Three model aliases:
  - opus   = claude-opus-4-7
  - sonnet = claude-sonnet-4-6  (default)
  - haiku  = claude-haiku-4-5

Cache strategy: mark `system`, retrieved memory block, and the last assistant
turn with `cache_control={"type": "ephemeral"}`. Caller assembles the messages
list; this module just streams the API.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from dataclasses import dataclass
from typing import Any, Literal

from anthropic import AsyncAnthropic

from app.core.config import settings

ModelAlias = Literal["opus", "sonnet", "haiku"]


def _ids() -> dict[ModelAlias, str]:
    """Resolved at import time — bump model IDs via env vars without code change."""
    return {
        "opus": settings.opus_model_id,
        "sonnet": settings.sonnet_model_id,
        "haiku": settings.haiku_model_id,
    }


MODEL_IDS: dict[ModelAlias, str] = _ids()

_client: AsyncAnthropic | None = None


def get_client() -> AsyncAnthropic:
    global _client
    if _client is None:
        _client = AsyncAnthropic(api_key=settings.anthropic_api_key)
    return _client


@dataclass
class StreamChunk:
    """One streamed delta from the model."""

    kind: Literal["text", "tool_use", "thinking", "complete"]
    text: str = ""
    tool_name: str | None = None
    tool_input: dict[str, Any] | None = None
    tool_use_id: str | None = None
    # Set on `complete`:
    tokens_in: int | None = None
    tokens_out: int | None = None
    tokens_cached: int | None = None
    stop_reason: str | None = None


async def stream_chat(
    *,
    model: ModelAlias,
    system_blocks: list[dict[str, Any]],
    messages: list[dict[str, Any]],
    tools: list[dict[str, Any]] | None = None,
    max_tokens: int = 4096,
    temperature: float = 0.7,
    extended_thinking: bool = False,
) -> AsyncIterator[StreamChunk]:
    """Stream tokens from Anthropic. Yields StreamChunks until complete.

    `system_blocks` is a list of system content blocks (each may have
    cache_control). `messages` follows the Anthropic content-block format.
    """
    client = get_client()

    kwargs: dict[str, Any] = {
        "model": MODEL_IDS[model],
        "max_tokens": max_tokens,
        "temperature": temperature,
        "system": system_blocks,
        "messages": messages,
    }
    if tools:
        kwargs["tools"] = tools
    if extended_thinking:
        kwargs["thinking"] = {"type": "enabled", "budget_tokens": 8000}

    async with client.messages.stream(**kwargs) as stream:
        async for event in stream:
            etype = getattr(event, "type", "")
            if etype == "content_block_delta":
                delta = event.delta
                dtype = getattr(delta, "type", "")
                if dtype == "text_delta":
                    yield StreamChunk(kind="text", text=delta.text)
                elif dtype == "thinking_delta":
                    yield StreamChunk(kind="thinking", text=delta.thinking)
            elif etype == "content_block_start":
                block = event.content_block
                if getattr(block, "type", "") == "tool_use":
                    yield StreamChunk(
                        kind="tool_use",
                        tool_name=block.name,
                        tool_input={},  # input streams in via input_json_delta
                        tool_use_id=block.id,
                    )

        final = await stream.get_final_message()

    yield StreamChunk(
        kind="complete",
        tokens_in=final.usage.input_tokens,
        tokens_out=final.usage.output_tokens,
        tokens_cached=getattr(final.usage, "cache_read_input_tokens", None),
        stop_reason=final.stop_reason,
    )


async def complete(
    *,
    model: ModelAlias,
    system: str,
    messages: list[dict[str, Any]],
    max_tokens: int = 1024,
    temperature: float = 0.5,
) -> tuple[str, int, int]:
    """Non-streaming one-shot. Returns (text, tokens_in, tokens_out)."""
    client = get_client()
    msg = await client.messages.create(
        model=MODEL_IDS[model],
        max_tokens=max_tokens,
        temperature=temperature,
        system=system,
        messages=messages,
    )
    text = "".join(b.text for b in msg.content if getattr(b, "type", "") == "text")
    return text, msg.usage.input_tokens, msg.usage.output_tokens
