"""A tiny in-memory, per-IP rate limiter for the assistant chat endpoints.

Single-instance friendly (Render runs one container) — a sliding 60s window per
client. Not meant to be a distributed limiter; it's a cheap guard against a
single client hammering the LLM and running up cost.
"""

from __future__ import annotations

import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request, status

from app.core.config import settings

_WINDOW_SECONDS = 60.0
_hits: dict[str, deque[float]] = defaultdict(deque)


def _client_key(request: Request) -> str:
    # Behind a proxy (Render), the real client is the first X-Forwarded-For hop.
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


async def rate_limit(request: Request) -> None:
    limit = settings.ASSISTANT_RATE_LIMIT_PER_MIN
    if limit <= 0:
        return
    now = time.monotonic()
    bucket = _hits[_client_key(request)]
    while bucket and now - bucket[0] > _WINDOW_SECONDS:
        bucket.popleft()
    if len(bucket) >= limit:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many requests — please slow down.",
        )
    bucket.append(now)
