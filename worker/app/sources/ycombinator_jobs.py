"""YC Jobs — Work at a Startup public listings (extends WorkAtAStartup with broader endpoint).

Hits the YC public companies feed and folds in open roles.
Config: {} (no params).
"""
from typing import Any
from .base import Source, RawJob
from ._http import make_client, get_json


class YCombinatorJobs(Source):
    key = "yc_jobs"

    async def fetch(self, config: dict[str, Any]):
        out: list[RawJob] = []
        async with make_client() as c:
            try:
                data = await get_json(c, "https://www.workatastartup.com/api_v1/jobs.json")
            except Exception:
                return out
            jobs = data if isinstance(data, list) else (data.get("jobs") or [])
            for j in jobs[:500]:
                company = (j.get("company") or {}).get("name") if isinstance(j.get("company"), dict) else j.get("company_name")
                out.append(RawJob(
                    source_job_id=str(j.get("id")),
                    title=j.get("title") or j.get("role") or "",
                    company=company or "YC company",
                    url=j.get("url") or j.get("apply_url") or "",
                    location=j.get("location"),
                    remote="remote" if j.get("remote") else None,
                    description=j.get("description"),
                    employment_type=j.get("type"),
                    salary_min=j.get("salary_min"),
                    salary_max=j.get("salary_max"),
                    salary_currency=j.get("salary_currency") or "USD",
                    posted_at=j.get("created_at") or j.get("posted_at"),
                    raw=j,
                ))
        return out
