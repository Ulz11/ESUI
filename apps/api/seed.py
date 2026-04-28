"""Seed the two `users` rows from env emails.

Run after applying migrations:
    uv run python seed.py

Idempotent: if a user already exists for the email, skip.
"""

from __future__ import annotations

import asyncio

from sqlalchemy import select

from app.core.config import settings
from app.core.db import SessionLocal
from app.core.log import configure_logging, log
from app.models import User

configure_logging()


async def main() -> None:
    if not settings.esui_email or not settings.badrushk_email:
        log.error("seed.missing_emails",
                  hint="Set ESUI_EMAIL and BADRUSHK_EMAIL in apps/api/.env")
        raise SystemExit(1)

    seeds = [
        {"email": settings.esui_email.strip().lower(),
         "display_name": "Esui",
         "role": "esui",
         "default_mode": "ulzii"},
        {"email": settings.badrushk_email.strip().lower(),
         "display_name": "Badrushk",
         "role": "badrushk",
         "default_mode": "obama"},
    ]

    async with SessionLocal() as session:
        for s in seeds:
            existing = await session.execute(
                select(User).where(User.email == s["email"])
            )
            if existing.scalar_one_or_none() is not None:
                log.info("seed.skip", email=s["email"])
                continue
            session.add(User(**s))
            log.info("seed.created", email=s["email"], role=s["role"])
        await session.commit()


if __name__ == "__main__":
    asyncio.run(main())
