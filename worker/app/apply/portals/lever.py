"""Lever ATS (jobs.lever.co/*). Stub — extend as needed."""
from .base import Portal, ApplyResult


class Lever(Portal):
    key = "lever"

    @staticmethod
    def matches(url: str) -> bool:
        return "jobs.lever.co" in url or "lever.co" in url

    async def apply(self, *, page, job, profile, resume_pdf, cover_letter_text):
        return ApplyResult(False, [], error="Lever adapter not yet implemented")
