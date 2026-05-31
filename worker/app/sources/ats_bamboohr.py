"""BambooHR public embed feed — no auth required.

Config: { "subdomains": ["acmeco", "anotherco"] }

URL pattern: https://{subdomain}.bamboohr.com/jobs/embed2.php?departmentId=0
"""
from typing import Any
import httpx
import re
from .base import Source, RawJob


class BambooHRBoards(Source):
    key = "bamboohr_boards"

    async def fetch(self, config: dict[str, Any]):
        subs = config.get("subdomains", [])
        out: list[RawJob] = []
        async with httpx.AsyncClient(timeout=30, headers={
            "User-Agent": "JobPilot/0.1",
            "Accept": "application/json",
        }) as c:
            for sub in subs:
                sub = sub.strip().lower()
                if not sub:
                    continue
                url = f"https://{sub}.bamboohr.com/jobs/embed2.php?departmentId=0"
                try:
                    r = await c.get(url)
                    text = r.text or ""
                    # The embed page is HTML+JSON; extract jobs from the <script>BambooHR.jobsList = [...]</script>
                    m = re.search(r"BambooHR\.jobsList\s*=\s*(\[[\s\S]*?\]);", text)
                    if not m:
                        continue
                    import json as _json
                    jobs = _json.loads(m.group(1))
                except Exception:
                    continue
                for j in jobs:
                    jid = str(j.get("id") or "")
                    out.append(RawJob(
                        source_job_id=jid,
                        title=j.get("jobOpeningName") or "",
                        company=sub,
                        url=f"https://{sub}.bamboohr.com/careers/{jid}" if jid else f"https://{sub}.bamboohr.com/jobs/",
                        location=", ".join(filter(None, [j.get("location", {}).get("city"), j.get("location", {}).get("state"), j.get("location", {}).get("country")])) or None,
                        employment_type=j.get("employmentStatusLabel"),
                        posted_at=j.get("datePosted"),
                        raw={**j, "_bamboohr_sub": sub},
                    ))
        return out
