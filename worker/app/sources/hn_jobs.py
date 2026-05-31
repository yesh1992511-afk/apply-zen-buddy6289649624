"""Hacker News Algolia jobs index — keyword-filtered job listings.

Uses the public Algolia HN Search API (no key, no rate limit auth).
config: { queries?: [str], limit?: int }
"""
from typing import Any
import re
import httpx
from .base import Source, RawJob


_URL_RE = re.compile(r"https?://[^\s<>\"')]+")


class HNJobs(Source):
    key = "hn_jobs"

    async def fetch(self, config: dict[str, Any]):
        queries = [q for q in (config.get("queries") or []) if q]
        limit = int(config.get("limit") or 50)
        query = " ".join(queries) if queries else "engineer"

        async with httpx.AsyncClient(timeout=60, headers={"User-Agent": "JobPilot/0.1"}) as c:
            r = await c.get(
                "https://hn.algolia.com/api/v1/search_by_date",
                params={"tags": "job", "query": query, "hitsPerPage": min(limit, 100)},
            )
            r.raise_for_status()
            hits = (r.json() or {}).get("hits", [])

        out: list[RawJob] = []
        for h in hits:
            title = (h.get("title") or h.get("story_title") or "").strip()
            if not title:
                continue
            # HN job titles are typically "Company (YC X20) Is Hiring Foo Engineer"
            company = title.split(" Is Hiring")[0].split(" is hiring")[0].split(" (")[0].strip()
            external = h.get("url")
            hn_id = h.get("objectID")
            link = external or (f"https://news.ycombinator.com/item?id={hn_id}" if hn_id else "")
            if not link:
                continue
            out.append(RawJob(
                source_job_id=str(hn_id) if hn_id else None,
                title=title[:500],
                company=company[:300] or "Unknown",
                url=link,
                location="Remote / see post",
                description=h.get("story_text") or "",
                posted_at=h.get("created_at"),
                raw=h,
            ))
        return out
