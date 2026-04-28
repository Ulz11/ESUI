"""Effort classifier — picks Opus for high-effort questions, Sonnet otherwise.

Tiny Haiku call (~30ms typically) reads the user's message and returns a
classification: low | med | high. Caller maps high → Opus, else Sonnet.

Skipped entirely for messages under 200 chars (always 'low').
"""

from __future__ import annotations

from typing import Literal

from app.core.log import log
from app.integrations.anthropic import MODEL_IDS, get_client

EffortLevel = Literal["low", "med", "high"]


CLASSIFY_TOOL = {
    "name": "emit_effort",
    "description": "Classify the cognitive effort the question demands.",
    "input_schema": {
        "type": "object",
        "properties": {
            "effort": {"type": "string", "enum": ["low", "med", "high"]},
            "reason": {"type": "string"},
        },
        "required": ["effort"],
    },
}


CLASSIFY_SYSTEM = """Classify how much cognitive effort the user's question
demands. Output one of:
  - low:  casual chat, simple lookups, short clarifications
  - med:  multi-step reasoning, normal study/work questions
  - high: deep philosophical inquiry, careful synthesis, multi-page proofs,
          subtle epistemic puzzles, hard strategic decisions

Bias toward 'med' when uncertain; only commit to 'high' when the question
clearly benefits from deep extended-thinking effort."""


async def classify_effort(user_text: str) -> EffortLevel:
    if len(user_text.strip()) < 200:
        return "low"
    client = get_client()
    try:
        resp = await client.messages.create(
            model=MODEL_IDS["haiku"],
            max_tokens=80,
            temperature=0.0,
            system=CLASSIFY_SYSTEM,
            tools=[CLASSIFY_TOOL],
            tool_choice={"type": "tool", "name": "emit_effort"},
            messages=[{"role": "user", "content": user_text[:2000]}],
        )
    except Exception as e:
        log.warn("effort.classify.error", error=str(e))
        return "med"
    for b in resp.content:
        if getattr(b, "type", "") == "tool_use" and b.name == "emit_effort":
            level = b.input.get("effort", "med")
            if level in ("low", "med", "high"):
                return level  # type: ignore[return-value]
    return "med"
