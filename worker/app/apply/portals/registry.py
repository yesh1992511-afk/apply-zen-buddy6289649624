"""Portal registry — pick the right adapter for a job URL."""
from .base import Portal
from .linkedin import LinkedIn
from .greenhouse import Greenhouse
from .lever import Lever
from .workday import Workday
from .indeed import Indeed
from .ashby import Ashby

PORTALS: list[Portal] = [LinkedIn(), Greenhouse(), Lever(), Workday(), Indeed(), Ashby()]


def find_portal(url: str) -> Portal | None:
    for p in PORTALS:
        if p.matches(url):
            return p
    return None
