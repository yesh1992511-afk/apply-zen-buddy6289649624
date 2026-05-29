"""Playwright launch with stealth + proxy + a small identity pool."""
import random
from contextlib import asynccontextmanager
from playwright.async_api import async_playwright
from playwright_stealth import stealth_async
from .proxy import playwright_proxy
from ..config import settings


FINGERPRINTS = [
    {
        "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
        "viewport": {"width": 1440, "height": 900}, "locale": "en-US", "tz": "America/New_York",
    },
    {
        "user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Safari/605.1.15",
        "viewport": {"width": 1512, "height": 982}, "locale": "en-US", "tz": "America/Los_Angeles",
    },
    {
        "user_agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        "viewport": {"width": 1366, "height": 768}, "locale": "en-GB", "tz": "Europe/London",
    },
]


def pick_fingerprint() -> dict:
    return random.choice(FINGERPRINTS)


@asynccontextmanager
async def new_browser(headless: bool = True, fingerprint: dict | None = None):
    fp = fingerprint or pick_fingerprint()
    proxy = playwright_proxy()
    async with async_playwright() as p:
        launch_args = ["--disable-blink-features=AutomationControlled"]
        browser = await p.chromium.launch(
            headless=headless,
            args=launch_args,
            proxy=proxy,
        )
        ctx = await browser.new_context(
            user_agent=fp["user_agent"],
            viewport=fp["viewport"],
            locale=fp["locale"],
            timezone_id=fp["tz"],
        )
        page = await ctx.new_page()
        try:
            await stealth_async(page)
        except Exception:
            pass
        try:
            yield page, ctx
        finally:
            await ctx.close()
            await browser.close()
