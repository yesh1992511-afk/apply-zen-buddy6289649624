"""Direct Lever board scraper — public API.

Config: { "boards": ["netflix", "figma"] }   # Lever company slugs
"""
from typing import Any
import httpx
from .base import Source, RawJob


class LeverBoards(Source):
    key = "lever_boards"

    async def fetch(self, config: dict[str, Any]):
        boards = config.get("boards", [])
        out: list[RawJob] = []
        async with httpx.AsyncClient(timeout=60, headers={"User-Agent": "JobPilot/0.1"}) as c:
            for board in boards:
                try:
                    r = await c.get(f"https://api.lever.co/v0/postings/{board}?mode=json")
                    r.raise_for_status()
                    jobs = r.json() or []
                except Exception:
                    continue
                for j in jobs:
                    cats = j.get("categories") or {}
                    out.append(RawJob(
                        source_job_id=str(j.get("id")),
                        title=j.get("text") or "",
                        company=board,
                        url=j.get("hostedUrl") or j.get("applyUrl") or "",
                        location=cats.get("location"),
                        remote="remote" if "remote" in (cats.get("location") or "").lower() else None,
                        description=j.get("descriptionPlain") or j.get("description"),
                        description_html=j.get("description"),
                        employment_type=cats.get("commitment"),
                        seniority=cats.get("level"),
                        posted_at=j.get("createdAt"),
                        raw={**j, "_lever_board": board},
                    ))
        return out
