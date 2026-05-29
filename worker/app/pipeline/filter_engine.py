"""Filter engine: applies user's active filter to normalized jobs."""
from datetime import datetime, timezone, timedelta
from typing import Any
from rapidfuzz import fuzz
from ..db import db, user_id


def load_active_filter() -> dict[str, Any] | None:
    s = db().table("automation_settings").select("active_filter_id").eq(
        "user_id", user_id()
    ).single().execute().data or {}
    fid = s.get("active_filter_id")
    if fid:
        r = db().table("filters").select("*").eq("id", fid).single().execute().data
        if r:
            return r
    # fallback: default filter
    r = db().table("filters").select("*").eq("user_id", user_id()).eq(
        "is_default", True
    ).limit(1).execute().data
    return r[0] if r else None


def _contains_any(text: str, needles: list[str]) -> bool:
    t = (text or "").lower()
    return any(n.lower() in t for n in needles or [])


def passes(job: dict[str, Any], f: dict[str, Any]) -> bool:
    title = job.get("title") or ""
    company = job.get("company") or ""
    desc = job.get("description") or ""
    loc = job.get("location") or ""
    remote = (job.get("remote") or "").lower()

    if _contains_any(company, f.get("exclude_companies") or []):
        return False
    if _contains_any(title + " " + desc, f.get("exclude_keywords") or []):
        return False
    kws = f.get("keywords") or []
    if kws and not _contains_any(title + " " + desc, kws):
        return False
    if f.get("remote_only") and remote != "remote":
        return False
    locs = f.get("locations") or []
    if locs and not (remote == "remote" or _contains_any(loc, locs)):
        return False
    smin = f.get("salary_min")
    if smin and (job.get("salary_max") or 0) and job["salary_max"] < smin:
        return False
    pwh = f.get("posted_within_hours")
    if pwh and job.get("posted_at"):
        try:
            ts = datetime.fromisoformat(job["posted_at"].replace("Z", "+00:00"))
            if datetime.now(timezone.utc) - ts > timedelta(hours=pwh):
                return False
        except Exception:
            pass
    return True


def match_score(job: dict[str, Any], f: dict[str, Any] | None) -> int:
    if not f:
        return 50
    title = (job.get("title") or "").lower()
    desc = (job.get("description") or "").lower()
    kws = [k.lower() for k in (f.get("keywords") or [])]
    if not kws:
        return 60
    title_hits = sum(1 for k in kws if k in title)
    desc_hits = sum(1 for k in kws if k in desc)
    fuzzy = max((fuzz.partial_ratio(k, title) for k in kws), default=0) / 100
    score = min(100, int(40 * fuzzy + 12 * title_hits + 6 * desc_hits))
    return max(score, f.get("min_score") or 0)
