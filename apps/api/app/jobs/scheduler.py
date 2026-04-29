"""APScheduler boot — runs in-process inside the FastAPI lifespan.

Active periodic jobs:
  - memory.consolidate    daily at 03:00 UTC

(Together prompts and Signals refresh were removed when those widgets pivoted
to user-curated drop surfaces.)
"""

from __future__ import annotations

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from app.core.log import log
from app.memory.consolidate import consolidate_all

_scheduler: AsyncIOScheduler | None = None


def start_scheduler() -> None:
    global _scheduler
    if _scheduler is not None:
        return
    s = AsyncIOScheduler(timezone="UTC")

    s.add_job(
        consolidate_all,
        CronTrigger(hour=3, minute=0),  # 03:00 UTC daily
        id="memory.consolidate",
        replace_existing=True,
        coalesce=True,
        max_instances=1,
    )

    s.start()
    _scheduler = s
    log.info("scheduler.started", jobs=[j.id for j in s.get_jobs()])


def stop_scheduler() -> None:
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        _scheduler = None
        log.info("scheduler.stopped")
