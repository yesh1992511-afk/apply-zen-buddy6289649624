"""Direct Ashby board scraper — public JSON API.

Config: { "boards": ["openai", "linear", "vercel"] }   # Ashby org slugs

Endpoint: https://api.ashbyhq.com/posting-api/job-board/{org}?includeCompensation=true
"""
from typing import Any
import httpx
from .base import Source, RawJob


class AshbyBoards(Source):
    key = "ashby_boards"

    async def fetch(self, config: dict[str, Any]):
        boards = config.get("boards", [])
        out: list[RawJob] = []
        async with httpx.AsyncClient(timeout=60, headers={"User-Agent": "JobPilot/0.1"}) as c:
            for board in boards:
                try:
                    r = await c.get(
                        f"https://api.ashbyhq.com/posting-api/job-board/{board}",
                        params={"includeCompensation": "true"},
                    )
                    r.raise_for_status()
                    data = r.json() or {}
                    jobs = data.get("jobs") or []
                except Exception:
                    continue
                for j in jobs:
                    comp = j.get("compensation") or {}
                    summary = comp.get("compensationTierSummary") or {}
                    salary_min = summary.get("min")
                    salary_max = summary.get("max")
                    currency = summary.get("currencyCode") or "USD"
                    out.append(RawJob(
                        source_job_id=str(j.get("id")),
                        title=j.get("title") or "",
                        company=j.get("companyName") or board,
                        url=j.get("jobUrl") or j.get("applyUrl") or "",
                        location=j.get("location"),
                        remote="remote" if j.get("isRemote") else None,
                        description=j.get("descriptionPlain") or j.get("description"),
                        description_html=j.get("descriptionHtml") or j.get("description"),
                        employment_type=j.get("employmentType"),
                        seniority=None,
                        salary_min=int(salary_min) if salary_min else None,
                        salary_max=int(salary_max) if salary_max else None,
                        salary_currency=currency,
                        posted_at=j.get("publishedAt") or j.get("updatedAt"),
                        raw={**j, "_ashby_board": board},
                    ))
        return out
