"""DeepSeek-reasoner: produces a structured analysis of a JD vs profile."""
import json
from typing import Any
from .gateway import deepseek_client
from ..config import settings

SYSTEM = """You are an expert career coach. Analyze a job description against a
candidate profile. Return ONLY valid JSON matching this schema:
{
  "fit_score": 0-100,
  "must_have_keywords": [string],
  "nice_to_have_keywords": [string],
  "gaps": [string],
  "tone": "technical|managerial|product|sales",
  "highlight_experiences": [int],   // indices of experiences to emphasize
  "highlight_projects": [int],
  "skills_to_promote": [string]
}"""


def reason(jd_text: str, profile_payload: dict[str, Any]) -> dict[str, Any]:
    client = deepseek_client()
    resp = client.chat.completions.create(
        model=settings().DEEPSEEK_REASONER_MODEL,
        messages=[
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": f"JOB:\n{jd_text}\n\nPROFILE:\n{json.dumps(profile_payload)}"},
        ],
        response_format={"type": "json_object"},
        temperature=0.2,
    )
    return json.loads(resp.choices[0].message.content or "{}")
