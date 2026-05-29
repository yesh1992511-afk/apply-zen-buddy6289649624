"""Per-user dedupe based on (title, company, url)."""
import hashlib
import re
from ..db import db, user_id


def _slug(s: str) -> str:
    return re.sub(r"\W+", "", (s or "").lower())


def dedupe_hash(title: str, company: str, url: str) -> str:
    base = f"{_slug(title)}|{_slug(company)}|{(url or '').split('?')[0].lower()}"
    return hashlib.sha256(base.encode()).hexdigest()


def exists(hash_: str) -> bool:
    r = db().table("jobs").select("id", count="exact").eq(
        "user_id", user_id()
    ).eq("dedupe_hash", hash_).limit(1).execute()
    return (r.count or 0) > 0
