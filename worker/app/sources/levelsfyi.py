"""levels.fyi public salary-tracked job board.

Config: { "queries": ["software engineer"], "location": "United States" }
"""
from typing import Any
from .base import Source, RawJob
from ._http import make_client, get_json


class LevelsFYI(Source):
    key = "levelsfyi"

    async def fetch(self, config: dict[str, Any]):
        queries = config.get("queries") or ["software engineer"]
        location = config.get("location") or "United States"
        out: list[RawJob] = []
        async with make_client() as c:
            for q in queries[:5]:
                try:
                    data = await get_json(
                        c, "https://www.levels.fyi/js/jobs/search.json",
                        params={"q": q, "location": location, "limit": 50},
                    )
                    jobs = (data or {}).get("jobs") or data.get("results") or []
                except Exception:
                    continue
                for j in jobs:
                    salary = j.get("compensation") or {}
                    out.append(RawJob(
                        source_job_id=str(j.get("id") or j.get("jobId") or j.get("url") or ""),
                        title=j.get("title") or j.get("role") or "",
                        company=j.get("company") or "",
                        url=j.get("url") or j.get("applyUrl") or "",
                        location=j.get("location"),
                        remote="remote" if j.get("isRemote") else None,
                        description=j.get("description"),
                        salary_min=salary.get("min") or j.get("salary_min"),
                        salary_max=salary.get("max") or j.get("salary_max"),
                        salary_currency=salary.get("currency") or "USD",
                        posted_at=j.get("postedAt") or j.get("createdAt"),
                        raw=j,
                    ))
        return out
