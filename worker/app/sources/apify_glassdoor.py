"""Glassdoor via Apify.

Default actor switched to the free `bora_dural/glassdoor-jobs-scraper`. The
previous default (`bebity~glassdoor-jobs-scraper`) is paid and returns 403 for
workspaces without a subscription to that actor. Override via the source's
`config.actor` or the `APIFY_GLASSDOOR_ACTOR` env var.
"""
import os
from typing import Any
import httpx
from .base import Source, RawJob
from ._http import require_apify_token, wrap_apify_http_error, ApifyAccessError
from ..logger import log


class ApifyGlassdoor(Source):
    key = "apify:glassdoor"
    DEFAULT_ACTOR = os.getenv("APIFY_GLASSDOOR_ACTOR", "bora_dural~glassdoor-jobs-scraper")

    async def fetch(self, config: dict[str, Any]):
        try:
            token = require_apify_token()
        except ApifyAccessError as e:
            log.warning("apify_token_missing", source=self.key, error=str(e))
            raise
        actor = config.get("actor", self.DEFAULT_ACTOR)
        payload: dict[str, Any] = {
            "keyword": " ".join(config.get("queries", [])) or "software engineer",
            "location": (config.get("locations") or ["United States"])[0],
            "maxItems": config.get("rows", 100),
            "proxy": {"useApifyProxy": True, "apifyProxyGroups": ["RESIDENTIAL"]},
        }
        url = f"https://api.apify.com/v2/acts/{actor}/run-sync-get-dataset-items?token={token}"
        try:
            async with httpx.AsyncClient(timeout=900) as c:
                r = await c.post(url, json=payload)
                r.raise_for_status()
                items = r.json()
        except httpx.HTTPStatusError as e:
            raise wrap_apify_http_error(actor, e) from e
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
