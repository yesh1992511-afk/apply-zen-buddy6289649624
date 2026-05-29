"""Bebity LinkedIn Jobs Scraper — community gold-standard.

Actor: bebity/linkedin-jobs-scraper
Config: { queries: [str], locations: [str], remote: bool, rows: int, published_at: "r86400" }
"""
import os
from typing import Any
import httpx
from .base import Source, RawJob
from ..config import settings
from ..logger import log


class ApifyBebityLinkedIn(Source):
    key = "apify:linkedin_bebity"
    DEFAULT_ACTOR = os.getenv("APIFY_BEBITY_LINKEDIN_ACTOR", "bebity~linkedin-jobs-scraper")

    async def fetch(self, config: dict[str, Any]):
        token = settings().APIFY_TOKEN
        if not token:
            log.warning("apify_token_missing", source=self.key)
            return []
        actor = config.get("actor", self.DEFAULT_ACTOR)
        payload: dict[str, Any] = {
            "title": " ".join(config.get("queries", [])) or "software engineer",
            "location": (config.get("locations") or ["United States"])[0],
            "rows": config.get("rows", 100),
            "publishedAt": config.get("published_at", "r604800"),  # last 7d
            "proxy": {"useApifyProxy": True, "apifyProxyGroups": ["RESIDENTIAL"]},
        }
        if config.get("remote"):
            payload["workType"] = "2"
        if config.get("experience_level"):
            payload["experienceLevel"] = config["experience_level"]
        if config.get("company_ids"):
            payload["companyId"] = config["company_ids"]

        url = f"https://api.apify.com/v2/acts/{actor}/run-sync-get-dataset-items?token={token}"
        async with httpx.AsyncClient(timeout=900) as c:
            r = await c.post(url, json=payload)
            r.raise_for_status()
            items = r.json()

        out: list[RawJob] = []
        for it in items:
            out.append(RawJob(
                source_job_id=str(it.get("id") or it.get("link") or ""),
                title=it.get("title") or "",
                company=it.get("companyName") or "",
                url=it.get("link") or it.get("jobUrl") or "",
                location=it.get("location"),
                remote="remote" if "remote" in str(it.get("workplaceType", "")).lower() else None,
                description=it.get("descriptionText") or it.get("description"),
                description_html=it.get("descriptionHtml"),
                employment_type=it.get("contractType"),
                seniority=it.get("experienceLevel"),
                posted_at=it.get("publishedAt") or it.get("postedAt"),
                raw=it,
            ))
        return out
