"""Glassdoor via Apify (bebity/glassdoor-jobs-scraper)."""
import os
from typing import Any
import httpx
from .base import Source, RawJob
from ..config import settings
from ..logger import log


class ApifyGlassdoor(Source):
    key = "apify:glassdoor"
    DEFAULT_ACTOR = os.getenv("APIFY_GLASSDOOR_ACTOR", "bebity~glassdoor-jobs-scraper")

    async def fetch(self, config: dict[str, Any]):
        token = settings().APIFY_TOKEN
        if not token:
            log.warning("apify_token_missing", source=self.key); return []
        actor = config.get("actor", self.DEFAULT_ACTOR)
        payload: dict[str, Any] = {
            "keyword": " ".join(config.get("queries", [])) or "software engineer",
            "location": (config.get("locations") or ["United States"])[0],
            "maxItems": config.get("rows", 100),
            "proxy": {"useApifyProxy": True, "apifyProxyGroups": ["RESIDENTIAL"]},
        }
        url = f"https://api.apify.com/v2/acts/{actor}/run-sync-get-dataset-items?token={token}"
        async with httpx.AsyncClient(timeout=900) as c:
            r = await c.post(url, json=payload); r.raise_for_status(); items = r.json()
        out: list[RawJob] = []
        for it in items:
            out.append(RawJob(
                source_job_id=str(it.get("id") or it.get("jobUrl") or ""),
                title=it.get("jobTitle") or it.get("title") or "",
                company=it.get("companyName") or it.get("employer") or "",
                url=it.get("jobUrl") or it.get("url") or "",
                location=it.get("location"),
                description=it.get("description") or it.get("jobDescription"),
                description_html=it.get("descriptionHtml"),
                salary_min=it.get("salaryMin"),
                salary_max=it.get("salaryMax"),
                salary_currency=it.get("salaryCurrency"),
                posted_at=it.get("postedDate") or it.get("ageInDays"),
                raw=it,
            ))
        return out
