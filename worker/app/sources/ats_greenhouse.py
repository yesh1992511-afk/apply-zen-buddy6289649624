"""Direct Greenhouse board scraper — public API, no auth, no proxy needed.

Config: { "boards": ["airbnb", "stripe", "figma"] }   # company board tokens
"""
from typing import Any
import httpx
from .base import Source, RawJob


class GreenhouseBoards(Source):
    key = "greenhouse_boards"

    async def fetch(self, config: dict[str, Any]):
        boards = config.get("boards", [])
        out: list[RawJob] = []
        async with httpx.AsyncClient(timeout=60, headers={"User-Agent": "JobPilot/0.1"}) as c:
            for board in boards:
                try:
                    r = await c.get(f"https://boards-api.greenhouse.io/v1/boards/{board}/jobs?content=true")
                    r.raise_for_status()
                    jobs = (r.json() or {}).get("jobs", [])
                except Exception:
                    continue
                for j in jobs:
                    out.append(RawJob(
                        source_job_id=str(j.get("id")),
                        title=j.get("title") or "",
                        company=board,
                        url=j.get("absolute_url") or "",
                        location=(j.get("location") or {}).get("name"),
                        description=j.get("content"),
                        description_html=j.get("content"),
                        posted_at=j.get("updated_at"),
                        raw={**j, "_greenhouse_board": board},
                    ))
        return out
