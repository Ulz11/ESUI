"""APScheduler boot — runs in-process inside the FastAPI lifespan.

Two periodic jobs in v1:
  - signals.refresh           every 6h
  - signals.expire_cleanup    hourly
  - together.prompt_scheduler every 15 min

When deployed across multiple api machines we'd switch to a redis-backed
JobStore + a single beat process; for v1 (one machine, two users) in-process
is fine.
"""

from __future__ import annotations

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

from app.core.log import log
from app.jobs.signals_refresh import expire_cleanup, refresh_cycle
from app.jobs.together_scheduler import maybe_surface_prompt
from app.memory.consolidate import consolidate_all

_scheduler: AsyncIOScheduler | None = None


def start_scheduler() -> None:
    global _scheduler
    if _scheduler is not None:
        return
    s = AsyncIOScheduler(timezone="UTC")

    s.add_job(
        refresh_cycle,
        CronTrigger(hour="*/6", minute=0),
        id="signals.refresh",
        replace_existing=True,
        coalesce=True,
        max_instances=1,
    )
    s.add_job(
        expire_cleanup,
        CronTrigger(minute=15),
        id="signals.expire_cleanup",
        replace_existing=True,
        coalesce=True,
        max_instances=1,
    )
    s.add_job(
        maybe_surface_prompt,
        IntervalTrigger(minutes=15),
        id="together.prompt_scheduler",
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
