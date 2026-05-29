"""WeWorkRemotely RSS feed (free)."""
from typing import Any
import httpx
import re
from xml.etree import ElementTree as ET
from .base import Source, RawJob


class WeWorkRemotely(Source):
    key = "weworkremotely"

    async def fetch(self, config: dict[str, Any]):
        category = config.get("category", "remote-programming-jobs")
        url = f"https://weworkremotely.com/categories/{category}.rss"
        async with httpx.AsyncClient(timeout=60) as c:
            r = await c.get(url)
            r.raise_for_status()
            root = ET.fromstring(r.text)
        out = []
        for item in root.iter("item"):
            title = (item.findtext("title") or "").strip()
            link = (item.findtext("link") or "").strip()
            desc = (item.findtext("description") or "").strip()
            company = ""
            if ":" in title:
                company, title = [s.strip() for s in title.split(":", 1)]
            out.append(RawJob(
                source_job_id=re.sub(r"\W+", "-", link)[-100:],
                title=title, company=company, url=link,
                location="Remote", remote="remote",
                description=desc, description_html=desc,
                posted_at=item.findtext("pubDate"),
                raw={"link": link, "title": title},
            ))
        return out
