"""OpenAI: generates replacement strings for % LOV: markers in the LaTeX template.

Returns ONLY a JSON object mapping marker name -> plain text. The LaTeX
shell, commands, and structure are never touched.
"""
import json
from typing import Any
from .gateway import openai_client
from ..config import settings

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


def tailor(markers: list[dict[str, Any]], analysis: dict[str, Any], jd_text: str) -> dict[str, str]:
    client = openai_client()
    user = {
        "markers": markers,
        "analysis": analysis,
        "jd_excerpt": jd_text[:4000],
    }
    resp = client.chat.completions.create(
        model=settings().OPENAI_MODEL,
        messages=[
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": json.dumps(user)},
        ],
        response_format={"type": "json_object"},
        temperature=0.4,
    )
    return json.loads(resp.choices[0].message.content or "{}")
