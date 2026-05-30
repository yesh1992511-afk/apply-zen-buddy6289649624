"""SmartRecruiters public posting API.

Config: { "companies": ["Square", "Bosch", "Visa"] }   # company identifiers
Endpoint: https://api.smartrecruiters.com/v1/companies/{company}/postings
"""
from typing import Any
import httpx
from .base import Source, RawJob


class SmartRecruitersBoards(Source):
    key = "smartrecruiters_boards"

    async def fetch(self, config: dict[str, Any]):
        companies = config.get("companies", [])
        out: list[RawJob] = []
        async with httpx.AsyncClient(timeout=60, headers={"User-Agent": "JobPilot/0.1"}) as c:
            for company in companies:
                offset = 0
                try:
                    while True:
                        r = await c.get(
                            f"https://api.smartrecruiters.com/v1/companies/{company}/postings",
                            params={"limit": 100, "offset": offset},
                        )
                        r.raise_for_status()
                        data = r.json() or {}
                        items = data.get("content") or []
                        if not items:
                            break
                        for j in items:
                            loc = j.get("location") or {}
                            loc_str = ", ".join(filter(None, [loc.get("city"), loc.get("region"), loc.get("country")]))
                            out.append(RawJob(
                                source_job_id=str(j.get("id")),
                                title=j.get("name") or "",
                                company=(j.get("company") or {}).get("name") or company,
                                url=j.get("ref") or f"https://jobs.smartrecruiters.com/{company}/{j.get('id')}",
                                location=loc_str or None,
                                remote=(loc.get("remote") and "remote") or None,
                                description=(j.get("jobAd") or {}).get("sections", {}).get("jobDescription", {}).get("text"),
                                employment_type=(j.get("typeOfEmployment") or {}).get("id"),
                                posted_at=j.get("releasedDate") or j.get("createdOn"),
                                raw={**j, "_sr_company": company},
                            ))
                        offset += len(items)
                        if offset >= data.get("totalFound", 0) or len(items) < 100:
                            break
                except Exception:
                    continue
        return out
