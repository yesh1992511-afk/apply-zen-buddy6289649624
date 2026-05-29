"""Apify ZipRecruiter scraper (crawlerbros/ziprecruiter-scraper-pro).

Config:
{
  "queries": ["devops engineer"],
  "locations": ["Remote (USA)"],
  "rows": 100
}
"""
import os
from typing import Any
import httpx
from .base import Source, RawJob
from ..config import settings
from ..logger import log


class ApifyZipRecruiter(Source):
    key = "apify:ziprecruiter"
    DEFAULT_ACTOR = os.getenv("APIFY_ZIPRECRUITER_ACTOR", "crawlerbros~ziprecruiter-scraper-pro")

    async def fetch(self, config: dict[str, Any]):
        token = settings().APIFY_TOKEN
        if not token:
            log.warning("apify_token_missing")
            return []
        actor = config.get("actor", self.DEFAULT_ACTOR)
        payload = {
            "searchKeywords": config.get("queries", []),
            "locations": config.get("locations", ["United States"]),
            "maxItems": config.get("rows", 100),
            "proxyConfig": {"useApifyProxy": True, "apifyProxyGroups": ["RESIDENTIAL"]},
        }
        url = f"https://api.apify.com/v2/acts/{actor}/run-sync-get-dataset-items?token={token}"
        async with httpx.AsyncClient(timeout=600) as c:
            r = await c.post(url, json=payload)
            r.raise_for_status()
            items = r.json()
        out: list[RawJob] = []
        for it in items:
            out.append(RawJob(
                source_job_id=str(it.get("id") or it.get("jobId") or it.get("url") or ""),
                title=it.get("name") or it.get("title") or "",
                company=it.get("hiringCompany", {}).get("name") if isinstance(it.get("hiringCompany"), dict) else (it.get("company") or ""),
                url=it.get("url") or it.get("jobUrl") or "",
                location=it.get("location") or (it.get("address") or {}).get("formattedLocation"),
                remote="remote" if it.get("isRemote") else None,
                description=it.get("description") or it.get("snippet"),
                description_html=it.get("descriptionHtml"),
                employment_type=it.get("employmentType"),
                salary_min=(it.get("salary") or {}).get("min") if isinstance(it.get("salary"), dict) else None,
                salary_max=(it.get("salary") or {}).get("max") if isinstance(it.get("salary"), dict) else None,
                salary_currency=(it.get("salary") or {}).get("currency") if isinstance(it.get("salary"), dict) else None,
                posted_at=it.get("postedTime") or it.get("postedDate"),
                raw=it,
            ))
        return out
