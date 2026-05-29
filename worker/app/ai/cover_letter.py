"""Cover letter generation. Returns plain text (4-6 short paragraphs)."""
from typing import Any
from .gateway import openai_client
from ..config import settings

SYSTEM = """Write a concise, professional cover letter (4-6 short paragraphs,
max 350 words). Match the requested tone. Reference 1-2 specific items from
the JD. No clichés ('I am writing to express...'). Plain text, no markdown.
"""


def generate(profile: dict[str, Any], jd_text: str, analysis: dict[str, Any], tone: str) -> str:
    client = openai_client()
    user = (
        f"TONE: {tone}\n"
        f"PROFILE:\n{profile}\n\n"
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
