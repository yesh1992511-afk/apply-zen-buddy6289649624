"""Apify Google Jobs scraper (khadinakbar/google-jobs-scraper).

Config:
{
  "queries": ["backend engineer remote"],
  "locations": ["United States"],
  "rows": 100
}
"""
import os
from typing import Any
import httpx
from .base import Source, RawJob
from ..config import settings
from ..logger import log


class ApifyGoogleJobs(Source):
    key = "apify:google_jobs"
    DEFAULT_ACTOR = os.getenv("APIFY_GOOGLE_JOBS_ACTOR", "khadinakbar~google-jobs-scraper")

    async def fetch(self, config: dict[str, Any]):
        token = settings().APIFY_TOKEN
        if not token:
            log.warning("apify_token_missing")
            return []
        actor = config.get("actor", self.DEFAULT_ACTOR)
        payload = {
            "queries": config.get("queries", []),
            "location": (config.get("locations") or ["United States"])[0],
            "maxItems": config.get("rows", 100),
            "proxy": {"useApifyProxy": True},
        }
        url = f"https://api.apify.com/v2/acts/{actor}/run-sync-get-dataset-items?token={token}"
        async with httpx.AsyncClient(timeout=600) as c:
            r = await c.post(url, json=payload)
            r.raise_for_status()
            items = r.json()
        out: list[RawJob] = []
        for it in items:
            link = it.get("applyLink") or it.get("shareLink") or it.get("link") or ""
            out.append(RawJob(
                source_job_id=str(it.get("jobId") or link),
                title=it.get("title") or "",
                company=it.get("companyName") or it.get("company") or "",
                url=link,
                location=it.get("location"),
                remote="remote" if "remote" in (it.get("location") or "").lower() else None,
                description=it.get("description"),
                employment_type=(it.get("metadata") or {}).get("scheduleType"),
                posted_at=it.get("postedAt") or (it.get("metadata") or {}).get("postedAt"),
                raw=it,
            ))
        return out
