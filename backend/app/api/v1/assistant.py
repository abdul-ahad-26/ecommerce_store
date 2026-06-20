"""AI shopping assistant endpoints.

Step 1: a non-streaming chat endpoint that runs the agent loop to completion.
Streaming (SSE) is layered on in a later step.
"""

import logging

from fastapi import APIRouter, HTTPException, status
from fastapi.responses import StreamingResponse

from app.core.config import settings
from app.deps import DbSession, OptionalUser
from app.schemas.assistant import ChatRequest, ChatResponse, ModelsResponse
from app.services.assistant.agent import run_assistant
from app.services.assistant.models import (
    AssistantConfigError,
    available_models,
    build_model,
    resolve_model_key,
)
from app.services.assistant.stream import STREAM_HEADERS, stream_assistant
from app.services.assistant.tools import AssistantContext

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/assistant", tags=["assistant"])


def _require_enabled() -> None:
    if not settings.ASSISTANT_ENABLED:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The assistant is currently unavailable.",
        )


@router.get("/models", response_model=ModelsResponse)
async def list_models() -> ModelsResponse:
    """The model registry + which keys are configured (for the dev picker)."""
    return ModelsResponse(
        default=settings.ASSISTANT_MODEL,
        override_allowed=settings.ASSISTANT_ALLOW_MODEL_OVERRIDE,
        models=available_models(),  # type: ignore[arg-type]
    )


@router.post("/chat", response_model=ChatResponse)
async def chat(payload: ChatRequest, db: DbSession, user: OptionalUser) -> ChatResponse:
    _require_enabled()
    model_key = resolve_model_key(payload.model)
    context = AssistantContext(db=db, user=user)

    try:
        result = await run_assistant(
            context=context, messages=payload.messages, model_key=model_key
        )
    except AssistantConfigError as exc:
        # Misconfiguration (e.g. missing API key) — a server-side problem.
        logger.error("Assistant misconfigured: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The assistant is not configured.",
        ) from exc
    except Exception as exc:  # noqa: BLE001 — surface upstream/model failures as 502
        logger.exception("Assistant run failed")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="The assistant could not complete your request.",
        ) from exc

    return ChatResponse(
        reply=result.reply,
        model=result.model,
        cart_actions=result.cart_actions,  # type: ignore[arg-type]
    )


@router.post("/chat/stream")
async def chat_stream(
    payload: ChatRequest, db: DbSession, user: OptionalUser
) -> StreamingResponse:
    """Streaming counterpart to /chat — emits the AI SDK UI message stream.

    The frontend's ``useChat`` consumes this; text arrives token-by-token and
    cart suggestions arrive as ``data-cart-action`` parts.
    """
    _require_enabled()
    model_key = resolve_model_key(payload.model)

    # Validate the model up front so a config error is a clean 503 instead of
    # surfacing mid-stream (after the response headers are already sent).
    try:
        build_model(model_key)
    except AssistantConfigError as exc:
        logger.error("Assistant misconfigured: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The assistant is not configured.",
        ) from exc

    context = AssistantContext(db=db, user=user)
    generator = stream_assistant(
        context=context, messages=payload.messages, model_key=model_key
    )
    return StreamingResponse(
        generator, media_type="text/event-stream", headers=STREAM_HEADERS
    )
