"""ClearedJobs.Net RSS — US security-cleared roles. Free public feed.

Config: { } (no params).
"""
from __future__ import annotations
import re
from typing import Any
from xml.etree import ElementTree as ET

from .base import Source, RawJob
from ._http import make_client, get_text


_TAG = re.compile(r"<[^>]+>")


def _strip(html: str | None) -> str:
    if not html:
        return ""
    return _TAG.sub("", html).strip()


class ClearedJobs(Source):
    key = "cleared_jobs"

    async def fetch(self, config: dict[str, Any]):
        out: list[RawJob] = []
        async with make_client() as c:
            try:
                xml = await get_text(c, "https://clearedjobs.net/jobs/feed/")
            except Exception:
                return out
        try:
            root = ET.fromstring(xml)
        except ET.ParseError:
            return out
        for item in root.iter("item"):
            title = (item.findtext("title") or "").strip()
            link = (item.findtext("link") or "").strip()
            desc = item.findtext("description") or ""
            pub = item.findtext("pubDate")
            company = ""
            if " at " in title:
                title, company = [s.strip() for s in title.split(" at ", 1)]
            out.append(RawJob(
                source_job_id=link,
                title=title,
                company=company or "US Gov contractor",
                url=link,
                description=_strip(desc),
                description_html=desc,
                location="United States",
                posted_at=pub,
                raw={"rss_item": title},
            ))
        return out
