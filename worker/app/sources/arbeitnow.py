"""Arbeitnow public board — free, no auth."""
from typing import Any
import httpx
from .base import Source, RawJob


class Arbeitnow(Source):
    key = "arbeitnow"

    async def fetch(self, config: dict[str, Any]):
        async with httpx.AsyncClient(timeout=60) as c:
            r = await c.get("https://www.arbeitnow.com/api/job-board-api")
            r.raise_for_status()
            data = r.json().get("data", [])
        return [
            RawJob(
                source_job_id=i.get("slug"),
                title=i.get("title") or "",
                company=i.get("company_name") or "",
                url=i.get("url") or "",
                location=i.get("location"),
                remote="remote" if i.get("remote") else None,
                description=i.get("description"),
                description_html=i.get("description"),
                employment_type=(i.get("job_types") or [None])[0],
                posted_at=i.get("created_at"),
                raw=i,
            )
            for i in data
        ]
