"""Shared HTTP helper for ATS / public-feed scrapers.

Adds three things every adapter benefits from:
1. Exponential backoff with jitter (3 attempts).
2. Rotating User-Agent pool so a single board doesn't see a fixed UA.
3. Optional Decodo residential proxy when DECODO_* env vars are present.
"""
from __future__ import annotations
import asyncio
import os
import random
from typing import Any

import httpx


_USER_AGENTS = [
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    "JobPilot/0.1 (+https://apply-zen-buddy.lovable.app)",
]


def _proxy_url() -> str | None:
    user = os.getenv("DECODO_USERNAME")
    pw = os.getenv("DECODO_PASSWORD")
    host = os.getenv("DECODO_HOST")
    port = os.getenv("DECODO_PORT") or "7000"
    country = os.getenv("DECODO_COUNTRY")
    if not (user and pw and host):
        return None
    u = user
    if country:
        u = f"{user}-country-{country}"
    return f"http://{u}:{pw}@{host}:{port}"


def make_client(*, use_proxy: bool = False, timeout: float = 60.0) -> httpx.AsyncClient:
    """Return an httpx.AsyncClient with rotating UA + optional proxy."""
    headers = {"User-Agent": random.choice(_USER_AGENTS), "Accept": "application/json,text/html;q=0.9,*/*;q=0.8"}
    kwargs: dict[str, Any] = {"timeout": timeout, "headers": headers, "follow_redirects": True}
    if use_proxy:
        proxy = _proxy_url()
        if proxy:
            kwargs["proxy"] = proxy
    return httpx.AsyncClient(**kwargs)


async def get_json(client: httpx.AsyncClient, url: str, *, params: dict | None = None, attempts: int = 3) -> Any:
    """GET with exponential backoff. Returns parsed JSON or raises last exception."""
    delay = 0.6
    last: Exception | None = None
    for i in range(attempts):
        try:
            r = await client.get(url, params=params)
            r.raise_for_status()
            return r.json()
        except Exception as e:
            last = e
            if i == attempts - 1:
                break
            await asyncio.sleep(delay + random.random() * 0.4)
            delay *= 2
    raise last  # type: ignore[misc]


async def get_text(client: httpx.AsyncClient, url: str, *, params: dict | None = None, attempts: int = 3) -> str:
    delay = 0.6
    last: Exception | None = None
    for i in range(attempts):
        try:
            r = await client.get(url, params=params)
            r.raise_for_status()
            return r.text
        except Exception as e:
            last = e
            if i == attempts - 1:
                break
            await asyncio.sleep(delay + random.random() * 0.4)
            delay *= 2
    raise last  # type: ignore[misc]
