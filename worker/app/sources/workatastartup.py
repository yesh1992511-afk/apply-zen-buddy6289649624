"""Work at a Startup (YC) — public Algolia search index."""
from typing import Any
import httpx
from .base import Source, RawJob

ALGOLIA = "https://45bwzj1sgc-3.algolianet.com/1/indexes/WaaSPublicJob_production/query"
HEADERS = {
    "x-algolia-application-id": "45BWZJ1SGC",
    "x-algolia-api-key": "Nzc4MmExZmJlNDA2OWUyMzNkNDFmZmI3YjVlOTAyZjE3M2NhZjFmYTBlMWZlMjQxYTRkOWQ4OTU2ODI3MTYwM3RhZ0ZpbHRlcnM9JTVCJTIyaGlyaW5nJTIyJTVE",
    "Content-Type": "application/json",
}


class WorkAtAStartup(Source):
    key = "workatastartup"

    async def fetch(self, config: dict[str, Any]):
        q = " ".join(config.get("queries", [])) or ""
        params = f"query={q}&hitsPerPage={config.get('rows', 100)}"
        if config.get("remote"):
            params += "&facetFilters=%5B%22remote%3Atrue%22%5D"
        async with httpx.AsyncClient(timeout=60) as c:
            r = await c.post(ALGOLIA, headers=HEADERS, json={"params": params})
            r.raise_for_status()
            hits = (r.json() or {}).get("hits", [])
        out: list[RawJob] = []
        for h in hits:
            slug = h.get("company_slug") or ""
            jid = h.get("objectID") or h.get("id")
            out.append(RawJob(
                source_job_id=str(jid),
                title=h.get("title") or "",
                company=h.get("company_name") or "",
                url=f"https://www.workatastartup.com/jobs/{jid}",
                location=", ".join(h.get("locations") or []) if isinstance(h.get("locations"), list) else h.get("location"),
                remote="remote" if h.get("remote") else None,
                description=h.get("description"),
                salary_min=h.get("salary_min"),
                salary_max=h.get("salary_max"),
                salary_currency="USD",
                posted_at=h.get("created_at"),
                raw={**h, "company_slug": slug},
            ))
        return out
