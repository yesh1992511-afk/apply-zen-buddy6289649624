"""JD-analysis cache — keyed by the job's dedupe_hash."""
import hashlib
from datetime import datetime, timezone
from typing import Any
from ..db import db
from ..logger import log


def jd_hash(jd_text: str) -> str:
    return hashlib.sha256((jd_text or "").strip().encode("utf-8")).hexdigest()[:32]


def get(hash_key: str) -> dict[str, Any] | None:
    try:
        r = db().table("jd_analysis_cache").select("*").eq("dedupe_hash", hash_key).maybe_single().execute()
        row = getattr(r, "data", None)
        if not row:
            return None
        # bump hit counter (fire-and-forget)
        try:
            db().table("jd_analysis_cache").update({
                "hit_count": (row.get("hit_count") or 0) + 1,
                "last_used_at": datetime.now(timezone.utc).isoformat(),
            }).eq("id", row["id"]).execute()
        except Exception:
            pass
        return row.get("analysis")
    except Exception as e:
        log.warning("jd_cache_get_failed", error=str(e))
        return None


def put(hash_key: str, analysis: dict[str, Any], *, model: str,
        tokens_in: int = 0, tokens_out: int = 0, cost_usd: float = 0) -> None:
    try:
        db().table("jd_analysis_cache").upsert({
            "dedupe_hash": hash_key,
            "model": model,
            "analysis": analysis,
            "tokens_in": tokens_in,
            "tokens_out": tokens_out,
            "cost_usd": cost_usd,
        }, on_conflict="dedupe_hash").execute()
    except Exception as e:
        log.warning("jd_cache_put_failed", error=str(e))
