"""Combined effort + intent classifier — one Haiku call.

Returns a richer signal than effort alone, so the router can pick the right
provider, not just the right Anthropic tier:

  effort:  low | med | high
  intent:  general | market_research | deep_research | decision | epistemic

Routing matrix in orchestrator/router.py uses both fields. Skipped (defaults
returned) for short messages.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from app.core.log import log
from app.integrations.anthropic import MODEL_IDS, get_client

EffortLevel = Literal["low", "med", "high"]
Intent = Literal[
    "general",          # ordinary chat
    "market_research",  # market sizing, competitive landscape, current state of X
    "deep_research",    # multi-source synthesis, citations, recent papers
    "decision",         # strategic choice, scenarios
    "epistemic",        # theory-of-knowledge, foundations, careful structure
]


@dataclass
class ChatHints:
    effort: EffortLevel
    intent: Intent


CLASSIFY_TOOL = {
    "name": "emit_classification",
    "description": "Classify cognitive effort and intent of a user's chat message.",
    "input_schema": {
        "type": "object",
        "properties": {
            "effort": {"type": "string", "enum": ["low", "med", "high"]},
            "intent": {
                "type": "string",
                "enum": [
                    "general", "market_research", "deep_research",
                    "decision", "epistemic",
                ],
            },
            "reason": {"type": "string"},
        },
        "required": ["effort", "intent"],
    },
}


CLASSIFY_SYSTEM = """Classify a user's chat message along two axes.

EFFORT — how much cognitive effort the answer demands:
  low:  casual chat, simple lookups, short clarifications
  med:  multi-step reasoning, normal study/work questions
  high: deep philosophical inquiry, careful synthesis, hard strategic
        decisions, subtle epistemic puzzles, multi-page proofs.
        Bias toward 'med' unless 'high' is clearly warranted.

INTENT — what kind of help is being requested:
  general          ordinary chat, exploration, clarifications
  market_research  market sizing, competitive landscape, "what's the state of X"
  deep_research    multi-source synthesis, recent literature, comparing positions
  decision         pick between options, strategic tradeoffs, scenario thinking
  epistemic        theory-of-knowledge, foundational understanding, structure

Pick the dominant intent. If a message is mixed, prefer the intent the user
would most appreciate the answer being shaped by."""


async def classify(user_text: str) -> ChatHints:
    """Single fast Haiku call. Default low/general for short inputs."""
    if len(user_text.strip()) < 200:
        return ChatHints(effort="low", intent="general")
    client = get_client()
    try:
        resp = await client.messages.create(
            model=MODEL_IDS["haiku"],
            max_tokens=120,
            temperature=0.0,
            system=CLASSIFY_SYSTEM,
            tools=[CLASSIFY_TOOL],
            tool_choice={"type": "tool", "name": "emit_classification"},
            messages=[{"role": "user", "content": user_text[:2000]}],
        )
    except Exception as e:
        log.warn("intent.classify.error", error=str(e))
        return ChatHints(effort="med", intent="general")

    for b in resp.content:
        if getattr(b, "type", "") == "tool_use" and b.name == "emit_classification":
            effort_raw = b.input.get("effort", "med")
            intent_raw = b.input.get("intent", "general")
            effort: EffortLevel = effort_raw if effort_raw in ("low", "med", "high") else "med"  # type: ignore[assignment]
            intent: Intent = intent_raw if intent_raw in (
                "general", "market_research", "deep_research", "decision", "epistemic"
            ) else "general"  # type: ignore[assignment]
            return ChatHints(effort=effort, intent=intent)
    return ChatHints(effort="med", intent="general")
