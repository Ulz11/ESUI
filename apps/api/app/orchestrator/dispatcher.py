"""Provider-agnostic streaming chat dispatcher.

The orchestrator picks a `RouteSpec` and hands it here. Dispatcher routes to
the right integration module based on `spec.provider` and yields a uniform
`StreamChunk` stream regardless of who's serving the tokens.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Any, cast

from app.integrations import gemini, perplexity
from app.integrations.anthropic import StreamChunk
from app.integrations.anthropic import stream_chat as stream_anthropic
from app.integrations.perplexity import PerplexityAlias
from app.orchestrator.router import RouteSpec


async def stream_via(
    spec: RouteSpec,
    *,
    system_blocks: list[dict[str, Any]],
    plain_system: str,
    messages: list[dict[str, Any]],
    tools: list[dict[str, Any]] | None = None,
    max_tokens: int = 4096,
    temperature: float = 0.7,
    extended_thinking: bool = False,
) -> AsyncIterator[StreamChunk]:
    """Dispatch a chat stream to the right provider.

    `system_blocks` is the cache-aware Anthropic system block list.
    `plain_system` is a flat string used by Gemini/Perplexity (no caching there).
    """
    if spec.provider == "anthropic":
        async for chunk in stream_anthropic(
            model=spec.alias,  # type: ignore[arg-type]
            system_blocks=system_blocks,
            messages=messages,
            tools=tools,
            max_tokens=max_tokens,
            temperature=temperature,
            extended_thinking=extended_thinking,
        ):
            yield chunk
        return

    if spec.provider == "google":
        async for chunk in gemini.stream_chat(
            system=plain_system,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            web_grounding=True,
        ):
            yield chunk
        return

    if spec.provider == "perplexity":
        alias = cast(PerplexityAlias, spec.alias)
        async for chunk in perplexity.stream_chat(
            alias=alias,
            system=plain_system,
            messages=messages,
            temperature=min(temperature, 0.6),  # research models prefer lower
            max_tokens=max_tokens,
            return_citations=True,
        ):
            yield chunk
        return

    raise ValueError(f"unknown provider: {spec.provider}")


def flat_system_from_blocks(blocks: list[dict[str, Any]]) -> str:
    """Concatenate Anthropic system blocks into a single string for non-Anthropic providers."""
    return "\n\n".join(b.get("text", "") for b in blocks if b.get("type") == "text")
