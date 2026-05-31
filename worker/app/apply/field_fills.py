"""Per-application field-fill ledger.

Buffers (label, value, source) tuples during a portal run and flushes them
to `applications.field_fills` (jsonb) at the end. Source values:
  profile          – from profile/master tables via regex rule
  tailored         – from the per-job tailored resume (summary/experience/projects/skills)
  screening_cache  – from profile.screening_answers (previously cached)
  ai_generated     – freshly produced by DeepSeek and cached for next time
"""
from __future__ import annotations
from typing import Any
from contextvars import ContextVar
from ..db import db
from ..logger import log

_ledger: ContextVar[list[dict[str, Any]] | None] = ContextVar("fill_ledger", default=None)
_app_id: ContextVar[str | None] = ContextVar("fill_app_id", default=None)


def start(application_id: str | None) -> None:
    _ledger.set([])
    _app_id.set(application_id)


def record(label: str, value: Any, source: str) -> None:
    led = _ledger.get()
    if led is None:
        return
    s = "" if value is None else str(value)
    if len(s) > 500:
        s = s[:500] + "…"
    led.append({
        "label": (label or "")[:200],
        "value": s,
        "source": source,
    })


def flush() -> None:
    led = _ledger.get() or []
    app_id = _app_id.get()
    if not app_id or not led:
        _ledger.set(None)
        _app_id.set(None)
        return
    try:
        db().table("applications").update({"field_fills": led}).eq("id", app_id).execute()
    except Exception as e:
        log.warning("field_fills_flush_failed", error=str(e))
    _ledger.set(None)
    _app_id.set(None)


def is_tailored_field(label: str, profile: dict) -> bool:
    """Best-effort: tell if a filled value came from the tailored resume bundle."""
    tailored = (profile or {}).get("_tailored_lists") or {}
    if not tailored:
        return False
    lab = (label or "").lower()
    return any(k in lab for k in ("summary", "experience", "project", "skill", "about you", "introduction"))
