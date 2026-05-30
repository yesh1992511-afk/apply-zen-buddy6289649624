"""Lightweight cost telemetry — writes one row per billable call to public.usage_events."""
from typing import Any
from .db import db, user_id
from .logger import log


# Approximate per-1M-token prices (USD). Update when providers change pricing.
PRICES = {
    "openai/gpt-4o-mini": {"in": 0.15, "out": 0.60},
    "openai/gpt-4o":      {"in": 2.50, "out": 10.00},
    "openai/gpt-5":       {"in": 5.00, "out": 15.00},
    "openai/gpt-5-mini":  {"in": 0.30, "out": 1.20},
    "deepseek/deepseek-reasoner": {"in": 0.55, "out": 2.19},
    "deepseek/deepseek-chat":     {"in": 0.27, "out": 1.10},
}


def estimate_ai_cost(model: str, tokens_in: int, tokens_out: int) -> float:
    p = PRICES.get(model) or PRICES.get(model.replace("openai/", "openai/")) or {"in": 0.30, "out": 1.20}
    return round((tokens_in * p["in"] + tokens_out * p["out"]) / 1_000_000, 6)


def record(*, provider: str, kind: str, units: float = 1, cost_usd: float = 0,
           metadata: dict[str, Any] | None = None) -> None:
    """Insert a usage_events row. Never raises — telemetry must not break the worker."""
    try:
        db().table("usage_events").insert({
            "user_id": user_id(),
            "provider": provider,
            "kind": kind,
            "units": units,
            "cost_usd": cost_usd,
            "metadata": metadata or {},
        }).execute()
    except Exception as e:
        log.warning("usage_record_failed", error=str(e))


def record_ai(model: str, tokens_in: int, tokens_out: int, kind: str = "completion",
              metadata: dict[str, Any] | None = None) -> float:
    cost = estimate_ai_cost(model, tokens_in, tokens_out)
    provider = "openai" if model.startswith("openai/") else "deepseek" if model.startswith("deepseek/") else model.split("/")[0]
    record(provider=provider, kind=kind, units=tokens_in + tokens_out,
           cost_usd=cost, metadata={"model": model, "in": tokens_in, "out": tokens_out, **(metadata or {})})
    return cost
