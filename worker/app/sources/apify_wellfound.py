"""Wellfound (AngelList Talent) via Apify."""
import os
from typing import Any
import httpx
from .base import Source, RawJob
from ..config import settings
from ..logger import log


class ApifyWellfound(Source):
    key = "apify:wellfound"
    DEFAULT_ACTOR = os.getenv("APIFY_WELLFOUND_ACTOR", "epctex~wellfound-scraper")

    async def fetch(self, config: dict[str, Any]):
        token = settings().APIFY_TOKEN
        if not token:
            log.warning("apify_token_missing", source=self.key); return []
        actor = config.get("actor", self.DEFAULT_ACTOR)
        payload: dict[str, Any] = {
            "search": " ".join(config.get("queries", [])) or "software engineer",
            "location": config.get("locations") or [],
            "maxItems": config.get("rows", 100),
            "remote": bool(config.get("remote")),
            "proxy": {"useApifyProxy": True, "apifyProxyGroups": ["RESIDENTIAL"]},
        }
        url = f"https://api.apify.com/v2/acts/{actor}/run-sync-get-dataset-items?token={token}"
        async with httpx.AsyncClient(timeout=900) as c:
            r = await c.post(url, json=payload); r.raise_for_status(); items = r.json()
        out: list[RawJob] = []
        for it in items:
            out.append(RawJob(
                source_job_id=str(it.get("id") or it.get("url") or ""),
                title=it.get("title") or "",
                company=(it.get("startup") or {}).get("name") if isinstance(it.get("startup"), dict) else it.get("companyName") or "",
                url=it.get("url") or "",
                location=", ".join(it.get("locationNames") or []) if isinstance(it.get("locationNames"), list) else it.get("location"),
                remote="remote" if it.get("remote") else None,
                description=it.get("description"),
                salary_min=it.get("salaryMin"),
                salary_max=it.get("salaryMax"),
                salary_currency="USD",
                posted_at=it.get("createdAt") or it.get("postedAt"),
                raw=it,
            ))
        return out
