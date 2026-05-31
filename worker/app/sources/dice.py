"""Dice tech jobs — public JSON search.

Config: { "queries": ["python", "security engineer"], "location": "United States" }
"""
from typing import Any
from .base import Source, RawJob
from ._http import make_client, get_json


class Dice(Source):
    key = "dice"

    async def fetch(self, config: dict[str, Any]):
        queries = config.get("queries") or ["software engineer"]
        location = config.get("location") or "United States"
        out: list[RawJob] = []
        async with make_client() as c:
            for q in queries[:5]:
                try:
                    data = await get_json(
                        c, "https://service.dice.com/api/rest/jobsearch/v1/simple",
                        params={"q": q, "location": location, "pageSize": 50},
                    )
                    jobs = (data or {}).get("data") or []
                except Exception:
                    continue
                for j in jobs:
                    out.append(RawJob(
                        source_job_id=str(j.get("id") or j.get("jobId") or ""),
                        title=j.get("title") or "",
                        company=j.get("companyName") or "",
                        url=j.get("detailsPageUrl") or j.get("jobDetailUrl") or "",
                        location=j.get("jobLocation") or j.get("location"),
                        remote="remote" if (j.get("isRemote") or "remote" in (j.get("jobLocation") or "").lower()) else None,
                        description=j.get("summary"),
                        employment_type=j.get("employmentType"),
                        posted_at=j.get("postedDate") or j.get("modifiedDate"),
                        raw=j,
                    ))
        return out
