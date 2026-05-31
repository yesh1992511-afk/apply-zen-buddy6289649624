"""Posts to worker_heartbeat every 30s so the UI can show liveness.

Also self-reports which secret env vars are configured on this VPS into
public.secrets_meta so the Worker Setup readiness checklist can turn green
without the user manually touching the database.
"""
from datetime import datetime, timezone
from .db import db, user_id
from .config import settings
from .logger import log


# (env_attr, secrets_meta.name, category)
_SECRET_MAP = [
    ("CAPTCHA_API_KEY", "CAPTCHA_API_KEY", "captcha"),
    ("PROXY_HOST", "PROXY_HOST", "proxy"),
    ("APIFY_TOKEN", "APIFY_TOKEN", "apify"),
    ("OPENAI_API_KEY", "OPENAI_API_KEY", "ai"),
    ("DEEPSEEK_API_KEY", "DEEPSEEK_API_KEY", "ai"),
    ("GMAIL_OAUTH_REFRESH_TOKEN", "GMAIL_OAUTH_REFRESH_TOKEN", "gmail"),
]


def _report_secrets(uid: str) -> None:
    s = settings()
    now = datetime.now(timezone.utc).isoformat()
    rows = []
    for attr, name, category in _SECRET_MAP:
        val = getattr(s, attr, "") or ""
        # PROXY_HOST is only "set" when host AND user are both present
        if name == "PROXY_HOST":
            ok = bool(val.strip()) and bool((s.PROXY_USER or "").strip())
        else:
            ok = bool(val.strip())
        rows.append({
            "user_id": uid,
            "name": name,
            "category": category,
            "status": "set" if ok else "unset",
            "last_checked": now,
        })
    try:
        db().table("secrets_meta").upsert(rows, on_conflict="user_id,name").execute()
    except Exception as e:
        log.warning("secrets_meta_report_failed", error=str(e))


def beat() -> None:
    uid = user_id()
    try:
        db().table("worker_heartbeat").upsert({
            "user_id": uid,
            "last_seen": datetime.now(timezone.utc).isoformat(),
            "version": settings().WORKER_VERSION,
            "metadata": {"role": "worker"},
        }, on_conflict="user_id").execute()
    except Exception as e:
        log.warning("heartbeat_failed", error=str(e))

    _report_secrets(uid)
