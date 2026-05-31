"""Source registry + orchestration."""
import asyncio
from datetime import datetime, timezone, timedelta
from typing import Any
from .base import Source
from .apify_linkedin import ApifyLinkedIn
from .apify_bebity_linkedin import ApifyBebityLinkedIn
from .apify_indeed import ApifyIndeed
from .apify_misceres_indeed import ApifyMisceresIndeed
from .apify_ziprecruiter import ApifyZipRecruiter
from .apify_google_jobs import ApifyGoogleJobs
from .apify_glassdoor import ApifyGlassdoor
from .apify_wellfound import ApifyWellfound
from .remoteok import RemoteOK
from .weworkremotely import WeWorkRemotely
from .arbeitnow import Arbeitnow
from .remotive import Remotive
from .workatastartup import WorkAtAStartup
from .ats_greenhouse import GreenhouseBoards
from .ats_lever import LeverBoards
from .ats_ashby import AshbyBoards
from .ats_smartrecruiters import SmartRecruitersBoards
from .ats_workable import WorkableBoards
from .ats_recruitee import RecruiteeBoards
from .ats_teamtailor import TeamtailorBoards
from .ats_workday import WorkdayBoards
from .ats_bamboohr import BambooHRBoards
from .ats_personio import PersonioBoards
from .ats_breezyhr import BreezyHRBoards
from .ats_jobvite import JobviteBoards
from .ats_icims import ICIMSBoards
from .builtin import BuiltIn
from .usajobs import USAJobs
from .infosec_jobs import InfosecJobs
from .hn_jobs import HNJobs
from .hn_who_is_hiring import HNWhoIsHiring
from .ycombinator_jobs import YCombinatorJobs
from .dice import Dice
from .cybersecjobs import CyberSecJobs
from .cleared_jobs import ClearedJobs
from .levelsfyi import LevelsFYI
from ..db import db, user_id
from ..logger import db_log, log
from ..pipeline.normalize import normalize
from ..pipeline.dedupe import dedupe_hash, exists
from ..pipeline.filter_engine import load_active_filter, passes, match_score


ADAPTERS: dict[str, Source] = {a.key: a for a in [
    # LinkedIn: bebity primary, curious_coder fallback
    ApifyBebityLinkedIn(), ApifyLinkedIn(),
    # Indeed: misceres primary, generic fallback
    ApifyMisceresIndeed(), ApifyIndeed(),
    # Other portals
    ApifyZipRecruiter(), ApifyGoogleJobs(), ApifyGlassdoor(), ApifyWellfound(),
    # Free remote-first APIs
    RemoteOK(), WeWorkRemotely(), Arbeitnow(), Remotive(),
    # Startups + direct ATS boards
    WorkAtAStartup(), GreenhouseBoards(), LeverBoards(), AshbyBoards(),
    SmartRecruitersBoards(), WorkableBoards(), RecruiteeBoards(), TeamtailorBoards(),
    # Enterprise ATS (new)
    WorkdayBoards(), BambooHRBoards(), PersonioBoards(), BreezyHRBoards(),
    JobviteBoards(), ICIMSBoards(),
    # US tech boards + federal
    BuiltIn(), USAJobs(),
    # Cybersecurity-focused free sources
    InfosecJobs(), HNJobs(), HNWhoIsHiring(),
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
    """Run all due sources in parallel (capped by user parallelism setting)."""
    now = datetime.now(timezone.utc)
    rows = db().table("sources").select("*").eq("user_id", user_id()).execute().data or []
    due = [r for r in rows if force or _due(r, now)]
    if not due:
        return
    # Read user's parallelism preference (1-10) → scrape concurrency = parallelism * 4 (cap 16).
    s = db().table("automation_settings").select("parallelism").eq(
        "user_id", user_id()
    ).single().execute().data or {}
    concurrency = max(2, min(int(s.get("parallelism") or 2) * 4, 16))
    sem = asyncio.Semaphore(concurrency)

    async def _bounded(r: dict[str, Any]) -> None:
        async with sem:
            try:
                await asyncio.wait_for(_run_source(r), timeout=180)
            except asyncio.TimeoutError:
                db_log("warning", f"source {r['key']} timed out after 180s", scope="sources")
            except Exception as e:
                db_log("error", f"source {r['key']} crashed: {e}", scope="sources")

    await asyncio.gather(*[_bounded(r) for r in due], return_exceptions=True)


async def run_source_by_key(key: str, force: bool = True, match_limit: int | None = None) -> list[str]:
    """Run a single source. If match_limit is set, stop after that many matched
    jobs and return their newly-inserted IDs."""
    rows = db().table("sources").select("*").eq("user_id", user_id()).eq("key", key).execute().data or []
    inserted_ids: list[str] = []
    for r in rows:
        ids = await _run_source(r, match_limit=match_limit)
        inserted_ids.extend(ids)
    return inserted_ids


async def _run_source(row: dict[str, Any], match_limit: int | None = None) -> list[str]:
    inserted_matched_ids: list[str] = []
    adapter = ADAPTERS.get(row["key"])
    if not adapter:
        db_log("warning", f"no adapter for source key={row['key']}", scope="sources")
        return inserted_matched_ids

    run = db().table("automation_runs").insert({
        "user_id": user_id(), "kind": "scrape", "source_key": row["key"],
    }).execute().data[0]
    run_id = run["id"]

    items_in = items_out = errors = filtered_out = 0
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
                # Matched-only ingest: drop unmatched at the source. Jobs page
                # is matched-only from here on — never store discarded rows.
                if active_filter and not passes(j, active_filter):
                    filtered_out += 1
                    continue
                j["matched"] = True
                j["score"] = match_score(j, active_filter) if active_filter else 50
                j["matched_filter_ids"] = [active_filter["id"]] if active_filter else []
                j["user_id"] = user_id()
                inserted = db().table("jobs").insert(j).execute().data
                items_out += 1
                if inserted:
                    inserted_matched_ids.append(inserted[0]["id"])
                    if (j.get("score") or 0) >= 95:
                        try:
                            from .. import notify as _notify
                            _notify.high_score_job({**j, "id": inserted[0]["id"]})
                        except Exception as _e:
                            log.warning("high_score_notify_failed", error=str(_e))
                    if match_limit is not None and len(inserted_matched_ids) >= match_limit:
                        break
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
            "metadata": {"filtered_out": filtered_out, "kept": items_out},
        }).eq("id", run_id).execute()
        db_log("info", f"scraped {items_out}/{items_in} from {row['key']} (filtered {filtered_out})",
               scope="sources", run_id=run_id,
               metadata={"items_in": items_in, "items_out": items_out, "errors": errors, "filtered_out": filtered_out})
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
    return inserted_matched_ids

