"""Decrypt session cookies uploaded by the browser extension and inject
them into a Playwright BrowserContext so auto-apply skips the login wall.

Uses AES-GCM with PBKDF2-derived key. The passphrase is the same value
the user typed into the extension Options page; never store it in the DB.
"""
from __future__ import annotations

import base64
import json
import os
from typing import Any
from urllib.parse import urlparse

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from .db import db, user_id
from .logger import log

SALT = b"jobpilot-cookie-pipe-v1"


def _passphrase() -> str | None:
    return os.getenv("COOKIE_PIPE_PASSPHRASE") or None


def _derive_key(passphrase: str) -> bytes:
    kdf = PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=SALT, iterations=120_000)
    return kdf.derive(passphrase.encode("utf-8"))


def _host_for(url: str) -> str | None:
    try:
        host = urlparse(url).hostname or ""
        parts = host.split(".")
        return ".".join(parts[-2:]) if len(parts) >= 2 else host
    except Exception:
        return None


def load_cookies(host: str) -> list[dict[str, Any]] | None:
    """Return decrypted cookies for the host, or None if unavailable."""
    passphrase = _passphrase()
    if not passphrase:
        return None
    try:
        row = (
            db()
            .table("session_cookies")
            .select("ciphertext, iv, expires_at")
            .eq("user_id", user_id())
            .eq("host", host)
            .maybeSingle()
            .execute()
            .data
        )
    except Exception as e:
        log.warning("session_cookies_lookup_failed", host=host, error=str(e))
        return None
    if not row:
        return None
    try:
        key = _derive_key(passphrase)
        ct = base64.b64decode(row["ciphertext"])
        iv = base64.b64decode(row["iv"])
        pt = AESGCM(key).decrypt(iv, ct, None)
        payload = json.loads(pt.decode("utf-8"))
        cookies = payload.get("cookies") or []
        return cookies if isinstance(cookies, list) else None
    except Exception as e:
        log.warning("session_cookies_decrypt_failed", host=host, error=str(e))
        return None


async def inject_cookies(ctx, url: str) -> int:
    """Inject decrypted cookies into a Playwright BrowserContext for the
    host derived from `url`. Returns the number of cookies added."""
    host = _host_for(url)
    if not host:
        return 0
    cookies = load_cookies(host)
    if not cookies:
        return 0
    pw_cookies = []
    for c in cookies:
        name = c.get("name")
        value = c.get("value")
        if not name or value is None:
            continue
        pw_cookies.append({
            "name": str(name),
            "value": str(value),
            "domain": c.get("domain") or f".{host}",
            "path": c.get("path") or "/",
            "secure": True,
            "httpOnly": False,
            "sameSite": "Lax",
        })
    if not pw_cookies:
        return 0
    try:
        await ctx.add_cookies(pw_cookies)
        log.info("session_cookies_injected", host=host, count=len(pw_cookies))
        return len(pw_cookies)
    except Exception as e:
        log.warning("session_cookies_inject_failed", host=host, error=str(e))
        return 0
