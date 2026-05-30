"""DeepSeek-reasoner: produces a structured analysis of a JD vs profile.

Cached by JD hash to avoid paying for the same analysis twice.
"""
import json
from typing import Any
from .gateway import deepseek_client
from . import cache as _cache
from ..config import settings
from ..usage import record_ai

SYSTEM = """You are an expert career coach. Analyze a job description against a
candidate profile. Return ONLY valid JSON matching this schema:
{
  "fit_score": 0-100,
  "must_have_keywords": [string],
  "nice_to_have_keywords": [string],
  "gaps": [string],
  "tone": "technical|managerial|product|sales",
  "highlight_experiences": [int],
  "highlight_projects": [int],
  "skills_to_promote": [string]
}"""


def reason(jd_text: str, profile_payload: dict[str, Any]) -> dict[str, Any]:
    hash_key = _cache.jd_hash(jd_text)
    cached = _cache.get(hash_key)
    if cached:
        return cached

    client = deepseek_client()
    model = settings().DEEPSEEK_REASONER_MODEL
    resp = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": f"JOB:\n{jd_text}\n\nPROFILE:\n{json.dumps(profile_payload)}"},
        ],
        response_format={"type": "json_object"},
        temperature=0.2,
    )
    analysis = json.loads(resp.choices[0].message.content or "{}")

    usage = getattr(resp, "usage", None)
    t_in = getattr(usage, "prompt_tokens", 0) or 0
    t_out = getattr(usage, "completion_tokens", 0) or 0
    cost = record_ai(f"deepseek/{model}", t_in, t_out, kind="jd_analysis")
    _cache.put(hash_key, analysis, model=model, tokens_in=t_in, tokens_out=t_out, cost_usd=cost)
    return analysis
