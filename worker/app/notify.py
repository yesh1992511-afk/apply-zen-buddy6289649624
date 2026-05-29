"""High-level notification dispatcher. Checks notification_settings toggles,
debounces, and delegates to gmail.send_and_log."""
from __future__ import annotations
from datetime import datetime, timezone, timedelta
from typing import Optional

from .db import db, user_id
from .logger import db_log
from . import gmail


def _settings() -> dict:
    try:
        row = db().table("notification_settings").select("*").eq("user_id", user_id()).maybe_single().execute().data
        return row or {}
    except Exception:
        return {}


def _already_sent_recently(kind: str, *, job_id: str | None = None, within_hours: float = 24) -> bool:
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=within_hours)).isoformat()
    q = db().table("notification_log").select("id").eq("user_id", user_id()).eq("kind", kind).gte("created_at", cutoff)
    if job_id:
        q = q.eq("job_id", job_id)
    try:
        rows = q.limit(1).execute().data
        return bool(rows)
    except Exception:
        return False


def manual_review(job: dict, application_id: str, reason: str) -> bool:
    s = _settings()
    if not s.get("notify_manual_review", True):
        return False
    subject = f"[JobPilot] Manual review needed: {job.get('title', 'job')} @ {job.get('company', '')}"
    body = (
        f"A job application needs your attention.\n\n"
        f"Title: {job.get('title')}\n"
        f"Company: {job.get('company')}\n"
        f"URL: {job.get('url')}\n\n"
        f"Reason: {reason}\n\n"
        f"Open the Applications page to review.\n"
    )
    return gmail.send_and_log("manual_review", subject, body, job_id=job.get("id"), application_id=application_id)


def high_score_job(job: dict) -> bool:
    s = _settings()
    if not s.get("notify_high_score", True):
        return False
    threshold = s.get("high_score_threshold", 95)
    if (job.get("score") or 0) < threshold:
        return False
    if _already_sent_recently("high_score", job_id=job.get("id"), within_hours=72):
        return False
    subject = f"[JobPilot] {job.get('score')}-score match: {job.get('title')} @ {job.get('company')}"
    body = (
        f"A high-scoring job was just found.\n\n"
        f"Score: {job.get('score')}\n"
        f"Title: {job.get('title')}\n"
        f"Company: {job.get('company')}\n"
        f"Location: {job.get('location') or 'n/a'}\n"
        f"URL: {job.get('url')}\n\n"
        f"It will be auto-applied unless you intervene.\n"
    )
    return gmail.send_and_log("high_score", subject, body, job_id=job.get("id"))


def apply_failed(job: dict, application_id: str, error: str) -> bool:
    s = _settings()
    if not s.get("notify_apply_failed", True):
        return False
    subject = f"[JobPilot] Apply failed: {job.get('title')} @ {job.get('company')}"
    body = (
        f"All retry attempts exhausted for this application.\n\n"
        f"Title: {job.get('title')}\n"
        f"Company: {job.get('company')}\n"
        f"URL: {job.get('url')}\n\n"
        f"Error: {error}\n"
    )
    return gmail.send_and_log("apply_failed", subject, body, job_id=job.get("id"), application_id=application_id)


def send_test() -> tuple[bool, Optional[str]]:
    ok, err = gmail.verify_credentials()
    if not ok:
        return False, err
    sent = gmail.send_and_log(
        "test",
        "[JobPilot] Test notification",
        "If you're reading this, your Gmail App Password is working and the worker can send notifications.\n",
    )
    return sent, None if sent else "Send failed — check worker logs"
