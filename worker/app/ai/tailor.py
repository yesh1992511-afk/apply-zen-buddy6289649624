"""OpenAI: generates replacement strings for % LOV: markers in the LaTeX template.

Returns ONLY a JSON object mapping marker name -> plain text. The LaTeX
shell, commands, and structure are never touched.

Tier-aware: defaults to cost-efficient gpt-4o-mini for tailoring; the user can
override per-application via automation_settings.ai_resume_model.
"""
import json
from typing import Any
from .gateway import openai_client
from ..config import settings
from ..usage import record_ai
from ..db import db, user_id

SYSTEM = """You tailor resume bullets and summaries.
Given:
- A list of marker names with their CURRENT text and a hint of what they hold.
- The reasoner's analysis of the job.
Return JSON: { "<markerName>": "<new plain text, no LaTeX>" } for every marker.
Rules:
- Plain text only. No LaTeX commands, no $, no \\, no %.
- Keep length within +/- 25% of current.
- Be specific, use metrics where possible.
- Don't fabricate experience; reword to highlight relevance.
"""


def _resolve_model() -> str:
    """Prefer per-user setting, fall back to env default."""
    try:
        r = db().table("automation_settings").select("ai_resume_model").eq(
            "user_id", user_id()
        ).maybe_single().execute()
        m = (getattr(r, "data", None) or {}).get("ai_resume_model")
        if m:
            return m.split("/", 1)[1] if m.startswith("openai/") else m
    except Exception:
        pass
    return settings().OPENAI_MODEL


def tailor(markers: list[dict[str, Any]], analysis: dict[str, Any], jd_text: str) -> dict[str, str]:
    client = openai_client()
    model = _resolve_model()
    user = {
        "markers": markers,
        "analysis": analysis,
        "jd_excerpt": jd_text[:4000],
    }
    resp = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": json.dumps(user)},
        ],
        response_format={"type": "json_object"},
        temperature=0.4,
    )
    usage = getattr(resp, "usage", None)
    record_ai(
        f"openai/{model}",
        getattr(usage, "prompt_tokens", 0) or 0,
        getattr(usage, "completion_tokens", 0) or 0,
        kind="resume_tailor",
    )
    return json.loads(resp.choices[0].message.content or "{}")
