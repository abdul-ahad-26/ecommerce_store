"""SSE streaming in the Vercel AI SDK "UI Message Stream" protocol (v1).

The frontend's ``useChat`` consumes this. Each SSE event is one JSON chunk
(``data: {...}\\n\\n``); the stream terminates with ``data: [DONE]``. The exact
chunk shapes live only in this module, so an AI SDK version bump is a one-file
change.

Chunk types we emit:
  start / text-start / text-delta / text-end / finish — the assistant's reply
  data-cart-action — a structured cart suggestion the widget renders as a button
  error — a mid-stream failure (after headers are already sent)
"""

from __future__ import annotations

import json
import logging
import uuid
from collections.abc import AsyncIterator

from agents import Runner
from openai.types.responses import ResponseTextDeltaEvent

from app.core.config import settings
from app.schemas.assistant import ChatMessage
from app.services.assistant.agent import build_agent, configure_once
from app.services.assistant.tools import AssistantContext

logger = logging.getLogger(__name__)

# Response headers: tell the AI SDK client this is a UI message stream, and keep
# proxies (nginx/Render) from buffering the SSE bytes.
STREAM_HEADERS = {
    "x-vercel-ai-ui-message-stream": "v1",
    "Cache-Control": "no-cache",
    "X-Accel-Buffering": "no",
}

DONE = "data: [DONE]\n\n"


def _sse(chunk: dict) -> str:
    return f"data: {json.dumps(chunk, separators=(',', ':'))}\n\n"


async def stream_assistant(
    *, context: AssistantContext, messages: list[ChatMessage], model_key: str
) -> AsyncIterator[str]:
    """Run the agent and yield AI-SDK-protocol SSE chunks as text streams in."""
    configure_once()
    agent = build_agent(model_key)
    history = messages[-settings.ASSISTANT_MAX_HISTORY :]
    input_items = [{"role": m.role, "content": m.content} for m in history]

    text_id = uuid.uuid4().hex
    yield _sse({"type": "start"})
    yield _sse({"type": "text-start", "id": text_id})

    try:
        result = Runner.run_streamed(
            agent,
            input_items,
            context=context,
            max_turns=settings.ASSISTANT_MAX_TURNS,
        )
        async for event in result.stream_events():
            if event.type == "raw_response_event" and isinstance(
                event.data, ResponseTextDeltaEvent
            ):
                if event.data.delta:
                    yield _sse(
                        {"type": "text-delta", "id": text_id, "delta": event.data.delta}
                    )
    except Exception:  # noqa: BLE001 — headers are sent; report via an error chunk
        logger.exception("Assistant stream failed")
        yield _sse({"type": "text-end", "id": text_id})
        yield _sse(
            {
                "type": "error",
                "errorText": "The assistant could not complete your request.",
            }
        )
        yield DONE
        return

    yield _sse({"type": "text-end", "id": text_id})

    # Cart suggestions raised during the run -> typed data parts for the widget.
    for action in context.proposed_actions:
        yield _sse({"type": "data-cart-action", "data": action})

    yield _sse({"type": "finish"})
    yield DONE
