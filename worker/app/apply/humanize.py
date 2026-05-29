"""Aggressiveness 1-5 → delay scale (smaller = slower)."""
import asyncio
import random
from ..db import db, user_id


def get_aggressiveness() -> int:
    s = db().table("automation_settings").select("aggressiveness").eq(
        "user_id", user_id()
    ).single().execute().data or {}
    return int(s.get("aggressiveness") or 3)


def jitter(base: float) -> float:
    """0.7x to 1.3x base."""
    return base * (0.7 + random.random() * 0.6)


async def pause(min_s: float, max_s: float | None = None) -> None:
    agg = get_aggressiveness()
    scale = {1: 2.5, 2: 1.8, 3: 1.3, 4: 1.0, 5: 0.7}.get(agg, 1.0)
    hi = max_s if max_s is not None else min_s * 1.5
    delay = scale * random.uniform(min_s, hi)
    await asyncio.sleep(delay)


async def type_humanlike(page, selector: str, text: str) -> None:
    el = page.locator(selector).first
    await el.click()
    for ch in text:
        await el.type(ch, delay=random.randint(40, 130))
    await pause(0.3, 0.9)
