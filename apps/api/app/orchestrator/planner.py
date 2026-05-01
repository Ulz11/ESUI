"""AI schedule planner — Esui's "plan with AI" brain.

Takes her intent + existing schedule + retrieved memory/vault, returns a
structured plan she can review, edit, and accept (committed via /tasks/bulk).

Two modes match the rest of the orchestrator:
  - Ulzii: plans for understanding. Protects deep-work blocks; respects energy
           curves; reflective evenings.
  - Obama: plans for leverage. Recommendation-first; time-boxes hard;
           highest-impact block leads the day.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from app.core.log import log
from app.integrations.anthropic import MODEL_IDS, get_client


PLAN_TOOL = {
    "name": "emit_plan",
    "description": "Emit a structured plan for the requested range.",
    "input_schema": {
        "type": "object",
        "properties": {
            "items": {
                "type": "array",
                "description": "The proposed schedule items, in chronological order.",
                "items": {
                    "type": "object",
                    "properties": {
                        "kind": {"type": "string", "enum": ["task", "event"]},
                        "title": {"type": "string"},
                        "description": {"type": "string"},
                        "starts_at": {
                            "type": "string",
                            "description": "ISO 8601 datetime in UTC. Required for events.",
                        },
                        "ends_at": {
                            "type": "string",
                            "description": "ISO 8601 datetime in UTC. Optional for tasks.",
                        },
                        "all_day": {"type": "boolean"},
                        "color": {
                            "type": "string",
                            "description": "Hex like '#7DB6E8' or palette token (sky, vanilla, navy, forest).",
                        },
                        "rationale": {
                            "type": "string",
                            "description": "One short sentence: why this block at this time.",
                        },
                    },
                    "required": ["kind", "title"],
                },
            },
            "summary": {
                "type": "string",
                "description": "2-4 sentence prose summary of the plan and the tradeoffs it makes.",
            },
            "open_questions": {
                "type": "array",
                "description": "Things only Esui can resolve. Empty list when there's nothing to ask.",
                "items": {"type": "string"},
            },
        },
        "required": ["items", "summary", "open_questions"],
    },
}


PLAN_SYSTEM_ULZII = """You are Ulzii — Esui's intellectual companion — planning her
day with care. Time is attention, not a slot to fill.

Operating principles:
- Protect *deep-work* blocks (90+ minutes, ideally 120) for hard intellectual
  tasks. Do not fragment them.
- Schedule the hardest cognitive work for her peak hours (morning + early
  afternoon). Reserve evenings for reading, reflection, and conversations she
  values.
- Build in transitions: 10–20 min between context shifts. Calendars without
  breath crack.
- Honor existing commitments. Do not override them unless she explicitly asked.
- Cluster similar work — don't bounce her between contexts.
- When you genuinely don't know what she'd want, ask via `open_questions`.
  Don't ask for the sake of asking.

Output a structured plan she can accept or edit. Be decisive but humane."""


PLAN_SYSTEM_OBAMA = """You are Obama — Esui's strategic co-pilot — planning her day
for impact.

Operating principles:
- Lead with the highest-leverage block. What moves the needle most today?
  That goes first, when her attention is sharpest.
- Time-box. Default durations: 90 min for deep work, 30 for routines, 15 for
  admin/email. No infinite blocks.
- Front-load the hardest decisions. Don't bury big choices behind small ones.
- Honor her existing commitments. Don't override unless she explicitly asked.
- Be decisive. When choosing between two reasonable slots, pick one and state
  the reason in `rationale`.
- `open_questions` is only for things you genuinely cannot resolve. Treat
  asking as a small cost.

Recommendation-first. No preamble. Output the plan."""


PlannerMode = Literal["ulzii", "obama"]


async def plan_day(
    *,
    intent: str,
    date_from: datetime,
    date_to: datetime,
    existing_items: list[dict[str, Any]],
    retrieved_context: str,
    mode: PlannerMode = "ulzii",
    timezone_name: str | None = None,
) -> dict[str, Any]:
    """Returns the structured plan dict (items, summary, open_questions, tokens)."""
    sys = PLAN_SYSTEM_ULZII if mode == "ulzii" else PLAN_SYSTEM_OBAMA

    existing_text = "## Existing schedule for the range\n"
    if existing_items:
        for item in existing_items:
            t = f" — {item['starts_at']}" if item.get("starts_at") else ""
            ends = f" → {item['ends_at']}" if item.get("ends_at") else ""
            existing_text += f"- [{item['kind']}] {item['title']}{t}{ends}\n"
    else:
        existing_text += "(nothing scheduled yet)\n"

    tz_line = f"\nLocal timezone: {timezone_name}\n" if timezone_name else "\n"

    user_msg = (
        f"## Plan range\n"
        f"From: {date_from.isoformat()}\n"
        f"To: {date_to.isoformat()}{tz_line}\n"
        f"{existing_text}\n"
        f"## What Esui wants to plan\n"
        f"{intent.strip() or '(no specific brief — propose a balanced plan based on her vault and memory)'}\n\n"
        f"{retrieved_context}"
    )

    client = get_client()
    try:
        resp = await client.messages.create(
            model=MODEL_IDS["opus"],
            max_tokens=4000,
            temperature=0.4,
            system=sys,
            tools=[PLAN_TOOL],
            tool_choice={"type": "tool", "name": "emit_plan"},
            messages=[{"role": "user", "content": user_msg}],
            thinking={"type": "enabled", "budget_tokens": 6000},
        )
    except Exception as e:
        log.exception("planner.plan_day.error", error=str(e))
        raise

    for b in resp.content:
        if getattr(b, "type", "") == "tool_use" and b.name == "emit_plan":
            return {
                **b.input,
                "tokens_in": resp.usage.input_tokens,
                "tokens_out": resp.usage.output_tokens,
            }
    raise RuntimeError("planner returned no plan tool call")
