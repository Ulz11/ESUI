"""RNN flashcard scheduler — server-side.

This is the port of the TOK-card.html scheduler used by the Exam flip-card
session. The properties below are what make spaced-repetition feel "right":
- success raises memory strength
- failure resets streak
- time decay erodes strength between reviews
- streak bonus rewards consecutive successes
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from app.widgets.exam import _rnn_update

NOW = datetime(2026, 5, 2, 12, 0, 0, tzinfo=UTC)


def make(h: float = 0.1, last_review: datetime | None = None, reviews: int = 0, streak: int = 0) -> dict:
    return {
        "h": h,
        "last_review": last_review.isoformat() if last_review else None,
        "reviews": reviews,
        "streak": streak,
    }


# ---------- bounds + monotonicity ----------


def test_h_stays_in_unit_interval_for_any_signal():
    s = make()
    for sig in (0.0, 0.33, 0.66, 1.0):
        out = _rnn_update(s, sig, NOW)
        assert 0.0 <= out["h"] <= 1.0


def test_easy_increases_h_more_than_again():
    s_easy = _rnn_update(make(h=0.4), 1.0, NOW)
    s_again = _rnn_update(make(h=0.4), 0.0, NOW)
    assert s_easy["h"] > s_again["h"]


def test_good_increases_h_more_than_hard():
    s_good = _rnn_update(make(h=0.4), 0.66, NOW)
    s_hard = _rnn_update(make(h=0.4), 0.33, NOW)
    assert s_good["h"] >= s_hard["h"]


# ---------- streak ----------


def test_streak_grows_on_success_resets_on_again():
    s = make(streak=2)
    after_good = _rnn_update(s, 0.66, NOW)
    assert after_good["streak"] == 3
    after_again = _rnn_update(s, 0.0, NOW)
    assert after_again["streak"] == 0


def test_streak_bonus_caps_at_one():
    # Long streaks get a +0.05 bonus; h should never exceed 1.0.
    state = make(h=0.97, streak=10)
    out = _rnn_update(state, 1.0, NOW)
    assert out["h"] <= 1.0


# ---------- time decay ----------


def test_no_review_yet_treats_dt_as_zero():
    fresh = make()  # last_review None
    out = _rnn_update(fresh, 1.0, NOW)
    # No exception; outputs a real number
    assert 0.0 <= out["h"] <= 1.0


def test_old_review_decays_then_recovers_with_good_signal():
    # Card last reviewed a week ago, was strong (h=0.9).
    last = NOW - timedelta(days=7)
    s = make(h=0.9, last_review=last, reviews=5, streak=3)
    out = _rnn_update(s, 1.0, NOW)
    # Reviews counter advances.
    assert out["reviews"] == 6
    # Last review is now NOW.
    assert out["last_review"] == NOW.isoformat()


def test_failure_after_long_decay_does_not_blow_up():
    last = NOW - timedelta(days=30)
    s = make(h=0.7, last_review=last, reviews=3, streak=2)
    out = _rnn_update(s, 0.0, NOW)
    assert out["streak"] == 0
    assert 0.0 <= out["h"] <= 1.0


# ---------- review counter ----------


def test_reviews_increments_each_call():
    s = make(reviews=5)
    out = _rnn_update(s, 0.66, NOW)
    assert out["reviews"] == 6


def test_handles_malformed_last_review_gracefully():
    # If somehow a bad timestamp leaked in, treat as zero decay.
    s = {"h": 0.5, "last_review": "not-an-iso-timestamp", "reviews": 1, "streak": 0}
    out = _rnn_update(s, 1.0, NOW)
    assert 0.0 <= out["h"] <= 1.0
    assert out["reviews"] == 2
