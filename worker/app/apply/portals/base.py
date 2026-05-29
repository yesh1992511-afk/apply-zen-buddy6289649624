"""Portal adapter contract."""
from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class ApplyResult:
    ok: bool
    screenshots: list[str]   # storage paths
    error: str | None = None
    notes: str | None = None


class Portal(ABC):
    key: str

    @staticmethod
    @abstractmethod
    def matches(url: str) -> bool:
        """Return True if this portal handles the given job URL."""

    @abstractmethod
    async def apply(self, *, page, job: dict, profile: dict, resume_pdf: bytes,
                    cover_letter_text: str) -> ApplyResult: ...
