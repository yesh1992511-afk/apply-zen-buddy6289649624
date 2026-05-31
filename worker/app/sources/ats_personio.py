"""Personio public XML jobs feed.

Config: { "subdomains": ["acmeco", "anotherco"] }

URL pattern: https://{subdomain}.jobs.personio.de/xml
"""
from typing import Any
import httpx
import xml.etree.ElementTree as ET
from .base import Source, RawJob


class PersonioBoards(Source):
    key = "personio_boards"

    async def fetch(self, config: dict[str, Any]):
        subs = config.get("subdomains", [])
        out: list[RawJob] = []
        async with httpx.AsyncClient(timeout=30, headers={"User-Agent": "JobPilot/0.1"}) as c:
            for sub in subs:
                sub = sub.strip().lower()
                if not sub:
                    continue
                for tld in ("de", "com"):
                    url = f"https://{sub}.jobs.personio.{tld}/xml"
                    try:
                        r = await c.get(url)
                        if r.status_code != 200:
                            continue
                        root = ET.fromstring(r.text)
                    except Exception:
                        continue
                    for pos in root.findall(".//position"):
                        def g(tag: str) -> str | None:
                            el = pos.find(tag)
                            return el.text.strip() if (el is not None and el.text) else None
                        out.append(RawJob(
                            source_job_id=g("id"),
                            title=g("name") or "",
                            company=sub,
                            url=g("permanentUrl") or f"https://{sub}.jobs.personio.{tld}/",
                            location=g("office"),
                            employment_type=g("employmentType"),
                            seniority=g("seniority"),
                            description=g("jobDescriptions") or g("recruitingCategory"),
                            posted_at=g("createdAt"),
                            raw={"_personio_sub": sub},
                        ))
                    break
        return out
