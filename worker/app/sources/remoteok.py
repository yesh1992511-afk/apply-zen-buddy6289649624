"""RemoteOK public API — free, no auth. Config: {tags: ["dev","python"]}"""
from typing import Any
import httpx
from .base import Source, RawJob


class RemoteOK(Source):
    key = "remoteok"

    async def fetch(self, config: dict[str, Any]):
        tags = config.get("tags", [])
        url = "https://remoteok.com/api"
        async with httpx.AsyncClient(timeout=60, headers={"User-Agent": "JobPilot/0.1"}) as c:
            r = await c.get(url)
            r.raise_for_status()
            items = r.json()
        # First element is metadata.
        items = [i for i in items if isinstance(i, dict) and i.get("id")]
        if tags:
            wanted = {t.lower() for t in tags}
            items = [i for i in items if wanted & {t.lower() for t in (i.get("tags") or [])}]
        return [
            RawJob(
                source_job_id=str(i["id"]),
                title=i.get("position") or "",
                company=i.get("company") or "",
                url=i.get("url") or f"https://remoteok.com/remote-jobs/{i['id']}",
                location=i.get("location") or "Remote",
                remote="remote",
                description=i.get("description"),
                description_html=i.get("description"),
                salary_min=i.get("salary_min"),
                salary_max=i.get("salary_max"),
                salary_currency="USD",
                posted_at=i.get("date"),
                raw=i,
            )
            for i in items
        ]
