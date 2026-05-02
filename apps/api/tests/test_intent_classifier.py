"""Intent + effort hint shape.

The orchestrator router consumes ChatHints to pick a model. Lock its
contract so a future refactor doesn't quietly break routing.
"""

from __future__ import annotations

from app.orchestrator.intent import ChatHints


def test_chathints_default_construction():
    h = ChatHints(effort="low", intent="general")
    assert h.effort == "low"
    assert h.intent == "general"


def test_chathints_accepts_known_efforts():
    for e in ("low", "med", "high"):
        h = ChatHints(effort=e, intent="general")
        assert h.effort == e


def test_chathints_intents_round_trip():
    for i in ("general", "market_research", "deep_research", "decision", "epistemic"):
        h = ChatHints(effort="low", intent=i)
        assert h.intent == i
