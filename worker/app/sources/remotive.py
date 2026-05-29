"""Remotive — free public API."""
from typing import Any
import httpx
from .base import Source, RawJob


class Remotive(Source):
    key = "remotive"

    async def fetch(self, config: dict[str, Any]):
        params: dict[str, Any] = {}
        if config.get("category"):
            params["category"] = config["category"]
        if config.get("queries"):
            params["search"] = " ".join(config["queries"])
        if config.get("limit"):
            params["limit"] = config["limit"]
        async with httpx.AsyncClient(timeout=60, headers={"User-Agent": "JobPilot/0.1"}) as c:
            r = await c.get("https://remotive.com/api/remote-jobs", params=params)
            r.raise_for_status()
            items = (r.json() or {}).get("jobs", [])
        return [
            RawJob(
                source_job_id=str(i.get("id")),
                title=i.get("title") or "",
                company=i.get("company_name") or "",
                url=i.get("url") or "",
                location=i.get("candidate_required_location") or "Remote",
                remote="remote",
                description=i.get("description"),
                description_html=i.get("description"),
                employment_type=i.get("job_type"),
                salary_currency="USD",
                posted_at=i.get("publication_date"),
                raw=i,
            ) for i in items
        ]
