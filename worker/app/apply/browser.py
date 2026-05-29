"""Playwright launch with stealth, residential proxy, UA pool, and persistent
per-portal browser profiles (cookies + cache survive restarts → looks like a
returning user)."""
import os
import random
from contextlib import asynccontextmanager
from pathlib import Path
from playwright.async_api import async_playwright
from playwright_stealth import stealth_async
from .proxy import playwright_proxy

PROFILE_ROOT = Path(os.getenv("PROFILE_ROOT", "/data/profiles"))
PROFILE_ROOT.mkdir(parents=True, exist_ok=True)


# 20 realistic Chrome/Edge/Safari fingerprints, matched UA + sec-ch-ua + viewport.
FINGERPRINTS = [
    {"ua": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
     "ch_ua": '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"', "platform": "Windows",
     "viewport": {"width": 1920, "height": 1080}, "locale": "en-US", "tz": "America/New_York"},
    {"ua": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
     "ch_ua": '"Google Chrome";v="130", "Chromium";v="130", "Not_A Brand";v="24"', "platform": "Windows",
     "viewport": {"width": 1536, "height": 864}, "locale": "en-US", "tz": "America/Chicago"},
    {"ua": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0",
     "ch_ua": '"Microsoft Edge";v="131", "Chromium";v="131", "Not_A Brand";v="24"', "platform": "Windows",
     "viewport": {"width": 1440, "height": 900}, "locale": "en-US", "tz": "America/Denver"},
    {"ua": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
     "ch_ua": '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"', "platform": "macOS",
     "viewport": {"width": 1512, "height": 982}, "locale": "en-US", "tz": "America/Los_Angeles"},
    {"ua": "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Safari/605.1.15",
     "ch_ua": "", "platform": "macOS",
     "viewport": {"width": 1440, "height": 900}, "locale": "en-US", "tz": "America/Los_Angeles"},
    {"ua": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
     "ch_ua": '"Google Chrome";v="130", "Chromium";v="130", "Not_A Brand";v="24"', "platform": "Linux",
     "viewport": {"width": 1920, "height": 1080}, "locale": "en-US", "tz": "America/New_York"},
    {"ua": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
     "ch_ua": '"Google Chrome";v="129", "Chromium";v="129", "Not_A Brand";v="24"', "platform": "Windows",
     "viewport": {"width": 1366, "height": 768}, "locale": "en-US", "tz": "America/New_York"},
    {"ua": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
     "ch_ua": '"Google Chrome";v="130", "Chromium";v="130", "Not_A Brand";v="24"', "platform": "macOS",
     "viewport": {"width": 1680, "height": 1050}, "locale": "en-US", "tz": "America/Los_Angeles"},
]


def pick_fingerprint(portal_key: str) -> dict:
    """Sticky fingerprint per portal: same identity each session."""
    rnd = random.Random(portal_key)
    return rnd.choice(FINGERPRINTS)


@asynccontextmanager
async def new_browser(portal_key: str = "default", headless: bool = True, fingerprint: dict | None = None):
    fp = fingerprint or pick_fingerprint(portal_key)
    proxy = playwright_proxy()
    profile_dir = PROFILE_ROOT / portal_key
    profile_dir.mkdir(parents=True, exist_ok=True)

    async with async_playwright() as p:
        args = [
            "--disable-blink-features=AutomationControlled",
            "--disable-features=IsolateOrigins,site-per-process",
            f"--window-size={fp['viewport']['width']},{fp['viewport']['height']}",
        ]
        # Persistent context survives restarts (cookies, cache, IndexedDB).
        ctx = await p.chromium.launch_persistent_context(
            user_data_dir=str(profile_dir),
            headless=headless,
            args=args,
            proxy=proxy,
            user_agent=fp["ua"],
            viewport=fp["viewport"],
            locale=fp["locale"],
            timezone_id=fp["tz"],
            extra_http_headers={
                "Accept-Language": f"{fp['locale']},en;q=0.9",
                **({"sec-ch-ua": fp["ch_ua"],
                    "sec-ch-ua-mobile": "?0",
                    "sec-ch-ua-platform": f'"{fp["platform"]}"'} if fp["ch_ua"] else {}),
            },
            color_scheme="light",
        )
        page = ctx.pages[0] if ctx.pages else await ctx.new_page()
        try:
            await stealth_async(page)
        except Exception:
            pass
        try:
            yield page, ctx
        finally:
            await ctx.close()
