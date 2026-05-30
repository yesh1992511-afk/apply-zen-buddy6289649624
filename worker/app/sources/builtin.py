"""BuiltIn public job search API.

Config: { "queries": ["software engineer"], "locations": ["remote", "new-york"] }
Endpoint: https://www.builtin.com/jobs/search (JSON, paginated)

Apply URLs redirect out to the underlying ATS (Greenhouse/Lever/Ashby etc.),
which are already covered by other apply adapters.
"""
from typing import Any
import httpx
from .base import Source, RawJob


class BuiltIn(Source):
    key = "builtin"

    async def fetch(self, config: dict[str, Any]):
        queries = config.get("queries", [""])
        locations = config.get("locations", [""])
        limit = int(config.get("limit", 50))
        out: list[RawJob] = []
        async with httpx.AsyncClient(timeout=60, headers={
            "User-Agent": "Mozilla/5.0 JobPilot",
            "Accept": "application/json",
        }) as c:
            for q in queries:
                for loc in locations:
                    try:
                        r = await c.get(
                            "https://www.builtin.com/api/v1/jobs/search",
                            params={"search": q, "location": loc, "limit": limit},
                        )
                        r.raise_for_status()
                        jobs = (r.json() or {}).get("jobs") or []
                    except Exception:
                        continue
                    for j in jobs:
                        out.append(RawJob(
                            source_job_id=str(j.get("id")),
                            title=j.get("title") or "",
                            company=(j.get("company") or {}).get("title") or "",
                            url=j.get("url") or j.get("applyUrl") or "",
                            location=j.get("locationFormatted") or loc or None,
                            remote="remote" if j.get("remote") else None,
                            description=j.get("description"),
                            employment_type=j.get("employmentType"),
                            seniority=j.get("experienceLevel"),
                            salary_min=j.get("salaryMin"),
                            salary_max=j.get("salaryMax"),
                            salary_currency="USD",
                            posted_at=j.get("publishedAt") or j.get("createdAt"),
                            raw=j,
                        ))
        return out
