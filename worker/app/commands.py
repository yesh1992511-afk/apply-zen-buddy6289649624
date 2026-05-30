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
from . import notify as _notify
from . import gmail as _gmail
from datetime import timedelta


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
    row = db().table("resumes").insert({
        "user_id": uid, "kind": "tailored", "name": f"preview-{job_id[:8]}",
        "tex_content": tex, "pdf_storage_path": path,
    }).execute().data[0]
    return {"pdf_path": path, "resume_id": row["id"]}


async def _do_compile_resume(payload: dict[str, Any]) -> dict[str, Any]:
    """Compile a resume's tex_content to PDF via tectonic, upload to storage."""
    from .latex.compile import compile_tex
    resume_id = payload.get("resume_id")
    if not resume_id:
        raise ValueError("resume_id required")
    uid = user_id()
    row = db().table("resumes").select("id,tex_content,kind").eq(
        "id", resume_id
    ).eq("user_id", uid).single().execute().data
    tex = row.get("tex_content") or ""
    if not tex.strip():
        raise ValueError("resume has no tex_content")
    pdf = compile_tex(tex)
    path = f"{uid}/{row['kind']}/{resume_id}.pdf"
    db().storage.from_("resumes").upload(
        path, pdf, {"content-type": "application/pdf", "upsert": "true"}
    )
    db().table("resumes").update({"pdf_storage_path": path}).eq(
        "id", resume_id
    ).execute()
    return {"pdf_path": path, "resume_id": resume_id, "bytes": len(pdf)}


async def _do_test_source(payload: dict[str, Any]) -> dict[str, Any]:
    """One-shot test fetch for a source. Reports count + first error."""
    key = payload.get("source_key")
    if not key:
        raise ValueError("source_key required")
    uid = user_id()
    before = db().table("jobs").select("id", count="exact").eq(
        "user_id", uid
    ).execute().count or 0
    try:
        await run_source_by_key(key, force=True)
    except Exception as e:
        return {"ok": False, "source_key": key, "error": str(e)[:500]}
    after = db().table("jobs").select("id", count="exact").eq(
        "user_id", uid
    ).execute().count or 0
    src = db().table("sources").select(
        "last_run_count,last_run_status,last_error"
    ).eq("key", key).eq("user_id", uid).single().execute().data or {}
    return {
        "ok": (src.get("last_run_status") == "ok"),
        "source_key": key,
        "fetched": src.get("last_run_count") or 0,
        "new_jobs": max(0, after - before),
        "error": src.get("last_error"),
    }


async def _do_notify_test(payload: dict[str, Any]) -> dict[str, Any]:
    ok, err = _notify.send_test()
    if not ok:
        raise RuntimeError(err or "send failed")
    return {"ok": True}


async def _do_notify_offline(payload: dict[str, Any]) -> dict[str, Any]:
    subject = "[JobPilot] Worker was offline"
    body = f"Your worker was offline (last seen {payload.get('last_seen')}). It's back now.\n"
    _gmail.send_and_log("worker_offline", subject, body)
    return {"ok": True}


async def _do_notify_daily_summary(payload: dict[str, Any]) -> dict[str, Any]:
    uid = user_id()
    since = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
    jobs_in = db().table("jobs").select("id", count="exact").eq("user_id", uid).gte("created_at", since).execute().count or 0
    applied = db().table("applications").select("id", count="exact").eq("user_id", uid).eq("status", "applied").gte("applied_at", since).execute().count or 0
    failed = db().table("applications").select("id", count="exact").eq("user_id", uid).eq("status", "failed").gte("finished_at", since).execute().count or 0
    queued = db().table("applications").select("id", count="exact").eq("user_id", uid).eq("status", "queued").execute().count or 0
    top = db().table("jobs").select("title,company,score,url").eq("user_id", uid).gte("created_at", since).order("score", desc=True).limit(5).execute().data or []
    top_lines = "\n".join([f"  • [{j.get('score')}] {j.get('title')} @ {j.get('company')} — {j.get('url')}" for j in top]) or "  (none)"
    body = (
        f"Last 24h summary:\n\n"
        f"  Jobs scraped:  {jobs_in}\n"
        f"  Applied:       {applied}\n"
        f"  Failed:        {failed}\n"
        f"  Queued now:    {queued}\n\n"
        f"Top matches:\n{top_lines}\n"
    )
    _gmail.send_and_log("daily_summary", f"[JobPilot] Daily summary — {applied} applied", body)
    # Retention: keep only the 200 most recent notification_log rows for this user
    try:
        old = db().table("notification_log").select("id").eq("user_id", uid).order(
            "created_at", desc=True
        ).range(200, 999).execute().data or []
        if old:
            db().table("notification_log").delete().in_("id", [r["id"] for r in old]).execute()
    except Exception:
        pass
    return {"ok": True, "applied": applied, "jobs_in": jobs_in}


HANDLERS = {
    "scrape": _do_scrape,
    "apply": _do_apply,
    "tailor": _do_tailor,
    "tailor_resume": _do_tailor,
    "compile_resume": _do_compile_resume,
    "test_source": _do_test_source,
    "notify_test": _do_notify_test,
    "notify_offline": _do_notify_offline,
    "notify_daily_summary": _do_notify_daily_summary,
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
