"""Worker entrypoint: APScheduler runs scraping + apply loops, plus heartbeat.

Also listens to Supabase realtime on the `sources` table so the worker wakes
up the moment the user toggles a source in the dashboard, instead of waiting
for the next 2-minute tick.
"""
import asyncio
from datetime import datetime, time
from zoneinfo import ZoneInfo
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

from .config import settings
from .db import db, user_id
from .logger import log, db_log
from .heartbeat import beat
from .sources.registry import run_due_sources
from .apply.runner import process_queue
from .commands import tick_commands


def in_active_window() -> bool:
    """Honor automation_settings.run_24_7 + daily_start/daily_end."""
    try:
        row = db().table("automation_settings").select(
            "enabled, run_24_7, daily_start, daily_end, timezone"
        ).eq("user_id", user_id()).single().execute().data
    except Exception:
        return False
    if not row or not row.get("enabled"):
        return False
    if row.get("run_24_7"):
        return True
    tz = ZoneInfo(row.get("timezone") or "UTC")
    now = datetime.now(tz).time()
    start = time.fromisoformat(row["daily_start"])
    end = time.fromisoformat(row["daily_end"])
    return start <= now <= end


# Wake event raised by the realtime listener; tick_sources awaits it so the
# worker reacts immediately to source toggles.
_wake = asyncio.Event()


async def tick_sources():
    if not in_active_window():
        return
    try:
        await run_due_sources()
    except Exception as e:
        db_log("error", f"sources tick failed: {e}", scope="scheduler")


async def tick_apply():
    if not in_active_window():
        return
    try:
        await process_queue(limit=3)
    except Exception as e:
        db_log("error", f"apply tick failed: {e}", scope="scheduler")


async def tick_heartbeat():
    beat()


async def realtime_sources_listener():
    """Disabled: the sync supabase-py client does not support realtime.
    The 2-minute scheduler tick still picks up source changes."""
    log.info("realtime_listener_disabled", reason="sync client unsupported")
    return


async def wake_loop():
    """When _wake is set, force-run sources immediately. Unused while realtime is disabled."""
    while True:
        await _wake.wait()
        _wake.clear()
        try:
            await run_due_sources(force=True)
        except Exception as e:
            db_log("error", f"forced sources run failed: {e}", scope="scheduler")


async def main():
    db_log("info", f"worker starting v{settings().WORKER_VERSION}", scope="boot")
    sched = AsyncIOScheduler()
    sched.add_job(tick_heartbeat, IntervalTrigger(seconds=30), id="heartbeat", max_instances=1)
    sched.add_job(tick_commands, IntervalTrigger(seconds=5), id="commands", max_instances=1)
    sched.add_job(tick_sources, IntervalTrigger(minutes=2), id="sources", max_instances=1)
    sched.add_job(tick_apply, IntervalTrigger(seconds=45), id="apply", max_instances=1)
    sched.start()
    beat()
    asyncio.create_task(realtime_sources_listener())
    asyncio.create_task(wake_loop())
    db_log("info", "scheduler started", scope="boot")
    while True:
        await asyncio.sleep(3600)


if __name__ == "__main__":
    asyncio.run(main())

