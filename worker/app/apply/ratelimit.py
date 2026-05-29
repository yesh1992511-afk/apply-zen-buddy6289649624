"""Per-portal token-bucket rate limit + circuit breaker.

State is in-process (resets on restart). For a single-VPS deployment this is
sufficient and avoids the cost of persisting tiny counters to the DB.
"""
import asyncio
import time
from collections import defaultdict, deque
from dataclasses import dataclass, field

# Per-hour caps per portal (be polite, especially LinkedIn).
HOURLY_CAPS = {
    "linkedin": 30,
    "indeed": 60,
    "greenhouse": 120,
    "lever": 120,
    "workday": 40,
    "default": 60,
}

# Circuit breaker: if N challenges seen within WINDOW seconds, pause for COOLDOWN.
CB_THRESHOLD = 3
CB_WINDOW = 600       # 10 min
CB_COOLDOWN = 2 * 3600  # 2 hr


@dataclass
class PortalState:
    bucket: deque = field(default_factory=deque)   # ts of recent calls
    challenges: deque = field(default_factory=deque)
    paused_until: float = 0.0


_state: dict[str, PortalState] = defaultdict(PortalState)
_lock = asyncio.Lock()


async def acquire(portal_key: str) -> None:
    """Block until the portal has budget. Raises RuntimeError if circuit open."""
    async with _lock:
        s = _state[portal_key]
        now = time.time()
        if s.paused_until > now:
            raise RuntimeError(
                f"circuit_open: {portal_key} paused for "
                f"{int(s.paused_until - now)}s due to repeated challenges"
            )

        cap = HOURLY_CAPS.get(portal_key, HOURLY_CAPS["default"])
        cutoff = now - 3600
        while s.bucket and s.bucket[0] < cutoff:
            s.bucket.popleft()
        if len(s.bucket) >= cap:
            wait = s.bucket[0] + 3600 - now
        else:
            wait = 0
            s.bucket.append(now)
    if wait > 0:
        await asyncio.sleep(wait)
        await acquire(portal_key)


def record_challenge(portal_key: str) -> None:
    """Call when captcha / 2FA / IP block detected. Opens circuit on threshold."""
    s = _state[portal_key]
    now = time.time()
    cutoff = now - CB_WINDOW
    while s.challenges and s.challenges[0] < cutoff:
        s.challenges.popleft()
    s.challenges.append(now)
    if len(s.challenges) >= CB_THRESHOLD:
        s.paused_until = now + CB_COOLDOWN
        s.challenges.clear()
