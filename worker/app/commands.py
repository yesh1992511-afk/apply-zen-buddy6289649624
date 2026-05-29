"""Worker command bus consumer.

Polls public.worker_commands every 5s and executes user-triggered actions:
  - scrape:  { source_key: str } → run that source now
  - apply:   { job_id: str }     → enqueue an application + process immediately
  - tailor:  { job_id: str }     → build a tailored PDF preview (no apply)

UI inserts a row with status='pending'. Worker claims it (pending→running),
runs it, then writes status='done'|'failed' with result/last_error.
"""
from __future__ import annotations
import asyncio
from datetime import datetime, timezone
from typing import Any

from .db import db, user_id
from .logger import db_log, log
from .sources.registry import run_source_by_key
from .apply.runner import process_one
from .ai.resume_pipeline import build_resume_pdf


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _claim(cmd_id: str) -> bool:
    r = db().table("worker_commands").update({
        "status": "running",
        "started_at": _now(),
    }).eq("id", cmd_id).eq("status", "pending").execute()
    return bool(r.data)


def _finish(cmd_id: str, ok: bool, result: dict | None = None, err: str | None = None) -> None:
    db().table("worker_commands").update({
        "status": "done" if ok else "failed",
        "finished_at": _now(),
        "result": result or {},
        "last_error": (err or "")[:2000] or None,
    }).eq("id", cmd_id).execute()


async def _do_scrape(payload: dict[str, Any]) -> dict[str, Any]:
    key = payload.get("source_key")
    if not key:
        raise ValueError("source_key required")
    await run_source_by_key(key, force=True)
    return {"ok": True, "source_key": key}


async def _do_apply(payload: dict[str, Any]) -> dict[str, Any]:
    job_id = payload.get("job_id")
    if not job_id:
        raise ValueError("job_id required")
    uid = user_id()
    existing = db().table("applications").select("id,status").eq(
        "user_id", uid
    ).eq("job_id", job_id).limit(1).execute().data
    if existing:
        app = existing[0]
    else:
        app = db().table("applications").insert({
            "user_id": uid, "job_id": job_id, "status": "queued",
        }).execute().data[0]
    await process_one(app)
    return {"application_id": app["id"]}


async def _do_tailor(payload: dict[str, Any]) -> dict[str, Any]:
    job_id = payload.get("job_id")
    if not job_id:
        raise ValueError("job_id required")
    job = db().table("jobs").select("description,title,company").eq(
        "id", job_id
    ).single().execute().data
    jd = (job.get("description") or "")[:8000]
    pdf, tex = build_resume_pdf(jd)
    uid = user_id()
    path = f"{uid}/previews/{job_id}.pdf"
    db().storage.from_("resumes").upload(
        path, pdf, {"content-type": "application/pdf", "upsert": "true"}
    )
    db().table("resumes").insert({
        "user_id": uid, "kind": "tailored", "name": f"preview-{job_id[:8]}",
        "tex_content": tex, "pdf_storage_path": path,
    }).execute()
    return {"pdf_path": path}


HANDLERS = {
    "scrape": _do_scrape,
    "apply": _do_apply,
    "tailor": _do_tailor,
}


async def tick_commands() -> None:
    rows = db().table("worker_commands").select("*").eq(
        "user_id", user_id()
    ).eq("status", "pending").order("created_at").limit(5).execute().data or []
    for cmd in rows:
        if not await _claim(cmd["id"]):
            continue
        kind = cmd["kind"]
        db_log("info", f"command: {kind}", scope="commands", metadata={"id": cmd["id"]})
        handler = HANDLERS.get(kind)
        if not handler:
            _finish(cmd["id"], False, err=f"unknown kind: {kind}")
            continue
        try:
            result = await handler(cmd.get("payload") or {})
            _finish(cmd["id"], True, result=result)
        except Exception as e:
            log.exception("command_failed", id=cmd["id"], kind=kind)
            _finish(cmd["id"], False, err=str(e))
