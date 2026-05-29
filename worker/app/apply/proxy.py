"""Residential proxy URL helper."""
from ..config import settings


def proxy_url() -> str | None:
    s = settings()
    if not s.PROXY_HOST or not s.PROXY_USER:
        return None
    return f"http://{s.PROXY_USER}:{s.PROXY_PASS}@{s.PROXY_HOST}:{s.PROXY_PORT}"


def playwright_proxy() -> dict | None:
    s = settings()
    if not s.PROXY_HOST or not s.PROXY_USER:
        return None
    return {
        "server": f"http://{s.PROXY_HOST}:{s.PROXY_PORT}",
        "username": s.PROXY_USER,
        "password": s.PROXY_PASS,
    }
