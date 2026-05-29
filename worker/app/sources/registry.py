"""Source registry + orchestration.

Reads enabled rows from public.sources, calls the matching adapter,
normalizes → dedupes → filters → scores → inserts into public.jobs.
"""
from datetime import datetime, timezone, timedelta
from typing import Any
from .base import Source
from .apify_linkedin import ApifyLinkedIn
from .apify_indeed import ApifyIndeed
from .remoteok import RemoteOK
from .weworkremotely import WeWorkRemotely
from .arbeitnow import Arbeitnow
from ..db import db, user_id
from ..logger import db_log, log
from ..pipeline.normalize import normalize
from ..pipeline.dedupe import dedupe_hash, exists
from ..pipeline.filter_engine import load_active_filter, passes, match_score


ADAPTERS: dict[str, Source] = {a.key: a for a in [
    ApifyLinkedIn(), ApifyIndeed(), RemoteOK(), WeWorkRemotely(), Arbeitnow(),
]}


def _due(row: dict[str, Any], now: datetime) -> bool:
    if not row.get("enabled"):
        return False
    last = row.get("last_run_at")
    if not last:
        return True
    cadence = row.get("cadence_minutes") or 60
    last_dt = datetime.fromisoformat(last.replace("Z", "+00:00"))
    return now - last_dt >= timedelta(minutes=cadence)


async def run_due_sources(force: bool = False) -> None:
    now = datetime.now(timezone.utc)
    rows = db().table("sources").select("*").eq("user_id", user_id()).execute().data or []
    for r in rows:
        if force or _due(r, now):
            await _run_source(r)


async def run_source_by_key(key: str, force: bool = True) -> None:
    rows = db().table("sources").select("*").eq("user_id", user_id()).eq("key", key).execute().data or []
    for r in rows:
        await _run_source(r)


async def _run_source(row: dict[str, Any]) -> None:
    adapter = ADAPTERS.get(row["key"])
    if not adapter:
        db_log("warning", f"no adapter for source key={row['key']}", scope="sources")
        return

    run = db().table("automation_runs").insert({
        "user_id": user_id(), "kind": "scrape", "source_key": row["key"],
    }).execute().data[0]
    run_id = run["id"]

    items_in = items_out = errors = 0
    try:
        items = list(await adapter.fetch(row.get("config") or {}))
        items_in = len(items)
        active_filter = load_active_filter()
        for raw in items:
            try:
                j = normalize(raw, source_key=row["key"])
                j["dedupe_hash"] = dedupe_hash(j["title"], j["company"], j["url"])
                if exists(j["dedupe_hash"]):
                    continue
                if active_filter and not passes(j, active_filter):
                    j["matched"] = False
                    j["score"] = 0
                else:
                    j["matched"] = True
                    j["score"] = match_score(j, active_filter) if active_filter else 50
                    j["matched_filter_ids"] = [active_filter["id"]] if active_filter else []
                j["user_id"] = user_id()
                db().table("jobs").insert(j).execute()
                items_out += 1
            except Exception as e:
                errors += 1
                log.warning("normalize_failed", error=str(e))

        db().table("sources").update({
            "last_run_at": datetime.now(timezone.utc).isoformat(),
            "last_run_status": "success" if errors == 0 else "partial",
            "last_run_count": items_out,
            "last_error": None,
        }).eq("id", row["id"]).execute()
        db().table("automation_runs").update({
            "status": "success", "items_in": items_in, "items_out": items_out,
            "errors": errors, "finished_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", run_id).execute()
        db_log("info", f"scraped {items_out}/{items_in} from {row['key']}",
               scope="sources", run_id=run_id,
               metadata={"items_in": items_in, "items_out": items_out, "errors": errors})
    except Exception as e:
        db().table("sources").update({
            "last_run_at": datetime.now(timezone.utc).isoformat(),
            "last_run_status": "failed", "last_error": str(e)[:1000],
        }).eq("id", row["id"]).execute()
        db().table("automation_runs").update({
            "status": "failed", "items_in": items_in, "items_out": items_out,
            "errors": errors + 1, "finished_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", run_id).execute()
        db_log("error", f"source {row['key']} failed: {e}", scope="sources", run_id=run_id)
