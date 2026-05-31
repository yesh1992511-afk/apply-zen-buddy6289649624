"""Direct Lever board scraper — public API.

Config: { "boards": ["netflix", "figma"] }   # Lever company slugs
"""
from typing import Any
from .base import Source, RawJob
from ._http import make_client, get_json


def _parse_salary(j: dict[str, Any]) -> tuple[int | None, int | None, str | None]:
    sr = j.get("salaryRange") or {}
    try:
        lo = int(sr["min"]) if sr.get("min") is not None else None
        hi = int(sr["max"]) if sr.get("max") is not None else None
    except (ValueError, TypeError):
        lo, hi = None, None
    cur = sr.get("currency") or None
    return lo, hi, cur


class LeverBoards(Source):
    key = "lever_boards"

    async def fetch(self, config: dict[str, Any]):
        boards = config.get("boards", [])
        out: list[RawJob] = []
        async with make_client() as c:
            for board in boards:
                try:
                    jobs = await get_json(c, f"https://api.lever.co/v0/postings/{board}", params={"mode": "json"})
                    jobs = jobs or []
                except Exception:
                    continue
                for j in jobs:
                    cats = j.get("categories") or {}
                    lo, hi, cur = _parse_salary(j)
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
                        salary_min=lo,
                        salary_max=hi,
                        salary_currency=cur,
                        posted_at=j.get("createdAt"),
                        raw={**j, "_lever_board": board},
                    ))
        return out
