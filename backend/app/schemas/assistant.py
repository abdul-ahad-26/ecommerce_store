"""Pydantic schemas for the AI shopping assistant API."""

from typing import Literal

from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=4000)


class ChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(min_length=1, max_length=50)
    # Optional model key (dev only; honoured when ASSISTANT_ALLOW_MODEL_OVERRIDE).
    model: str | None = None


class CartAction(BaseModel):
    action: Literal["add_to_cart"]
    variant_id: int
    slug: str
    product_name: str
    variant_label: str | None = None
    unit_price: float
    image: str | None = None
    qty: int
    label: str  # display label, e.g. "Rose Lawn 3pc — S / Red"


class ChatResponse(BaseModel):
    reply: str
    model: str  # the model key actually used
    cart_actions: list[CartAction] = []


class ModelInfo(BaseModel):
    key: str
    label: str
    provider: str
    available: bool  # whether the provider's API key is configured


class ModelsResponse(BaseModel):
    default: str
    override_allowed: bool
    models: list[ModelInfo]
