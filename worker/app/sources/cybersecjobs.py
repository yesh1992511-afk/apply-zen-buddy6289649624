"""CyberSecJobs.com RSS feed — free public infosec listings.

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


class CyberSecJobs(Source):
    key = "cybersecjobs"

    async def fetch(self, config: dict[str, Any]):
        out: list[RawJob] = []
        async with make_client() as c:
            try:
                xml = await get_text(c, "https://www.cybersecjobs.com/rss/jobs/")
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
            # CSJ titles are usually "Role — Company"
            if "—" in title:
                title, company = [s.strip() for s in title.split("—", 1)]
            elif " at " in title:
                title, company = [s.strip() for s in title.split(" at ", 1)]
            out.append(RawJob(
                source_job_id=link,
                title=title,
                company=company or "Unknown",
                url=link,
                description=_strip(desc),
                description_html=desc,
                posted_at=pub,
                raw={"rss_item": title},
            ))
        return out
