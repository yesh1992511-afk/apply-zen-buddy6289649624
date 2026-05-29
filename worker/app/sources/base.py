"""Source adapter contract."""
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any, Iterable


@dataclass
class RawJob:
    source_job_id: str | None
    title: str
    company: str
    url: str
    location: str | None = None
    remote: str | None = None
    description: str | None = None
    description_html: str | None = None
    employment_type: str | None = None
    seniority: str | None = None
    salary_min: int | None = None
    salary_max: int | None = None
    salary_currency: str | None = None
    posted_at: str | None = None
    raw: dict[str, Any] | None = None


class Source(ABC):
    key: str  # e.g. "apify:linkedin", "remoteok"

    @abstractmethod
    async def fetch(self, config: dict[str, Any]) -> Iterable[RawJob]: ...
