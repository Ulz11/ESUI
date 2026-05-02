"""Pure-logic auth tests — no DB, no network.

Covers:
- Magic-link token generation / hashing / expiry windows.
- Allowlist gate semantics.
- JWT issue + decode roundtrip.
- Failure modes for tampered / expired tokens.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from fastapi import HTTPException
from jose import jwt as jose_jwt

from app.core.auth import (
    ACCESS_TOKEN_TTL,
    ALGORITHM,
    MAGIC_LINK_TTL,
    create_access_token,
    decode_access_token,
    hash_token,
    is_allowlisted,
    magic_link_expiry,
    new_random_token,
)
from app.core.config import settings

# ---------- token primitives ----------


def test_hash_token_is_deterministic_and_hides_input():
    raw = "supersecret-magic-link-token"
    h1 = hash_token(raw)
    h2 = hash_token(raw)
    assert h1 == h2
    assert raw.encode() not in h1
    # sha256 = 32 bytes
    assert len(h1) == 32


def test_hash_token_distinct_inputs_distinct_outputs():
    assert hash_token("a") != hash_token("b")


def test_new_random_token_is_url_safe_and_unique():
    a = new_random_token()
    b = new_random_token()
    assert a != b
    # urlsafe alphabet
    assert all(c.isalnum() or c in "-_" for c in a)


# ---------- allowlist ----------


def test_is_allowlisted_accepts_canonical_emails():
    assert is_allowlisted(settings.esui_email)
    assert is_allowlisted(settings.badrushk_email)


def test_is_allowlisted_normalizes_case_and_whitespace():
    e = settings.esui_email
    assert is_allowlisted(f"  {e.upper()}  ")


def test_is_allowlisted_rejects_unknown():
    assert not is_allowlisted("evil@example.com")
    assert not is_allowlisted("")


# ---------- magic-link expiry ----------


def test_magic_link_expiry_is_in_the_future():
    now = datetime.now(tz=UTC)
    exp = magic_link_expiry()
    assert exp > now
    # Within MAGIC_LINK_TTL ± a few seconds.
    delta = exp - now
    assert MAGIC_LINK_TTL - timedelta(seconds=5) <= delta <= MAGIC_LINK_TTL + timedelta(seconds=5)


# ---------- JWT roundtrip ----------


def test_create_and_decode_access_token_roundtrip():
    uid = uuid4()
    token, exp = create_access_token(uid)
    decoded = decode_access_token(token)
    assert decoded == uid
    # exp ~ now + ACCESS_TOKEN_TTL
    now = datetime.now(tz=UTC)
    delta = exp - now
    assert ACCESS_TOKEN_TTL - timedelta(seconds=5) <= delta <= ACCESS_TOKEN_TTL + timedelta(seconds=5)


def test_decode_rejects_token_signed_with_other_key():
    uid = uuid4()
    payload = {"sub": str(uid), "exp": int((datetime.now(UTC) + ACCESS_TOKEN_TTL).timestamp())}
    bad = jose_jwt.encode(payload, "different-key-not-the-real-one-32chars", algorithm=ALGORITHM)
    with pytest.raises(HTTPException) as excinfo:
        decode_access_token(bad)
    assert excinfo.value.status_code == 401


def test_decode_rejects_garbage():
    with pytest.raises(HTTPException) as excinfo:
        decode_access_token("not.a.jwt")
    assert excinfo.value.status_code == 401


def test_decode_rejects_expired_token():
    uid = uuid4()
    past = datetime.now(UTC) - timedelta(minutes=1)
    payload = {"sub": str(uid), "exp": int(past.timestamp())}
    expired = jose_jwt.encode(payload, settings.secret_key, algorithm=ALGORITHM)
    with pytest.raises(HTTPException) as excinfo:
        decode_access_token(expired)
    assert excinfo.value.status_code == 401


def test_decode_rejects_token_with_non_uuid_sub():
    payload = {
        "sub": "not-a-uuid",
        "exp": int((datetime.now(UTC) + ACCESS_TOKEN_TTL).timestamp()),
    }
    bad = jose_jwt.encode(payload, settings.secret_key, algorithm=ALGORITHM)
    with pytest.raises(HTTPException):
        decode_access_token(bad)
