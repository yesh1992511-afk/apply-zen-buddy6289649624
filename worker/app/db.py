"""Supabase service-role client. Bypasses RLS — use carefully."""
from functools import lru_cache
from supabase import create_client, Client
from .config import settings


@lru_cache
def db() -> Client:
    s = settings()
    return create_client(s.SUPABASE_URL, s.SUPABASE_SERVICE_ROLE_KEY)


def user_id() -> str:
    return settings().JOBPILOT_USER_ID
