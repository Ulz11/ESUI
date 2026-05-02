"""Shared pytest setup.

Most ESUI tests are pure-logic — they don't need Postgres/Redis. We set a
dummy SECRET_KEY + ESUI_EMAIL + BADRUSHK_EMAIL via environment so
`Settings()` doesn't blow up on import-time defaults.
"""

import os

# Stable dev defaults so Settings() is happy across every test module.
os.environ.setdefault("APP_ENV", "development")
os.environ.setdefault("SECRET_KEY", "test-secret-key-must-be-at-least-32-chars-long-okay")
os.environ.setdefault("ESUI_EMAIL", "esui@test.local")
os.environ.setdefault("BADRUSHK_EMAIL", "badrushk@test.local")
# pydantic-settings JSON-parses env values for list-typed fields before our
# validator runs — supply a JSON array string here so settings.py imports.
os.environ.setdefault("ALLOWED_ORIGINS", '["http://localhost:3000"]')

# Disable any provider keys — the unit tests must not make network calls.
for k in (
    "ANTHROPIC_API_KEY",
    "GOOGLE_API_KEY",
    "PERPLEXITY_API_KEY",
    "VOYAGE_API_KEY",
    "RESEND_API_KEY",
    "UNSTRUCTURED_API_KEY",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
):
    os.environ.setdefault(k, "")
