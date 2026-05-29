"""Structured logger that mirrors to the `logs` table in Supabase."""
import logging
import sys
from typing import Any, Optional
import structlog
from .config import settings
from .db import db, user_id

logging.basicConfig(
    format="%(message)s",
    stream=sys.stdout,
    level=getattr(logging, settings().LOG_LEVEL, logging.INFO),
)
structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.add_log_level,
        structlog.processors.JSONRenderer(),
    ],
)
log = structlog.get_logger()


def db_log(
    level: str,
    message: str,
    scope: Optional[str] = None,
    *,
    run_id: Optional[str] = None,
    job_id: Optional[str] = None,
    application_id: Optional[str] = None,
    metadata: Optional[dict[str, Any]] = None,
) -> None:
    """Write a row to public.logs. Failures only log locally — never throw."""
    try:
        db().table("logs").insert({
            "user_id": user_id(),
            "level": level,
            "scope": scope,
            "message": message[:4000],
            "run_id": run_id,
            "job_id": job_id,
            "application_id": application_id,
            "metadata": metadata or {},
        }).execute()
    except Exception as e:  # pragma: no cover
        log.warning("db_log_failed", error=str(e))
    getattr(log, level if level in ("debug", "info", "warning", "error") else "info")(
        message, scope=scope, **(metadata or {})
    )
