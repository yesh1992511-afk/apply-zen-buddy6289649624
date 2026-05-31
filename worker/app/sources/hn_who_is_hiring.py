"""Hacker News 'Ask HN: Who is hiring?' monthly thread.

Pulls comments from the latest 'Who is hiring?' thread via the Algolia HN
Search API, then keyword-filters each comment locally. No API key required.

config: { queries?: [str], remote_only?: bool, limit?: int }
"""
from typing import Any
import re
import html as _html
import httpx
from .base import Source, RawJob


_URL_RE = re.compile(r"https?://[^\s<>\"')]+")
_REMOTE_RE = re.compile(r"\bremote\b", re.I)
_ONSITE_RE = re.compile(r"\b(onsite|on-site|in[- ]office)\b", re.I)


def _strip_html(s: str) -> str:
    s = re.sub(r"<[^>]+>", " ", s or "")
    s = _html.unescape(s)
    return re.sub(r"\s+", " ", s).strip()


async def _latest_thread_id(client: httpx.AsyncClient) -> int | None:
    r = await client.get(
        "https://hn.algolia.com/api/v1/search",
        params={"query": "Ask HN: Who is hiring", "tags": "story,author_whoishiring",
                "hitsPerPage": 1},
    )
    r.raise_for_status()
    hits = (r.json() or {}).get("hits") or []
    if not hits:
        return None
    return int(hits[0]["objectID"])


class HNWhoIsHiring(Source):
    key = "hn_who_is_hiring"

    async def fetch(self, config: dict[str, Any]):
        queries = [q.lower() for q in (config.get("queries") or []) if q]
        remote_only = bool(config.get("remote_only"))
        limit = int(config.get("limit") or 200)

        async with httpx.AsyncClient(timeout=60, headers={"User-Agent": "JobPilot/0.1"}) as c:
            tid = await _latest_thread_id(c)
            if not tid:
                return []
            # Fetch all comments from that thread
            r = await c.get(
                "https://hn.algolia.com/api/v1/search",
                params={"tags": f"comment,story_{tid}", "hitsPerPage": 1000},
            )
            r.raise_for_status()
            hits = (r.json() or {}).get("hits") or []

        out: list[RawJob] = []
        for h in hits[:limit]:
            raw_html = h.get("comment_text") or ""
            text = _strip_html(raw_html)
            if not text or len(text) < 40:
                continue
            low = text.lower()
            if queries and not any(q in low for q in queries):
                continue
            if remote_only and not _REMOTE_RE.search(text):
                continue

            # First line is usually "Company | Title | Location | Remote/Onsite"
            first_line = text.split(".")[0][:300]
            parts = [p.strip() for p in re.split(r"\s*[|•·–-]\s*", first_line) if p.strip()]
            company = parts[0] if parts else "HN Who is Hiring"
            title = parts[1] if len(parts) > 1 else first_line[:120]
            location = next((p for p in parts[2:] if not _REMOTE_RE.search(p) and not _ONSITE_RE.search(p)),
                            "Remote" if _REMOTE_RE.search(text) else "See post")

            urls = _URL_RE.findall(raw_html) or _URL_RE.findall(text)
            apply_url = urls[0] if urls else f"https://news.ycombinator.com/item?id={h.get('objectID')}"

            out.append(RawJob(
                source_job_id=str(h.get("objectID")),
                title=title[:500],
                company=company[:300],
                url=apply_url,
                location=location[:300],
                remote="remote" if _REMOTE_RE.search(text) else None,
                description=text[:5000],
                description_html=raw_html,
                posted_at=h.get("created_at"),
                raw=h,
            ))
        return out
