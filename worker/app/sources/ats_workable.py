"""Workable public jobs feed.

Config: { "subdomains": ["acme", "globex"] }   # company subdomain on apply.workable.com
Endpoint: https://apply.workable.com/api/v3/accounts/{sub}/jobs (POST, paginated)
"""
from typing import Any
import httpx
from .base import Source, RawJob


class WorkableBoards(Source):
    key = "workable_boards"

    async def fetch(self, config: dict[str, Any]):
        subs = config.get("subdomains", [])
        out: list[RawJob] = []
        async with httpx.AsyncClient(timeout=60, headers={"User-Agent": "JobPilot/0.1"}) as c:
            for sub in subs:
                token = None
                try:
                    while True:
                        body: dict[str, Any] = {"query": "", "location": {}}
                        if token:
                            body["token"] = token
                        r = await c.post(
                            f"https://apply.workable.com/api/v3/accounts/{sub}/jobs",
                            json=body,
                        )
                        r.raise_for_status()
                        data = r.json() or {}
                        results = data.get("results") or []
                        if not results:
                            break
                        for j in results:
                            loc = j.get("location") or {}
                            loc_str = ", ".join(filter(None, [loc.get("city"), loc.get("region"), loc.get("country")]))
                            shortcode = j.get("shortcode") or j.get("id")
                            out.append(RawJob(
                                source_job_id=str(shortcode),
                                title=j.get("title") or "",
                                company=(j.get("company") or {}).get("title") or sub,
                                url=f"https://apply.workable.com/{sub}/j/{shortcode}/",
                                location=loc_str or None,
                                remote="remote" if loc.get("workplace") == "remote" else None,
                                description=j.get("description"),
                                employment_type=j.get("employment_type"),
                                posted_at=j.get("published_on") or j.get("created_at"),
                                raw={**j, "_workable_sub": sub},
                            ))
                        token = data.get("nextPage")
                        if not token:
                            break
                except Exception:
                    continue
        return out
