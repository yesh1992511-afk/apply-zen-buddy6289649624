"""iCIMS public job feed.

Config: { "portals": [
    {"host": "careers-acme.icims.com", "company": "acme"},
    ...
] }

URL: https://{host}/jobs/search?ss=1&format=json
"""
from typing import Any
import httpx
from .base import Source, RawJob


class ICIMSBoards(Source):
    key = "icims_boards"

    async def fetch(self, config: dict[str, Any]):
        portals = config.get("portals", [])
        out: list[RawJob] = []
        async with httpx.AsyncClient(timeout=30, headers={
            "User-Agent": "JobPilot/0.1",
            "Accept": "application/json",
        }) as c:
            for portal in portals:
                host = portal.get("host", "").strip()
                co = portal.get("company", "").strip() or host.split(".")[0]
                if not host:
                    continue
                try:
                    r = await c.get(f"https://{host}/jobs/search", params={"ss": 1, "format": "json"})
                    if r.status_code != 200:
                        continue
                    payload = r.json() or {}
                    jobs = payload.get("searchResults") or payload.get("jobs") or []
                except Exception:
                    continue
                for j in jobs:
                    jid = str(j.get("id") or j.get("jobId") or "")
                    out.append(RawJob(
                        source_job_id=jid,
                        title=j.get("title") or "",
                        company=co,
                        url=j.get("url") or f"https://{host}/jobs/{jid}/job",
                        location=j.get("location") or j.get("city"),
                        posted_at=j.get("postingDate") or j.get("datePosted"),
                        raw={**j, "_icims_host": host},
                    ))
        return out
