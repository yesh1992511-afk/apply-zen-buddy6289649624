"""Posts to worker_heartbeat every 30s so the UI can show liveness."""
from datetime import datetime, timezone
from .db import db, user_id
from .config import settings
from .logger import log


def beat() -> None:
    try:
        db().table("worker_heartbeat").upsert({
            "user_id": user_id(),
            "last_seen": datetime.now(timezone.utc).isoformat(),
            "version": settings().WORKER_VERSION,
            "metadata": {"role": "worker"},
        }, on_conflict="user_id").execute()
    except Exception as e:
        log.warning("heartbeat_failed", error=str(e))
