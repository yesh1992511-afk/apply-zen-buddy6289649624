"""Recruitee public offers API.

Config: { "companies": ["acme", "globex"] }   # {company}.recruitee.com subdomains
Endpoint: https://{company}.recruitee.com/api/offers/
"""
from typing import Any
import httpx
from .base import Source, RawJob


class RecruiteeBoards(Source):
    key = "recruitee_boards"

    async def fetch(self, config: dict[str, Any]):
        companies = config.get("companies", [])
        out: list[RawJob] = []
        async with httpx.AsyncClient(timeout=60, headers={"User-Agent": "JobPilot/0.1"}) as c:
            for company in companies:
                try:
                    r = await c.get(f"https://{company}.recruitee.com/api/offers/")
                    r.raise_for_status()
                    offers = (r.json() or {}).get("offers") or []
                except Exception:
                    continue
                for j in offers:
                    loc = ", ".join(filter(None, [j.get("city"), j.get("country")]))
                    out.append(RawJob(
                        source_job_id=str(j.get("id")),
                        title=j.get("title") or "",
                        company=j.get("company_name") or company,
                        url=j.get("careers_url") or j.get("careers_apply_url") or "",
                        location=loc or None,
                        remote="remote" if j.get("remote") else None,
                        description=j.get("description"),
                        description_html=j.get("description"),
                        employment_type=j.get("employment_type_code"),
                        posted_at=j.get("created_at"),
                        raw={**j, "_recruitee_company": company},
                    ))
        return out
