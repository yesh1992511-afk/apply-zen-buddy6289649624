"""Residential proxy URL helper.

Proxy is only applied to portals that actively block / rate-limit by IP.
Free public ATSes (Greenhouse, Lever, Ashby, etc.) don't need it — saves
significant residential-bandwidth spend.
"""
from ..config import settings

# Portals that justify residential-proxy cost.
PROXIED_PORTALS = {"linkedin", "indeed", "workday", "glassdoor", "ziprecruiter", "dice", "wellfound"}


def needs_proxy(portal_key: str | None) -> bool:
    return (portal_key or "").lower() in PROXIED_PORTALS


def proxy_url(portal_key: str | None = None) -> str | None:
    s = settings()
    if not s.PROXY_HOST or not s.PROXY_USER:
        return None
    if portal_key is not None and not needs_proxy(portal_key):
        return None
    return f"http://{s.PROXY_USER}:{s.PROXY_PASS}@{s.PROXY_HOST}:{s.PROXY_PORT}"


def playwright_proxy(portal_key: str | None = None) -> dict | None:
    s = settings()
    if not s.PROXY_HOST or not s.PROXY_USER:
        return None
    if portal_key is not None and not needs_proxy(portal_key):
        return None
    return {
        "server": f"http://{s.PROXY_HOST}:{s.PROXY_PORT}",
        "username": s.PROXY_USER,
        "password": s.PROXY_PASS,
    }
