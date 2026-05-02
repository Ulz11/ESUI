"""Task → provider+model routing across Claude / Gemini / Perplexity.

Three providers, env-driven model IDs (see settings). The router function
returns a `RouteSpec` that the dispatcher consumes:

    RouteSpec(provider='anthropic', alias='opus')
    RouteSpec(provider='google',    alias='gemini')
    RouteSpec(provider='perplexity', alias='perplexity-research')

Route decision combines:
  - the task taxonomy (chat vs exam.* vs vault.* etc.)
  - the chat mode (Ulzii / Obama)
  - intent + effort hints (from orchestrator.intent)
  - explicit caller hint (UI override)
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from app.orchestrator.intent import ChatHints

Provider = Literal["anthropic", "google", "perplexity"]
Alias = Literal[
    "opus", "sonnet", "haiku",
    "gemini",
    "perplexity-research", "perplexity-reasoning",
]

TaskKind = Literal[
    "chat",
    "exam.cheatsheet",
    "exam.practice_set",
    "exam.concept_map",
    "exam.knowledge_graph",
    "exam.simulation",
    "exam.grade",
    "vault.tag",
    "vault.title",
    "vault.summarize",
    "signals.distill",
    "signals.ai_topic",
    "memory.classify",
    "memory.consolidate",
    "chat.auto_title",
]

Mode = Literal["ulzii", "obama"]


@dataclass(frozen=True)
class RouteSpec:
    provider: Provider
    alias: Alias

    @property
    def is_anthropic(self) -> bool:
        return self.provider == "anthropic"


# Static defaults for non-chat tasks. Chat is dynamic (mode/intent/effort).
_TASK_DEFAULT: dict[TaskKind, RouteSpec] = {
    "exam.cheatsheet":     RouteSpec("anthropic", "opus"),
    "exam.practice_set":   RouteSpec("anthropic", "sonnet"),
    "exam.concept_map":    RouteSpec("anthropic", "opus"),
    "exam.knowledge_graph": RouteSpec("anthropic", "opus"),
    "exam.simulation":     RouteSpec("anthropic", "sonnet"),
    "exam.grade":          RouteSpec("anthropic", "sonnet"),
    "vault.tag":           RouteSpec("anthropic", "haiku"),
    "vault.title":         RouteSpec("anthropic", "haiku"),
    "vault.summarize":     RouteSpec("anthropic", "sonnet"),
    "signals.distill":     RouteSpec("anthropic", "sonnet"),
    "signals.ai_topic":    RouteSpec("perplexity", "perplexity-research"),
    "memory.classify":     RouteSpec("anthropic", "haiku"),
    "memory.consolidate":  RouteSpec("anthropic", "sonnet"),
    "chat.auto_title":     RouteSpec("anthropic", "haiku"),
}


def select(
    task: TaskKind,
    *,
    mode: Mode | None = None,
    hints: ChatHints | None = None,
    user_override: Alias | None = None,
    capped: bool = False,
) -> RouteSpec:
    """Return the route for a task.

    `user_override` always wins (UI lets the user force a provider/alias).
    `capped` (daily cost cap reached) clamps chat to Sonnet — no Opus, no
    Perplexity Deep Research.
    """
    if user_override:
        return _spec_for_alias(user_override)

    if task != "chat":
        spec = _TASK_DEFAULT[task]
        if capped and spec.alias == "opus":
            return RouteSpec("anthropic", "sonnet")
        if capped and spec.provider == "perplexity":
            return RouteSpec("anthropic", "sonnet")
        return spec

    # ---- chat routing ----
    h = hints or ChatHints(effort="low", intent="general")

    # Deep research → Perplexity Sonar Deep Research (when not capped).
    if h.intent == "deep_research" and not capped:
        return RouteSpec("perplexity", "perplexity-research")

    # Obama + market research → Gemini with web grounding.
    if mode == "obama" and h.intent == "market_research":
        return RouteSpec("google", "gemini")

    # Decision-heavy with high effort, Obama mode → Opus.
    if mode == "obama" and h.intent == "decision" and h.effort == "high" and not capped:
        return RouteSpec("anthropic", "opus")

    # Epistemic + high effort, Ulzii mode → Opus.
    if mode == "ulzii" and h.intent == "epistemic" and h.effort == "high" and not capped:
        return RouteSpec("anthropic", "opus")

    # Generic high-effort lift → Opus when budget allows.
    if h.effort == "high" and not capped:
        return RouteSpec("anthropic", "opus")

    return RouteSpec("anthropic", "sonnet")


def _spec_for_alias(alias: Alias) -> RouteSpec:
    if alias in ("opus", "sonnet", "haiku"):
        return RouteSpec("anthropic", alias)
    if alias == "gemini":
        return RouteSpec("google", "gemini")
    return RouteSpec("perplexity", alias)
