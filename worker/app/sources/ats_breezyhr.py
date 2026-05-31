"""BreezyHR public jobs JSON — no auth required.

Config: { "companies": ["acmeco", "anotherco"] }

URL: https://{company}.breezy.hr/json
"""
from typing import Any
import httpx
from .base import Source, RawJob


class BreezyHRBoards(Source):
    key = "breezyhr_boards"

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
                    r = await c.get(f"https://{co}.breezy.hr/json")
                    if r.status_code != 200:
                        continue
                    jobs = r.json() or []
                except Exception:
                    continue
                for j in jobs:
                    out.append(RawJob(
                        source_job_id=str(j.get("_id") or j.get("id") or ""),
                        title=j.get("name") or "",
                        company=co,
                        url=j.get("url") or f"https://{co}.breezy.hr/p/{j.get('friendly_id', '')}",
                        location=(j.get("location") or {}).get("name") if isinstance(j.get("location"), dict) else j.get("location"),
                        employment_type=j.get("type", {}).get("name") if isinstance(j.get("type"), dict) else None,
                        description=j.get("description"),
                        posted_at=j.get("published_date") or j.get("creation_date"),
                        raw={**j, "_breezy_co": co},
                    ))
        return out
