"""Apify-backed LinkedIn jobs scraper.

Config shape (from public.sources.config):
{
  "queries": ["site reliability engineer", "platform engineer"],
  "locations": ["United States"],
  "remote": true,
  "rows": 100,
  "actor": "bebity~linkedin-jobs-scraper"   # optional override
}
"""
from typing import Any, AsyncIterator
import httpx
from .base import Source, RawJob
from ..config import settings
from ..logger import log


class ApifyLinkedIn(Source):
    key = "apify:linkedin"
    DEFAULT_ACTOR = "bebity~linkedin-jobs-scraper"

    async def fetch(self, config: dict[str, Any]):
        token = settings().APIFY_TOKEN
        if not token:
            log.warning("apify_token_missing")
            return []
        actor = config.get("actor", self.DEFAULT_ACTOR)
        payload = {
            "queries": config.get("queries", []),
            "locations": config.get("locations", []),
            "remote": config.get("remote", False),
            "rows": config.get("rows", 100),
        }
        url = f"https://api.apify.com/v2/acts/{actor}/run-sync-get-dataset-items?token={token}"
        async with httpx.AsyncClient(timeout=300) as c:
            r = await c.post(url, json=payload)
            r.raise_for_status()
            items = r.json()
        out: list[RawJob] = []
        for it in items:
            out.append(RawJob(
                source_job_id=str(it.get("id") or it.get("jobUrl") or it.get("link")),
                title=it.get("title") or "",
                company=it.get("companyName") or it.get("company") or "",
                url=it.get("jobUrl") or it.get("link") or "",
                location=it.get("location"),
                remote="remote" if it.get("workplaceType", "").lower() == "remote" else None,
                description=it.get("descriptionText") or it.get("description"),
                description_html=it.get("descriptionHtml"),
                employment_type=it.get("contractType"),
                seniority=it.get("experienceLevel"),
                posted_at=it.get("postedAt") or it.get("publishedAt"),
                raw=it,
            ))
        return out
