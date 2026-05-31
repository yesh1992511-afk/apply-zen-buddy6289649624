"""Cover letter generation. Returns plain text (4-6 short paragraphs)."""
from typing import Any
from .gateway import openai_client
from ..config import settings

SYSTEM = """Write a concise, professional cover letter (4-6 short paragraphs,
max 350 words). Match the requested tone. Reference 1-2 specific items from
the JD. No clichés ('I am writing to express...'). Plain text, no markdown.

When TAILORED_HIGHLIGHTS are provided they reflect the experiences/projects
that were already scored as the best fit for THIS job — anchor the letter on
them, do NOT invent new ones, and stay consistent with the tailored resume.
"""


def generate(profile: dict[str, Any], jd_text: str, analysis: dict[str, Any], tone: str) -> str:
    client = openai_client()

    # Pull tailored highlights set by apply/runner.py so the letter mirrors
    # the per-job resume bullets and summary.
    tailored = profile.get("_tailored_lists") if isinstance(profile, dict) else None
    highlights_block = ""
    if tailored:
        exps = (tailored.get("experiences") or [])[:3]
        projs = (tailored.get("projects") or [])[:2]
        summary = tailored.get("summary") or profile.get("summary") or ""
        highlights_block = (
            f"TAILORED_SUMMARY:\n{summary}\n\n"
            f"TAILORED_EXPERIENCES:\n{exps}\n\n"
            f"TAILORED_PROJECTS:\n{projs}\n\n"
        )

    # Strip the bulky tailored payload from the raw profile dump.
    slim_profile = {k: v for k, v in (profile or {}).items() if k != "_tailored_lists"}

    user = (
        f"TONE: {tone}\n"
        f"PROFILE:\n{slim_profile}\n\n"
        f"{highlights_block}"
        f"ANALYSIS:\n{analysis}\n\n"
        f"JD:\n{jd_text[:3000]}"
    )
    resp = client.chat.completions.create(
        model=settings().OPENAI_MODEL,
        messages=[
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": user},
        ],
        temperature=0.6,
    )
    return (resp.choices[0].message.content or "").strip()
