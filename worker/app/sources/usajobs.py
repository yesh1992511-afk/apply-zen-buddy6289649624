"""USAJobs.gov public Search API — federal jobs, free, no key required for basic search.

Config: { "keyword": "software", "location": "Washington, DC", "results_per_page": 50 }
Endpoint: https://data.usajobs.gov/api/search
Note: an email User-Agent and Authorization-Key header are conventional but
optional for low-volume reads. Apply flow is OAuth-walled → scrape-only.
"""
from typing import Any
import os
import httpx
from .base import Source, RawJob


class USAJobs(Source):
    key = "usajobs"

    async def fetch(self, config: dict[str, Any]):
        params = {
            "Keyword": config.get("keyword", ""),
            "LocationName": config.get("location", ""),
            "ResultsPerPage": int(config.get("results_per_page", 50)),
        }
        headers = {
            "Host": "data.usajobs.gov",
            "User-Agent": os.getenv("USAJOBS_UA", "jobpilot@example.com"),
            "Accept": "application/json",
        }
        if key := os.getenv("USAJOBS_API_KEY"):
            headers["Authorization-Key"] = key

        out: list[RawJob] = []
        async with httpx.AsyncClient(timeout=60, headers=headers) as c:
            try:
                r = await c.get("https://data.usajobs.gov/api/search", params=params)
                r.raise_for_status()
                items = ((r.json() or {}).get("SearchResult") or {}).get("SearchResultItems") or []
            except Exception:
                return out
            for item in items:
                d = (item.get("MatchedObjectDescriptor") or {})
                pos_loc = (d.get("PositionLocation") or [{}])[0]
                remuneration = (d.get("PositionRemuneration") or [{}])[0]
                out.append(RawJob(
                    source_job_id=str(d.get("PositionID") or item.get("MatchedObjectId")),
                    title=d.get("PositionTitle") or "",
                    company=d.get("OrganizationName") or d.get("DepartmentName") or "USA Federal",
                    url=d.get("PositionURI") or "",
                    location=pos_loc.get("LocationName"),
                    remote="remote" if "telework" in (d.get("TeleworkEligible") or "").lower() else None,
                    description=(d.get("UserArea") or {}).get("Details", {}).get("JobSummary"),
                    employment_type=(d.get("PositionSchedule") or [{}])[0].get("Name"),
                    salary_min=int(float(remuneration.get("MinimumRange") or 0)) or None,
                    salary_max=int(float(remuneration.get("MaximumRange") or 0)) or None,
                    salary_currency=remuneration.get("RateIntervalCode") and "USD",
                    posted_at=d.get("PublicationStartDate"),
                    raw=d,
                ))
        return out
