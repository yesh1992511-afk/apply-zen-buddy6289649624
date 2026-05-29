"""Apify-backed Indeed scraper. Config: {queries, locations, rows, actor}"""
from typing import Any
import httpx
from .base import Source, RawJob
from ..config import settings


class ApifyIndeed(Source):
    key = "apify:indeed"
    DEFAULT_ACTOR = "misceres~indeed-scraper"

    async def fetch(self, config: dict[str, Any]):
        token = settings().APIFY_TOKEN
        if not token:
            return []
        actor = config.get("actor", self.DEFAULT_ACTOR)
        payload = {
            "position": ", ".join(config.get("queries", [])),
            "country": config.get("country", "US"),
            "location": ", ".join(config.get("locations", [])),
            "maxItems": config.get("rows", 100),
        }
        url = f"https://api.apify.com/v2/acts/{actor}/run-sync-get-dataset-items?token={token}"
        async with httpx.AsyncClient(timeout=300) as c:
            r = await c.post(url, json=payload)
            r.raise_for_status()
            items = r.json()
        return [
            RawJob(
                source_job_id=str(it.get("id") or it.get("url")),
                title=it.get("positionName") or it.get("title") or "",
                company=it.get("company") or "",
                url=it.get("url") or "",
                location=it.get("location"),
                description=it.get("description"),
                description_html=it.get("descriptionHTML"),
                salary_min=it.get("salary", {}).get("min") if isinstance(it.get("salary"), dict) else None,
                salary_max=it.get("salary", {}).get("max") if isinstance(it.get("salary"), dict) else None,
                posted_at=it.get("postingDateParsed") or it.get("postedAt"),
                raw=it,
            )
            for it in items
        ]
