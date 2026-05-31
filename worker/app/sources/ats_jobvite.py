"""Jobvite public RSS / JSON feeds — no auth required.

Config: { "companies": ["acmeco", "anotherco"] }

URL: https://jobs.jobvite.com/{company}/jobs/feed-json
Fallback: https://jobs.jobvite.com/{company}/jobs/rss
"""
from typing import Any
import httpx
from .base import Source, RawJob


class JobviteBoards(Source):
    key = "jobvite_boards"

    async def fetch(self, config: dict[str, Any]):
        companies = config.get("companies", [])
        out: list[RawJob] = []
        async with httpx.AsyncClient(timeout=30, headers={
            "User-Agent": "JobPilot/0.1",
            "Accept": "application/json",
        }) as c:
            for co in companies:
                co = co.strip().lower()
                if not co:
                    continue
                try:
                    r = await c.get(f"https://jobs.jobvite.com/{co}/jobs/feed-json")
                    if r.status_code != 200:
                        continue
                    payload = r.json() or {}
                    jobs = payload.get("jobs") or payload.get("items") or []
                except Exception:
                    continue
                for j in jobs:
                    out.append(RawJob(
                        source_job_id=str(j.get("eId") or j.get("id") or ""),
                        title=j.get("title") or j.get("name") or "",
                        company=co,
                        url=j.get("jobUrl") or j.get("applyUrl") or f"https://jobs.jobvite.com/{co}",
                        location=j.get("location"),
                        employment_type=j.get("jobType"),
                        description=j.get("description"),
                        posted_at=j.get("date") or j.get("postedDate"),
                        raw={**j, "_jobvite_co": co},
                    ))
        return out
