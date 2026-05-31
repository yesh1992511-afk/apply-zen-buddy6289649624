"""infosec-jobs.com — free public JSON feed for cybersecurity roles.

config: { queries?: [str], country?: str, limit?: int }
"""
from typing import Any
import httpx
from .base import Source, RawJob


class InfosecJobs(Source):
    key = "infosec_jobs"

    async def fetch(self, config: dict[str, Any]):
        limit = int(config.get("limit") or 100)
        queries = [q.lower() for q in (config.get("queries") or []) if q]
        country = (config.get("country") or "").lower().strip()

        # infosec-jobs.com publishes a public JSON endpoint.
        url = "https://infosec-jobs.com/api/jobs"
        async with httpx.AsyncClient(timeout=60, headers={"User-Agent": "JobPilot/0.1"}) as c:
            try:
                r = await c.get(url, params={"limit": limit})
                r.raise_for_status()
                data = r.json()
            except Exception:
                # Fallback: RSS via rss2json bridge would add a dependency, so just bail.
                return []
        items = data if isinstance(data, list) else data.get("jobs") or data.get("results") or []

        out: list[RawJob] = []
        for i in items[:limit]:
            title = (i.get("title") or i.get("position") or "").strip()
            company = (i.get("company") or i.get("company_name") or "").strip()
            loc = (i.get("location") or i.get("city") or "").strip() or "Remote"
            slug = i.get("slug") or i.get("id") or ""
            link = i.get("url") or i.get("link") or (f"https://infosec-jobs.com/job/{slug}" if slug else "")
            desc = i.get("description") or i.get("summary") or ""
            hay = f"{title} {desc}".lower()

            if queries and not any(q in hay for q in queries):
                continue
            if country and country not in loc.lower() and "remote" not in loc.lower():
                continue
            if not (title and company and link):
                continue

            out.append(RawJob(
                source_job_id=str(slug) or None,
                title=title[:500],
                company=company[:300],
                url=link,
                location=loc[:300],
                remote="remote" if "remote" in loc.lower() else None,
                description=desc,
                description_html=desc,
                posted_at=i.get("published_at") or i.get("posted_at") or i.get("date"),
                raw=i,
            ))
        return out
