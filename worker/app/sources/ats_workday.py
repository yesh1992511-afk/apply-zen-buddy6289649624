"""Workday CXS public jobs API — no auth required.

Config: { "sites": [
    {"host": "wd5.myworkdayjobs.com", "tenant": "nvidia", "site": "NVIDIAExternalCareerSite"},
    ...
] }

Workday URL pattern:
  https://{host}/wday/cxs/{tenant}/{site}/jobs
POST body: {"appliedFacets":{},"limit":20,"offset":0,"searchText":""}
"""
from typing import Any
import httpx
from .base import Source, RawJob


class WorkdayBoards(Source):
    key = "workday_boards"

    async def fetch(self, config: dict[str, Any]):
        sites = config.get("sites", [])
        keywords = config.get("queries") or [""]
        out: list[RawJob] = []
        async with httpx.AsyncClient(
            timeout=45,
            headers={
                "User-Agent": "JobPilot/0.1",
                "Accept": "application/json",
                "Content-Type": "application/json",
            },
        ) as c:
            for site in sites:
                host = site.get("host", "").strip()
                tenant = site.get("tenant", "").strip()
                site_name = site.get("site", "").strip()
                if not (host and tenant and site_name):
                    continue
                url = f"https://{host}/wday/cxs/{tenant}/{site_name}/jobs"
                for kw in keywords[:3]:
                    try:
                        body = {
                            "appliedFacets": {},
                            "limit": 50,
                            "offset": 0,
                            "searchText": kw or "",
                        }
                        r = await c.post(url, json=body)
                        if r.status_code != 200:
                            continue
                        postings = (r.json() or {}).get("jobPostings", [])
                    except Exception:
                        continue
                    for j in postings:
                        ext_path = j.get("externalPath") or ""
                        out.append(RawJob(
                            source_job_id=j.get("bulletFields", [None])[0] or ext_path,
                            title=j.get("title") or "",
                            company=tenant,
                            url=f"https://{host}{ext_path}" if ext_path else f"https://{host}",
                            location=j.get("locationsText"),
                            posted_at=j.get("postedOn"),
                            raw={**j, "_workday_site": site_name},
                        ))
        return out
