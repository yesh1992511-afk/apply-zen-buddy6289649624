"""Orchestrates: load template + profile + JD → reasoner → tailor → compile.
Returns the PDF bytes + the final .tex source.
"""
from typing import Any
from ..db import db, user_id
from ..ai.reasoner import reason
from ..ai.tailor import tailor
from ..latex.markers import extract_markers, apply_replacements
from ..latex.compile import compile_tex


def load_profile_payload() -> dict[str, Any]:
    uid = user_id()
    p = db().table("profile").select("*").eq("user_id", uid).single().execute().data or {}
    exps = db().table("experiences").select("*").eq("user_id", uid).order("sort_order").execute().data or []
    projs = db().table("projects").select("*").eq("user_id", uid).order("sort_order").execute().data or []
    skills = db().table("skills").select("*").eq("user_id", uid).order("sort_order").execute().data or []
    eds = db().table("educations").select("*").eq("user_id", uid).order("sort_order").execute().data or []
    return {"profile": p, "experiences": exps, "projects": projs, "skills": skills, "educations": eds}


def load_template() -> tuple[str, list[dict[str, str]]] | None:
    """Return (tex, markers) for the default .tex template, or None if not set."""
    uid = user_id()
    r = db().table("resumes").select("*").eq("user_id", uid).eq(
        "kind", "template"
    ).eq("is_default", True).limit(1).execute().data
    if not r:
        return None
    tex = r[0]["tex_content"] or ""
    if not tex.strip():
        return None
    markers = extract_markers(tex)
    return tex, markers


def _load_static_pdf() -> bytes | None:
    """Fallback: return raw bytes of the user's default uploaded PDF resume."""
    uid = user_id()
    r = db().table("resumes").select("*").eq("user_id", uid).eq(
        "is_default", True
    ).not_.is_("pdf_storage_path", "null").limit(1).execute().data
    if not r:
        # As a last resort, take the most recent uploaded PDF.
        r = db().table("resumes").select("*").eq("user_id", uid).not_.is_(
            "pdf_storage_path", "null"
        ).order("created_at", desc=True).limit(1).execute().data
    if not r:
        return None
    path = r[0].get("pdf_storage_path")
    if not path:
        return None
    try:
        return db().storage.from_("resumes").download(path)
    except Exception:
        return None


def build_resume_pdf(jd_text: str) -> tuple[bytes, str]:
    tpl = load_template()
    if tpl is None:
        # No LaTeX template — fall back to a static uploaded PDF so the
        # apply pipeline doesn't hard-fail when the user hasn't authored a
        # tex template yet.
        pdf = _load_static_pdf()
        if pdf is None:
            raise RuntimeError(
                "No resume available. Upload a PDF (Profile → Resume) or set a default .tex template."
            )
        return pdf, ""
    tex, markers = tpl
    if not markers:
        # No markers → just compile the template as-is.
        return compile_tex(tex), tex
    profile = load_profile_payload()
    analysis = reason(jd_text, profile)
    repl = tailor(markers, analysis, jd_text)
    new_tex = apply_replacements(tex, repl, allowed={m["name"] for m in markers})
    return compile_tex(new_tex), new_tex


# --------------------------------------------------------------------------
# Tailored resume per job — stored in generated_resumes table.
# This is the source of truth for Summary/Experience/Projects/Skills during
# auto-apply form filling. Profile basics (name, email, phone, address, etc.)
# still come from the profile table.
# --------------------------------------------------------------------------

