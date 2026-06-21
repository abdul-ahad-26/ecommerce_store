"""Model registry — the single place to add/swap an assistant model.

OpenAI models run on the native Responses API (so the OpenAI tracing dashboard
works). Everything else is an OpenAI-*compatible* Chat Completions endpoint
(e.g. Groq), wrapped in ``OpenAIChatCompletionsModel`` with its own client.

Switch the active model with the ``ASSISTANT_MODEL`` env var, or per-request
(dev only) when ``ASSISTANT_ALLOW_MODEL_OVERRIDE`` is set.
"""

from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache

from agents import OpenAIChatCompletionsModel
from agents.models.interface import Model
from openai import AsyncOpenAI

from app.core.config import settings

GROQ_BASE_URL = "https://api.groq.com/openai/v1"


@dataclass(frozen=True)
class ModelSpec:
    provider: str  # "openai" | "groq"
    model: str  # provider-side model id
    label: str  # human label for the dev picker


# Add a line here to expose another model. Keys are "<provider>:<short-name>".
REGISTRY: dict[str, ModelSpec] = {
    "openai:gpt-4.1-mini": ModelSpec("openai", "gpt-4.1-mini", "OpenAI · GPT-4.1 mini"),
    "openai:gpt-4.1-nano": ModelSpec("openai", "gpt-4.1-nano", "OpenAI · GPT-4.1 nano"),
    "openai:gpt-4o-mini": ModelSpec("openai", "gpt-4o-mini", "OpenAI · GPT-4o mini"),
    # gpt-oss-120b is the reliable free option; Llama 3.3 on Groq intermittently
    # fails to format tool calls ("Failed to call a function"), so it's best-effort.
    "groq:gpt-oss-120b": ModelSpec(
        "groq", "openai/gpt-oss-120b", "Groq · GPT-OSS 120B (recommended)"
    ),
    "groq:llama-3.3-70b": ModelSpec(
        "groq", "llama-3.3-70b-versatile", "Groq · Llama 3.3 70B (flaky tools)"
    ),
}


class AssistantConfigError(RuntimeError):
    """Raised when the requested model can't be built (e.g. missing key)."""


@lru_cache
def _groq_client() -> AsyncOpenAI:
    return AsyncOpenAI(base_url=GROQ_BASE_URL, api_key=settings.GROQ_API_KEY)


def build_model(key: str) -> str | Model:
    """Return a value the ``Agent(model=...)`` accepts for this registry key.

    OpenAI keys return a plain model-id string (native Responses API); other
    providers return a configured ``OpenAIChatCompletionsModel``.
    """
    spec = REGISTRY.get(key)
    if spec is None:
        raise AssistantConfigError(f"Unknown model key: {key!r}")

    if spec.provider == "openai":
        if not settings.OPENAI_API_KEY:
            raise AssistantConfigError("OPENAI_API_KEY is not set.")
        return spec.model

    if spec.provider == "groq":
        if not settings.GROQ_API_KEY:
            raise AssistantConfigError("GROQ_API_KEY is not set.")
        return OpenAIChatCompletionsModel(model=spec.model, openai_client=_groq_client())

    raise AssistantConfigError(f"Unknown provider: {spec.provider!r}")


def _has_key(spec: ModelSpec) -> bool:
    if spec.provider == "openai":
        return bool(settings.OPENAI_API_KEY)
    if spec.provider == "groq":
        return bool(settings.GROQ_API_KEY)
    return False


def available_models() -> list[dict]:
    """Registry as JSON for the dev model picker — flags which have a key set."""
    return [
        {
            "key": key,
            "label": spec.label,
            "provider": spec.provider,
            "available": _has_key(spec),
        }
        for key, spec in REGISTRY.items()
    ]


def resolve_model_key(requested: str | None) -> str:
    """Pick the model key: an allowed per-request override, else the env default."""
    if (
        requested
        and settings.ASSISTANT_ALLOW_MODEL_OVERRIDE
        and requested in REGISTRY
    ):
        return requested
    if settings.ASSISTANT_MODEL in REGISTRY:
        return settings.ASSISTANT_MODEL
    # Misconfigured env: fall back to the first registered key so we never 500
    # on a typo'd ASSISTANT_MODEL.
    return next(iter(REGISTRY))
