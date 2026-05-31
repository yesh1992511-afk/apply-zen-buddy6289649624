"""AI fallback for unknown ATS screening questions.

When the regex/profile lookup in `profile_map.answer_for()` returns nothing
for a free-text question, we ask DeepSeek to produce a short answer using
the tailored resume + JD as context, then cache it in
`profile.screening_answers` (jsonb) under a normalized key so the next time
the same question appears we don't pay for inference.
"""
from __future__ import annotations
import re
from typing import Any
from ..db import db, user_id
from ..logger import log


def normalize_question(q: str) -> str:
    q = re.sub(r"\s+", " ", (q or "").strip().lower())
    q = re.sub(r"[^a-z0-9 ]+", "", q)
    return q[:240]


def _cached(profile: dict, key: str) -> str | None:
    sa = profile.get("screening_answers") or {}
    if not isinstance(sa, dict):
        return None
    v = sa.get(key)
    if isinstance(v, str) and v.strip():
        return v
    return None


def _persist(key: str, answer: str) -> None:
    """Merge new answer into profile.screening_answers."""
    try:
        row = db().table("profile").select("screening_answers").eq(
            "user_id", user_id()
        ).single().execute().data or {}
        sa = row.get("screening_answers") or {}
        if not isinstance(sa, dict):
            sa = {}
        sa[key] = answer
        db().table("profile").update({"screening_answers": sa}).eq(
            "user_id", user_id()
        ).execute()
    except Exception as e:
        log.warning("screening_cache_persist_failed", error=str(e))


def answer_with_ai(question: str, profile: dict, job_context: dict | None = None,
                   long_form: bool = False) -> tuple[str | None, str]:
    """Return (answer, source) where source ∈ {cache, ai, none}.

    long_form=True allows multi-sentence (cover-letter style) answers; otherwise
    we ask for a single short factual line (yes/no, a number, one phrase).
    """
    key = normalize_question(question)
    if not key:
        return None, "none"

    cached = _cached(profile, key)
    if cached:
        return cached, "cache"

    try:
        from .gateway import deepseek_client
        from ..config import settings
        tailored = (profile.get("_tailored_lists") or {}) if isinstance(profile, dict) else {}
        ctx_parts = []
        if profile.get("headline"):
            ctx_parts.append(f"Headline: {profile['headline']}")
        if tailored.get("summary") or profile.get("summary"):
            ctx_parts.append(f"Summary: {tailored.get('summary') or profile.get('summary')}")
        if tailored.get("skills"):
            ctx_parts.append("Skills: " + ", ".join(tailored["skills"][:20]))
        if job_context:
            ctx_parts.append(f"Job: {job_context.get('title','')} @ {job_context.get('company','')}")
            jd = (job_context.get("description") or "")[:1500]
            if jd:
                ctx_parts.append(f"JD: {jd}")
        context = "\n".join(ctx_parts)

        style = (
            "Write a concise, professional 3-5 sentence answer in first person."
            if long_form else
            "Answer in ONE short line. If yes/no, reply 'Yes' or 'No'. If a number, reply with just the number."
        )
        prompt = (
            f"You are filling out a job application form on behalf of the candidate.\n"
            f"{context}\n\n"
            f"Form question: {question}\n\n"
            f"{style} Do not invent specific employers, dates, or credentials that aren't in the context."
        )
        client = deepseek_client()
        model = settings().DEEPSEEK_CHAT_MODEL or "deepseek-chat"
        resp = client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2,
            max_tokens=400 if long_form else 60,
        )
        ans = (resp.choices[0].message.content or "").strip().strip('"').strip()
        if not ans:
            return None, "none"
        _persist(key, ans)
        return ans, "ai"
    except Exception as e:
        log.warning("screening_ai_failed", question=question[:120], error=str(e))
        return None, "none"
