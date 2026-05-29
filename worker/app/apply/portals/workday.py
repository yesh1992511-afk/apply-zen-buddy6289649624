"""Workday (myworkdayjobs.com/*). Stub — extend as needed."""
from .base import Portal, ApplyResult


class Workday(Portal):
    key = "workday"

    @staticmethod
    def matches(url: str) -> bool:
        return "myworkdayjobs.com" in url

    async def apply(self, *, page, job, profile, resume_pdf, cover_letter_text):
        return ApplyResult(False, [], error="Workday adapter not yet implemented")
