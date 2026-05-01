"""APScheduler boot — runs in-process inside the FastAPI lifespan.

Active periodic jobs:
  - signals.hourly_curate   every hour at :05
  - memory.consolidate      daily at 03:00 UTC
"""

from __future__ import annotations

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from app.core.log import log
from app.jobs.signals_curate import hourly_curate
from app.memory.consolidate import consolidate_all

_scheduler: AsyncIOScheduler | None = None


def start_scheduler() -> None:
    global _scheduler
    if _scheduler is not None:
        return
    s = AsyncIOScheduler(timezone="UTC")

    s.add_job(
        hourly_curate,
        CronTrigger(minute=5),  # :05 of every hour
        id="signals.hourly_curate",
        replace_existing=True,
        coalesce=True,
        max_instances=1,
    )

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
