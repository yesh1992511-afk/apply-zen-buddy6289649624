"""Apply queue runner.

Pulls applications with status='queued' (or auto-queues high-score jobs if
the user has aggressiveness >= 3 and matched=true), runs the AI pipeline,
compiles the PDF, picks a portal, and reports results.
"""
import asyncio
import time
from datetime import datetime, timezone
from typing import Any
from ..db import db, user_id
from ..logger import db_log, log
from ..ai.resume_pipeline import build_resume_pdf, load_profile_payload
from ..ai.cover_letter import generate as generate_cover_letter
from .browser import new_browser
from .humanize import pause
from .portals.registry import find_portal
from .ratelimit import acquire as rl_acquire, record_challenge


async def _next_queued(limit: int) -> list[dict[str, Any]]:
    rows = db().table("applications").select("*").eq(
        "user_id", user_id()
    ).eq("status", "queued").order("queued_at").limit(limit).execute().data or []
    return rows


async def _claim(app_id: str) -> bool:
    """Atomic-ish claim: set status->in_progress only if still queued."""
    r = db().table("applications").update({
        "status": "in_progress",
        "started_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", app_id).eq("status", "queued").execute()
    return bool(r.data)


async def _fail(app_id: str, err: str, shots: list[str]) -> None:
    db().table("applications").update({
        "status": "failed",
        "last_error": err[:2000],
        "screenshots": shots,
        "finished_at": datetime.now(timezone.utc).isoformat(),
        "attempts": _bump_attempts(app_id),
    }).eq("id", app_id).execute()


def _bump_attempts(app_id: str) -> int:
    r = db().table("applications").select("attempts").eq("id", app_id).single().execute().data
    return (r.get("attempts") or 0) + 1


async def _save_resume(app_id: str, pdf: bytes, tex: str) -> str:
    uid = user_id()
    pdf_path = f"{uid}/{app_id}/resume.pdf"
    db().storage.from_("resumes").upload(pdf_path, pdf, {"content-type": "application/pdf", "upsert": "true"})
    rid = db().table("resumes").insert({
        "user_id": uid, "kind": "tailored", "name": f"app-{app_id}",
        "tex_content": tex, "pdf_storage_path": pdf_path,
        "application_id": app_id,
    }).execute().data[0]["id"]
    db().table("applications").update({"resume_id": rid}).eq("id", app_id).execute()
    return pdf_path


async def process_one(app: dict[str, Any]) -> None:
    job = db().table("jobs").select("*").eq("id", app["job_id"]).single().execute().data
    if not job:
        await _fail(app["id"], "job row not found", [])
        return

    portal = find_portal(job["url"])
    if not portal:
        await _fail(app["id"], f"no portal adapter for {job['url']}", [])
        return

    if not await _claim(app["id"]):
        return

    db_log("info", f"applying to {job['title']} @ {job['company']} via {portal.key}",
           scope="apply", application_id=app["id"], job_id=job["id"])

    try:
        jd = (job.get("description") or "")[:8000]
        pdf, tex = build_resume_pdf(jd)
        profile_payload = load_profile_payload()
        profile = profile_payload["profile"]
        tone = profile.get("cover_letter_tone") or "professional"
        cl = ""
        try:
            from ..ai.reasoner import reason
            analysis = reason(jd, profile_payload)
            cl = generate_cover_letter(profile, jd, analysis, tone)
        except Exception as e:
            log.warning("cover_letter_failed", error=str(e))

        await _save_resume(app["id"], pdf, tex)

        try:
            await rl_acquire(portal.key)
        except RuntimeError as e:
            await _fail(app["id"], str(e), [])
            return

        async with new_browser(portal_key=portal.key) as (page, _ctx):
            await pause(1, 3)
            result = await portal.apply(
                page=page, job=job, profile=profile,
                resume_pdf=pdf, cover_letter_text=cl,
            )
            if not result.ok and result.error and any(
                k in result.error.lower() for k in ("captcha", "challenge", "verify", "blocked", "robot")
            ):
                record_challenge(portal.key)

        if result.ok:
            db().table("applications").update({
                "status": "applied",
                "applied_at": datetime.now(timezone.utc).isoformat(),
                "finished_at": datetime.now(timezone.utc).isoformat(),
                "screenshots": result.screenshots,
                "notes": result.notes,
                "last_error": None,
                "attempts": _bump_attempts(app["id"]),
            }).eq("id", app["id"]).execute()
            db().table("jobs").update({"status": "applied"}).eq("id", job["id"]).execute()
            db_log("info", "applied successfully", scope="apply",
                   application_id=app["id"], job_id=job["id"])
        else:
            await _fail(app["id"], result.error or "unknown", result.screenshots)
            db_log("warning", f"apply failed: {result.error}", scope="apply",
                   application_id=app["id"], job_id=job["id"])
            try:
                from .. import notify as _notify
                err_l = (result.error or "").lower()
                manual_markers = ("captcha", "challenge", "verify", "blocked", "robot", "2fa", "otp", "review")
                if any(k in err_l for k in manual_markers):
                    _notify.manual_review(job, app["id"], result.error or "portal blocked")
                else:
                    attempts = _bump_attempts(app["id"]) - 1
                    if attempts >= 2:
                        _notify.apply_failed(job, app["id"], result.error or "unknown")
            except Exception as _e:
                log.warning("notify_failed", error=str(_e))
    except Exception as e:
        await _fail(app["id"], str(e), [])
        db_log("error", f"apply crashed: {e}", scope="apply",
               application_id=app["id"], job_id=job["id"])


async def process_queue(limit: int = 3) -> None:
    apps = await _next_queued(limit)
    if not apps:
        return
    # Honor user-set parallelism (1-10). Cap at 5 hard to keep portals happy.
    s = db().table("automation_settings").select("parallelism, aggressiveness, max_applies_per_day").eq(
        "user_id", user_id()
    ).single().execute().data or {}
    parallel = max(1, min(int(s.get("parallelism") or 1), 5))

    # Respect daily cap
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    applied_today = db().table("applications").select("id", count="exact").eq(
        "user_id", user_id()
    ).eq("status", "applied").gte("applied_at", today_start).execute().count or 0
    cap = int(s.get("max_applies_per_day") or 50)
    remaining = max(0, cap - applied_today)
    if remaining <= 0:
        db_log("info", f"daily cap {cap} reached", scope="apply")
        return
    apps = apps[:remaining]

    if parallel <= 1:
        for a in apps:
            await process_one(a)
    else:
        sem = asyncio.Semaphore(parallel)
        async def _w(a):
            async with sem:
                await process_one(a)
        await asyncio.gather(*[_w(a) for a in apps])
