"""Source registry + orchestration."""
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
from .builtin import BuiltIn
from .usajobs import USAJobs
from .infosec_jobs import InfosecJobs
from .hn_jobs import HNJobs
from .hn_who_is_hiring import HNWhoIsHiring
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
    # US tech boards + federal
    BuiltIn(), USAJobs(),
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
                inserted = db().table("jobs").insert(j).execute().data
                items_out += 1
                if inserted and j.get("matched"):
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
    return inserted_matched_ids

