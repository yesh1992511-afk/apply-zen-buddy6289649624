"""Convert RawJob → dict ready for public.jobs."""
from datetime import datetime, timezone
from typing import Any
from dateutil import parser as dtp  # type: ignore
from ..sources.base import RawJob


def _parse_dt(v: Any) -> str | None:
    if not v:
        return None
    if isinstance(v, (int, float)):
        return datetime.fromtimestamp(v, tz=timezone.utc).isoformat()
    if isinstance(v, str):
        try:
            return dtp.parse(v).astimezone(timezone.utc).isoformat()
        except Exception:
            return None
    return None


def normalize(raw: RawJob, *, source_key: str) -> dict[str, Any]:
    return {
        "source_key": source_key,
        "source_job_id": raw.source_job_id,
        "title": (raw.title or "").strip()[:500],
        "company": (raw.company or "").strip()[:300],
        "location": (raw.location or "").strip()[:300] or None,
        "remote": raw.remote,
        "url": raw.url,
        "description": raw.description,
        "description_html": raw.description_html,
        "employment_type": raw.employment_type,
        "seniority": raw.seniority,
        "salary_min": raw.salary_min,
        "salary_max": raw.salary_max,
        "salary_currency": raw.salary_currency,
        "posted_at": _parse_dt(raw.posted_at),
        "raw": raw.raw,
    }
