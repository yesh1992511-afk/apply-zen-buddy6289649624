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


def load_template() -> tuple[str, list[dict[str, str]]]:
    uid = user_id()
    r = db().table("resumes").select("*").eq("user_id", uid).eq(
        "kind", "template"
    ).eq("is_default", True).limit(1).execute().data
    if not r:
        raise RuntimeError("No default LaTeX template uploaded. Go to Profile → upload .tex.")
    tex = r[0]["tex_content"] or ""
    markers = extract_markers(tex)
    return tex, markers


def build_resume_pdf(jd_text: str) -> tuple[bytes, str]:
    tex, markers = load_template()
    if not markers:
        # No markers → just compile the template as-is.
        return compile_tex(tex), tex
    profile = load_profile_payload()
    analysis = reason(jd_text, profile)
    repl = tailor(markers, analysis, jd_text)
    new_tex = apply_replacements(tex, repl, allowed={m["name"] for m in markers})
    return compile_tex(new_tex), new_tex
