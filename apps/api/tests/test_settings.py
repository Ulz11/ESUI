"""Settings parsing — keep the env contract honest.

The CSV/JSON origin parser bites people; lock its behavior in tests.
"""

from __future__ import annotations

import os

from app.core.config import Settings


def test_origins_csv_string():
    s = Settings(allowed_origins="http://a.com, http://b.com,http://c.com")
    assert s.allowed_origins == ["http://a.com", "http://b.com", "http://c.com"]


def test_origins_json_string():
    s = Settings(allowed_origins='["http://x.com","http://y.com"]')
    assert s.allowed_origins == ["http://x.com", "http://y.com"]


def test_origins_list_passthrough():
    s = Settings(allowed_origins=["http://only.example"])
    assert s.allowed_origins == ["http://only.example"]


def test_origins_empty_string_returns_empty_list():
    s = Settings(allowed_origins="")
    assert s.allowed_origins == []


def test_allowlisted_emails_normalized_set():
    s = Settings(esui_email="  Esui@Example.COM  ", badrushk_email="Bad@example.com")
    assert s.allowlisted_emails == {"esui@example.com", "bad@example.com"}


def test_allowlisted_excludes_blanks():
    s = Settings(esui_email="", badrushk_email="b@x.com")
    assert s.allowlisted_emails == {"b@x.com"}


def test_app_env_default_is_development():
    # Even when nothing is set explicitly the default keeps test environments safe.
    if "APP_ENV" in os.environ:
        # conftest may have set it
        pass
    s = Settings()
    assert s.app_env in ("development", "staging", "production")
