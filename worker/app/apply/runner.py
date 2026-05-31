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
from ..ai.resume_pipeline import build_resume_pdf, build_tailored_resume, load_profile_payload
from ..ai.cover_letter import generate as generate_cover_letter
from .browser import new_browser
from .humanize import pause
from .portals.registry import find_portal
from .ratelimit import acquire as rl_acquire, record_challenge


async def _next_queued(limit: int) -> list[dict[str, Any]]:
    now = datetime.now(timezone.utc).isoformat()
    rows = db().table("applications").select("*").eq(
        "user_id", user_id()
    ).eq("status", "queued").or_(
        f"next_retry_at.is.null,next_retry_at.lte.{now}"
    ).order("queued_at").limit(limit).execute().data or []
    return rows


async def _claim(app_id: str) -> bool:
    """Atomic-ish claim: set status->in_progress only if still queued."""
    r = db().table("applications").update({
        "status": "in_progress",
        "started_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", app_id).eq("status", "queued").execute()
    return bool(r.data)


async def _fail(app_id: str, err: str, shots: list[str]) -> None:
    attempts = _bump_attempts(app_id)
    # Exponential backoff: 1m → 5m → 30m, then mark dead_letter via status='failed'.
    backoff_minutes = {1: 1, 2: 5, 3: 30}
    update: dict[str, Any] = {
        "last_error": err[:2000],
        "screenshots": shots,
        "finished_at": datetime.now(timezone.utc).isoformat(),
        "attempts": attempts,
        "retry_count": attempts - 1,
    }
    if attempts <= 3:
        # Re-queue for retry
        from datetime import timedelta
        next_at = datetime.now(timezone.utc) + timedelta(minutes=backoff_minutes.get(attempts, 30))
        update["status"] = "queued"
        update["next_retry_at"] = next_at.isoformat()
    else:
        update["status"] = "failed"
        update["dlq_reason"] = err[:500]
    db().table("applications").update(update).eq("id", app_id).execute()


def _bump_attempts(app_id: str) -> int:
    r = db().table("applications").select("attempts").eq("id", app_id).single().execute().data
    return (r.get("attempts") or 0) + 1


async def _save_resume(app_id: str, pdf: bytes, tex: str) -> str:
    uid = user_id()
    pdf_path = f"{uid}/{app_id}/resume.pdf"
    db().storage.from_("resumes").upload(pdf_path, pdf, {"content-type": "application/pdf", "upsert": "true"})
    rid = db().table("resumes").insert({
        "user_id": uid, "kind": "tailored" if tex else "static",
        "name": f"app-{app_id}",
        "tex_content": tex or None, "pdf_storage_path": pdf_path,
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
        # Tailored resume: AI picks/rewrites Summary + relevant Experiences + Projects
        # + Skills for THIS specific job. Profile basics (name, contact, etc.) still
        # come from the profile table.
        pdf, tex, tailored = build_tailored_resume(job["id"], jd)
        # Link tailored resume to this application
        try:
            gr = db().table("generated_resumes").select("id").eq(
                "user_id", user_id()
            ).eq("job_id", job["id"]).single().execute().data
            if gr:
                db().table("applications").update(
                    {"generated_resume_id": gr["id"]}
                ).eq("id", app["id"]).execute()
        except Exception:
            pass

        profile_payload = load_profile_payload()
        profile = dict(profile_payload["profile"])
        # Override summary with the tailored one so cover-letter prompts and any
        # field that maps to "summary" reflect the per-job rewrite.
        if tailored.get("summary"):
            profile["summary"] = tailored["summary"]
        # Build a tailored "lists" dict so profile_map.answer_for() reads the
        # job-specific experiences/projects/skills, not the master pool.
        tailored_lists = {
            **profile_payload,
            "experiences": tailored.get("experiences") or profile_payload.get("experiences"),
            "projects": tailored.get("projects") or profile_payload.get("projects"),
            "skills": [{"name": s} for s in (tailored.get("skills") or [])] or profile_payload.get("skills"),
        }
        tone = profile.get("cover_letter_tone") or "professional"
        cl = ""
        try:
            from ..ai.reasoner import reason
            analysis = reason(jd, tailored_lists)
            cl = generate_cover_letter(profile, jd, analysis, tone)
        except Exception as e:
            log.warning("cover_letter_failed", error=str(e))

        # Persist cover letter so the /applications/:id Cover tab can render it.
        if cl:
            try:
                cl_row = db().table("cover_letters").insert({
                    "user_id": user_id(),
                    "job_id": app["job_id"],
                    "name": f"{job.get('company') or 'Company'} — {job.get('title') or 'Role'}",
                    "body": cl,
                    "kind": "tailored",
                    "tone": tone,
                }).execute().data
                if cl_row:
                    db().table("applications").update(
                        {"cover_letter_id": cl_row[0]["id"]}
                    ).eq("id", app["id"]).execute()
            except Exception as e:
                log.warning("cover_letter_persist_failed", error=str(e))

        await _save_resume(app["id"], pdf, tex)

        try:
            await rl_acquire(portal.key)
        except RuntimeError as e:
            await _fail(app["id"], str(e), [])
            return

        async with new_browser(portal_key=portal.key) as (page, _ctx):
            await pause(1, 3)
            profile["_tailored_lists"] = tailored_lists
            # Start the field-fills ledger so portal + form_walker can log what they fill
            from . import field_fills as ff
            ff.start(app["id"])
            # Stash job + app_id on the profile dict so portals that call
            # safe_autofill without explicit kwargs still get AI fallback context.
            profile["_apply_job"] = job
            profile["_apply_app_id"] = app["id"]
            try:
                result = await portal.apply(
                    page=page, job=job, profile=profile,
                    resume_pdf=pdf, cover_letter_text=cl,
                )
            finally:
                ff.flush()
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
