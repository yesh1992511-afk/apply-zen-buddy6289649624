"""Captcha solver shim. Supports 2Captcha & CapSolver."""
import asyncio
import httpx
from ..config import settings


async def solve_recaptcha_v2(site_key: str, page_url: str) -> str:
    """Returns the g-recaptcha-response token to inject."""
    s = settings()
    if s.CAPTCHA_PROVIDER == "2captcha":
        return await _twocaptcha_v2(s.CAPTCHA_API_KEY, site_key, page_url)
    if s.CAPTCHA_PROVIDER == "capsolver":
        return await _capsolver_v2(s.CAPTCHA_API_KEY, site_key, page_url)
    raise RuntimeError(f"Unknown CAPTCHA_PROVIDER: {s.CAPTCHA_PROVIDER}")


async def _twocaptcha_v2(key: str, site_key: str, url: str) -> str:
    async with httpx.AsyncClient(timeout=180) as c:
        r = await c.get("https://2captcha.com/in.php", params={
            "key": key, "method": "userrecaptcha", "googlekey": site_key,
            "pageurl": url, "json": 1,
        })
        rid = r.json()["request"]
        for _ in range(40):
            await asyncio.sleep(5)
            res = await c.get("https://2captcha.com/res.php", params={
                "key": key, "action": "get", "id": rid, "json": 1,
            })
            d = res.json()
            if d["status"] == 1:
                return d["request"]
            if d.get("request") != "CAPCHA_NOT_READY":
                raise RuntimeError(f"2captcha: {d}")
    raise TimeoutError("2captcha timeout")


async def _capsolver_v2(key: str, site_key: str, url: str) -> str:
    async with httpx.AsyncClient(timeout=180) as c:
        r = await c.post("https://api.capsolver.com/createTask", json={
            "clientKey": key,
            "task": {"type": "ReCaptchaV2TaskProxyLess", "websiteURL": url, "websiteKey": site_key},
        })
        tid = r.json()["taskId"]
        for _ in range(40):
            await asyncio.sleep(5)
            res = await c.post("https://api.capsolver.com/getTaskResult",
                               json={"clientKey": key, "taskId": tid})
            d = res.json()
            if d.get("status") == "ready":
                return d["solution"]["gRecaptchaResponse"]
    raise TimeoutError("capsolver timeout")
