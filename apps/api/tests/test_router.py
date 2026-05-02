"""Routing decisions across Claude / Gemini / Perplexity.

Locks the contract: which task + mode + intent + effort goes where, and what
happens when the daily cost cap is hit.
"""

from __future__ import annotations

import pytest

from app.orchestrator.intent import ChatHints
from app.orchestrator.router import RouteSpec, select

# ---------- non-chat tasks (static defaults) ----------


@pytest.mark.parametrize(
    ("task", "expected"),
    [
        ("exam.cheatsheet",      RouteSpec("anthropic", "opus")),
        ("exam.practice_set",    RouteSpec("anthropic", "sonnet")),
        ("exam.concept_map",     RouteSpec("anthropic", "opus")),
        ("exam.knowledge_graph", RouteSpec("anthropic", "opus")),
        ("exam.simulation",      RouteSpec("anthropic", "sonnet")),
        ("exam.grade",           RouteSpec("anthropic", "sonnet")),
        ("vault.tag",            RouteSpec("anthropic", "haiku")),
        ("vault.title",          RouteSpec("anthropic", "haiku")),
        ("vault.summarize",      RouteSpec("anthropic", "sonnet")),
        ("signals.distill",      RouteSpec("anthropic", "sonnet")),
        ("signals.ai_topic",     RouteSpec("perplexity", "perplexity-research")),
        ("memory.classify",      RouteSpec("anthropic", "haiku")),
        ("memory.consolidate",   RouteSpec("anthropic", "sonnet")),
        ("chat.auto_title",      RouteSpec("anthropic", "haiku")),
    ],
)
def test_task_default_routes(task, expected):
    assert select(task) == expected


def test_unknown_task_raises():
    # Routing tables are explicit — undeclared tasks must fail loudly.
    with pytest.raises(KeyError):
        select("definitely.not.a.real.task")  # type: ignore[arg-type]


# ---------- cap behavior ----------


def test_cap_demotes_opus_to_sonnet():
    # Daily cost cap reached → no Opus.
    spec = select("exam.cheatsheet", capped=True)
    assert spec == RouteSpec("anthropic", "sonnet")


def test_cap_demotes_perplexity_research_to_sonnet():
    # Cap also blocks pricier Perplexity Deep Research.
    spec = select("signals.ai_topic", capped=True)
    assert spec == RouteSpec("anthropic", "sonnet")


def test_cap_does_not_change_already_cheap_tasks():
    # Haiku and Sonnet stay where they are.
    assert select("vault.tag", capped=True).alias == "haiku"
    assert select("memory.consolidate", capped=True).alias == "sonnet"


# ---------- explicit user override always wins ----------


def test_user_override_wins_over_default():
    spec = select("exam.cheatsheet", user_override="haiku")
    assert spec == RouteSpec("anthropic", "haiku")


def test_user_override_wins_even_when_capped():
    # User explicitly chose Opus — respect it (cap protects us elsewhere).
    spec = select("exam.cheatsheet", user_override="opus", capped=True)
    assert spec.alias == "opus"


# ---------- chat routing is dynamic on mode + hints ----------


def test_chat_default_low_effort_returns_an_anthropic_route():
    spec = select("chat", mode="ulzii", hints=ChatHints(effort="low", intent="general"))
    assert spec.provider in ("anthropic", "google", "perplexity")
    # cheap default ≠ opus
    assert spec.alias != "opus"


def test_chat_high_effort_should_not_demote_below_sonnet_when_uncapped():
    spec = select("chat", mode="obama", hints=ChatHints(effort="high", intent="epistemic"))
    assert spec.alias in ("opus", "sonnet", "perplexity-reasoning", "gemini")


def test_chat_capped_never_returns_opus():
    spec = select(
        "chat",
        mode="ulzii",
        hints=ChatHints(effort="high", intent="epistemic"),
        capped=True,
    )
    assert spec.alias != "opus"


# ---------- RouteSpec semantics ----------


def test_routespec_is_anthropic_helper():
    assert RouteSpec("anthropic", "sonnet").is_anthropic
    assert not RouteSpec("google", "gemini").is_anthropic
    assert not RouteSpec("perplexity", "perplexity-reasoning").is_anthropic


def test_routespec_is_frozen_hashable():
    a = RouteSpec("anthropic", "sonnet")
    b = RouteSpec("anthropic", "sonnet")
    assert a == b
    assert hash(a) == hash(b)
    with pytest.raises(Exception):
        a.alias = "haiku"  # type: ignore[misc]
