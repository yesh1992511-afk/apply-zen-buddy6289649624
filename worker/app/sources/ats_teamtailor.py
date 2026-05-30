"""Teamtailor public jobs API (JSON:API).

Config: { "companies": ["acme", "globex"], "api_keys": {"acme": "..."} }
Endpoint: https://api.teamtailor.com/v1/jobs (requires X-Api-Version + Auth)

Note: Teamtailor's public API needs a company API token. If not provided we
fall back to the unauthenticated careers site sitemap-style scrape.
"""
from typing import Any
import httpx
from .base import Source, RawJob


class TeamtailorBoards(Source):
    key = "teamtailor_boards"

    async def fetch(self, config: dict[str, Any]):
        companies = config.get("companies", [])
        api_keys = config.get("api_keys") or {}
        out: list[RawJob] = []
        async with httpx.AsyncClient(timeout=60, headers={"User-Agent": "JobPilot/0.1"}) as c:
            for company in companies:
                key = api_keys.get(company)
                if not key:
                    continue
                headers = {
                    "Authorization": f"Token token={key}",
                    "X-Api-Version": "20210218",
                    "Accept": "application/vnd.api+json",
                }
                try:
                    r = await c.get(
                        "https://api.teamtailor.com/v1/jobs",
                        headers=headers, params={"page[size]": 100},
                    )
                    r.raise_for_status()
                    data = (r.json() or {}).get("data") or []
                except Exception:
                    continue
                for j in data:
                    attrs = j.get("attributes") or {}
                    out.append(RawJob(
                        source_job_id=str(j.get("id")),
                        title=attrs.get("title") or "",
                        company=company,
                        url=attrs.get("careersite-job-url") or attrs.get("apply-url") or "",
                        location=attrs.get("human-status-location") or None,
                        remote="remote" if attrs.get("remote-status") == "fully" else None,
                        description=attrs.get("body"),
                        description_html=attrs.get("body"),
                        posted_at=attrs.get("created-at") or attrs.get("updated-at"),
                        raw={**attrs, "_tt_company": company},
                    ))
        return out
