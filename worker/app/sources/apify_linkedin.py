"""Apify-backed LinkedIn jobs scraper (curious_coder/linkedin-jobs-scraper).

Config shape (from public.sources.config):
{
  "queries": ["site reliability engineer"],
  "locations": ["United States"],
  "remote": true,
  "rows": 100
}
"""
import os
from typing import Any
import httpx
from .base import Source, RawJob
from ..config import settings
from ..logger import log


class ApifyLinkedIn(Source):
    key = "apify:linkedin"
    DEFAULT_ACTOR = os.getenv("APIFY_LINKEDIN_ACTOR", "curious_coder~linkedin-jobs-scraper")

    async def fetch(self, config: dict[str, Any]):
        token = settings().APIFY_TOKEN
        if not token:
            log.warning("apify_token_missing")
            return []
        actor = config.get("actor", self.DEFAULT_ACTOR)
        # curious_coder expects `urls` or `keyword` + `location`. We accept either shape.
        payload: dict[str, Any] = {
            "count": config.get("rows", 100),
            "scrapeCompany": False,
            "proxy": {"useApifyProxy": True, "apifyProxyGroups": ["RESIDENTIAL"]},
        }
        if "urls" in config:
            payload["urls"] = config["urls"]
        else:
            payload["keyword"] = " ".join(config.get("queries", []))
            payload["location"] = (config.get("locations") or ["United States"])[0]
            if config.get("remote"):
                payload["workType"] = "2"  # 1=on-site, 2=remote, 3=hybrid

        url = f"https://api.apify.com/v2/acts/{actor}/run-sync-get-dataset-items?token={token}"
        async with httpx.AsyncClient(timeout=600) as c:
            r = await c.post(url, json=payload)
            r.raise_for_status()
            items = r.json()

        out: list[RawJob] = []
        for it in items:
            out.append(RawJob(
                source_job_id=str(it.get("id") or it.get("jobUrl") or it.get("link") or ""),
                title=it.get("title") or it.get("jobTitle") or "",
                company=it.get("companyName") or it.get("company") or "",
                url=it.get("jobUrl") or it.get("link") or it.get("url") or "",
                location=it.get("location"),
                remote="remote" if str(it.get("workplaceType", "")).lower() == "remote" else None,
                description=it.get("descriptionText") or it.get("description"),
                description_html=it.get("descriptionHtml"),
                employment_type=it.get("contractType") or it.get("employmentType"),
                seniority=it.get("experienceLevel") or it.get("seniority"),
                posted_at=it.get("postedAt") or it.get("publishedAt") or it.get("postedTime"),
                raw=it,
            ))
        return out
