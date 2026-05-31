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