def _ai_pick_top_experiences(profile_payload: dict[str, Any], jd_text: str, analysis: dict[str, Any]) -> dict[str, Any]:
    """Use the reasoner output to pick + rewrite top experiences/projects/skills.

    Returns: {
      "summary": str,
      "experiences": [{"company","title","start_date","end_date","location","bullets":[...]}],
      "projects": [{"name","url","tech":[...],"bullets":[...]}],
      "skills": [str, ...],
    }
    Falls back to top 4 experiences / top 4 projects by sort_order if AI fails.
    """
    exps = profile_payload.get("experiences") or []
    projs = profile_payload.get("projects") or []
    skills = [s.get("name") for s in (profile_payload.get("skills") or []) if s.get("name")]
    summary = (profile_payload.get("profile") or {}).get("summary") or ""

    keywords = []
    if isinstance(analysis, dict):
        keywords = [k.lower() for k in (analysis.get("keywords") or [])]
        if analysis.get("summary"):
            summary = str(analysis["summary"])[:600]
        if analysis.get("tailored_summary"):
            summary = str(analysis["tailored_summary"])[:600]

    def score(text: str) -> int:
        t = (text or "").lower()
        return sum(1 for k in keywords if k and k in t)

    # Rank experiences by keyword hits in title + bullets + tech
    def exp_text(e: dict) -> str:
        return " ".join([
            e.get("title") or "", e.get("company") or "",
            " ".join(e.get("bullets") or []), " ".join(e.get("tech") or []),
        ])
    ranked_exps = sorted(exps, key=lambda e: (-score(exp_text(e)), e.get("sort_order") or 0))[:5]
    ranked_projs = sorted(projs, key=lambda p: (-score(
        " ".join([p.get("name") or "", p.get("description") or "",
                  " ".join(p.get("bullets") or []), " ".join(p.get("tech") or [])])
    ), p.get("sort_order") or 0))[:4]

    # Skills: keep ones that match JD keywords first, then up to 20 total
    matched_skills = [s for s in skills if s and any(k in s.lower() for k in keywords)]
    other_skills = [s for s in skills if s not in matched_skills]
    final_skills = (matched_skills + other_skills)[:20]

    return {
        "summary": summary,
        "experiences": [{
            "company": e.get("company"),
            "title": e.get("title"),
            "start_date": str(e.get("start_date") or "") or None,
            "end_date": str(e.get("end_date") or "") or None,
            "location": e.get("location"),
            "bullets": (e.get("bullets") or [])[:6],
            "tech": e.get("tech") or [],
        } for e in ranked_exps],
        "projects": [{
            "name": p.get("name"),
            "url": p.get("url"),
            "tech": p.get("tech") or [],
            "bullets": (p.get("bullets") or [])[:4],
            "description": p.get("description"),
        } for p in ranked_projs],
        "skills": final_skills,
    }


def build_tailored_resume(job_id: str, jd_text: str) -> tuple[bytes, str, dict[str, Any]]:
    """Build a tailored resume for a specific job. Persists to generated_resumes.

    Returns (pdf_bytes, tex_source, tailored_payload).

    tailored_payload is what profile_map should read from instead of the raw
    profile tables for summary / experiences / projects / skills.
    """
    uid = user_id()
    # Check cache first — same job + same user → reuse the tailored payload.
    existing = db().table("generated_resumes").select("*").eq(
        "user_id", uid
    ).eq("job_id", job_id).maybeSingle().execute().data
    if existing and existing.get("pdf_storage_path"):
        try:
            pdf = db().storage.from_("resumes").download(existing["pdf_storage_path"])
            return pdf, existing.get("tex_content") or "", {
                "summary": existing.get("tailored_summary") or "",
                "experiences": existing.get("tailored_experiences") or [],
                "projects": existing.get("tailored_projects") or [],
                "skills": existing.get("tailored_skills") or [],
            }
        except Exception:
            pass

    profile_payload = load_profile_payload()
    analysis: dict[str, Any] = {}
    try:
        analysis = reason(jd_text, profile_payload) or {}
    except Exception as e:
        log_msg = f"resume reason failed: {e}"
        from ..logger import log as _log
        _log.warning("resume_reason_failed", error=str(e))

    tailored = _ai_pick_top_experiences(profile_payload, jd_text, analysis)

    # Build the PDF. If there's a template with markers, run the tailor step;
    # otherwise just compile the template; otherwise fall back to static PDF.
    tpl = load_template()
    pdf_bytes: bytes
    tex_source = ""
    if tpl is None:
        pdf_bytes = _load_static_pdf() or b""
        if not pdf_bytes:
            raise RuntimeError(
                "No resume available. Upload a PDF (Profile → Resume) or set a default .tex template."
            )
    else:
        tex, markers = tpl
        if markers:
            repl = tailor(markers, analysis, jd_text)
            tex_source = apply_replacements(tex, repl, allowed={m["name"] for m in markers})
        else:
            tex_source = tex
        pdf_bytes = compile_tex(tex_source)

    # Upload PDF
    pdf_path = f"{uid}/generated/{job_id}.pdf"
    try:
        db().storage.from_("resumes").upload(
            pdf_path, pdf_bytes,
            {"content-type": "application/pdf", "upsert": "true"},
        )
    except Exception:
        pass

    # Upsert generated_resumes row
    row = {
        "user_id": uid,
        "job_id": job_id,
        "tailored_summary": tailored["summary"],
        "tailored_experiences": tailored["experiences"],
        "tailored_projects": tailored["projects"],
        "tailored_skills": tailored["skills"],
        "pdf_storage_path": pdf_path,
        "tex_content": tex_source or None,
        "model": (analysis or {}).get("model") if isinstance(analysis, dict) else None,
    }
    if existing:
        db().table("generated_resumes").update(row).eq("id", existing["id"]).execute()
    else:
        db().table("generated_resumes").insert(row).execute()

    return pdf_bytes, tex_source, tailored
