"""Misceres Indeed Scraper — most reliable Indeed actor in 2025.

Actor: misceres/indeed-scraper
"""
import os
from typing import Any
import httpx
from .base import Source, RawJob
from ..config import settings
from ..logger import log


class ApifyMisceresIndeed(Source):
    key = "apify:indeed_misceres"
    DEFAULT_ACTOR = os.getenv("APIFY_MISCERES_INDEED_ACTOR", "misceres~indeed-scraper")

    async def fetch(self, config: dict[str, Any]):
        token = settings().APIFY_TOKEN
        if not token:
            log.warning("apify_token_missing", source=self.key)
            return []
        actor = config.get("actor", self.DEFAULT_ACTOR)
        country = config.get("country", "US")
        payload: dict[str, Any] = {
            "position": " ".join(config.get("queries", [])) or "software engineer",
            "country": country,
            "location": (config.get("locations") or [""])[0],
            "maxItems": config.get("rows", 100),
            "parseCompanyDetails": False,
            "saveOnlyUniqueItems": True,
            "followApplyRedirects": False,
            "proxy": {"useApifyProxy": True, "apifyProxyGroups": ["RESIDENTIAL"], "apifyProxyCountry": country},
        }
        if config.get("remote"):
            payload["jobType"] = "remote"
        if config.get("posted_within_days"):
            payload["maxAge"] = config["posted_within_days"]

        url = f"https://api.apify.com/v2/acts/{actor}/run-sync-get-dataset-items?token={token}"
        async with httpx.AsyncClient(timeout=900) as c:
            r = await c.post(url, json=payload)
            r.raise_for_status()
            items = r.json()

        out: list[RawJob] = []
        for it in items:
            out.append(RawJob(
                source_job_id=str(it.get("id") or it.get("positionId") or it.get("url") or ""),
                title=it.get("positionName") or it.get("title") or "",
                company=it.get("company") or "",
                url=it.get("url") or it.get("externalApplyLink") or "",
                location=it.get("location"),
                remote="remote" if it.get("isRemote") else None,
                description=it.get("description"),
                description_html=it.get("descriptionHTML"),
                employment_type=(it.get("jobType") or [None])[0] if isinstance(it.get("jobType"), list) else it.get("jobType"),
                salary_min=(it.get("salary") or {}).get("salaryMin") if isinstance(it.get("salary"), dict) else None,
                salary_max=(it.get("salary") or {}).get("salaryMax") if isinstance(it.get("salary"), dict) else None,
                salary_currency=(it.get("salary") or {}).get("currency") if isinstance(it.get("salary"), dict) else None,
                posted_at=it.get("postingDateParsed") or it.get("postedAt"),
                raw=it,
            ))
        return out
