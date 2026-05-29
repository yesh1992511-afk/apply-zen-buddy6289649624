"""Indeed Easy Apply. Stub — extend as needed."""
from .base import Portal, ApplyResult


class Indeed(Portal):
    key = "indeed"

    @staticmethod
    def matches(url: str) -> bool:
        return "indeed.com" in url

    async def apply(self, *, page, job, profile, resume_pdf, cover_letter_text):
        return ApplyResult(False, [], error="Indeed adapter not yet implemented")
