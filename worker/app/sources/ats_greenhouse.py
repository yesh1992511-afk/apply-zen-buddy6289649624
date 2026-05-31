"""Direct Greenhouse board scraper — public API, no auth, no proxy needed.

Config: { "boards": ["airbnb", "stripe", "figma"] }   # company board tokens
"""
from typing import Any
from .base import Source, RawJob
from ._http import make_client, get_json


def _parse_pay(j: dict[str, Any]) -> tuple[int | None, int | None, str | None]:
    """Greenhouse returns pay_input_ranges with min/max as numeric strings."""
    ranges = j.get("pay_input_ranges") or []
    if not ranges:
        return None, None, None
    r = ranges[0]
    try:
        lo = int(float(r.get("min_cents") or 0)) // 100 if r.get("min_cents") else (
            int(float(r.get("min_value"))) if r.get("min_value") else None
        )
        hi = int(float(r.get("max_cents") or 0)) // 100 if r.get("max_cents") else (
            int(float(r.get("max_value"))) if r.get("max_value") else None
        )
    except (ValueError, TypeError):
        lo, hi = None, None
    return lo, hi, r.get("currency_type") or "USD"


class GreenhouseBoards(Source):
    key = "greenhouse_boards"

    async def fetch(self, config: dict[str, Any]):
        boards = config.get("boards", [])
        out: list[RawJob] = []
        async with make_client() as c:
            for board in boards:
                try:
                    data = await get_json(
                        c, f"https://boards-api.greenhouse.io/v1/boards/{board}/jobs",
                        params={"content": "true"},
                    )
                    jobs = (data or {}).get("jobs", [])
                except Exception:
                    continue
                for j in jobs:
                    lo, hi, cur = _parse_pay(j)
                    out.append(RawJob(
                        source_job_id=str(j.get("id")),
                        title=j.get("title") or "",
                        company=board,
                        url=j.get("absolute_url") or "",
                        location=(j.get("location") or {}).get("name"),
                        description=j.get("content"),
                        description_html=j.get("content"),
                        salary_min=lo,
                        salary_max=hi,
                        salary_currency=cur,
                        posted_at=j.get("updated_at"),
                        raw={**j, "_greenhouse_board": board},
                    ))
        return out
