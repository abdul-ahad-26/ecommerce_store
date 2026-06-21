"""Pydantic schemas for the AI shopping assistant API."""

from typing import Literal

from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=4000)


class PageContext(BaseModel):
    """What the customer is looking at, so the assistant can resolve "this"."""

    path: str | None = None
    product_slug: str | None = None


class ChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(min_length=1, max_length=50)
    # Optional model key (dev only; honoured when ASSISTANT_ALLOW_MODEL_OVERRIDE).
    model: str | None = None
    page: PageContext | None = None
    # Client-generated id; groups a conversation's runs in tracing.
    conversation_id: str | None = Field(default=None, max_length=100)


class CartAction(BaseModel):
    action: Literal["add_to_cart"]
    variant_id: int
    slug: str
    product_name: str
    variant_label: str | None = None
    unit_price: float
    image: str | None = None
    qty: int
    available_qty: int  # stock at suggestion time; soft cap for cart steppers
    label: str  # display label, e.g. "Rose Lawn 3pc — S / Red"


class ProductCard(BaseModel):
    slug: str
    name: str
    price: float
    on_sale: bool
    image: str | None = None
    in_stock: bool
    # First in-stock variant for quick add (null if out of stock).
    variant_id: int | None = None
    variant_label: str | None = None
    unit_price: float | None = None
    available_qty: int | None = None


class ChatResponse(BaseModel):
    reply: str
    model: str  # the model key actually used
    cart_actions: list[CartAction] = []
    products: list[ProductCard] = []


class ModelInfo(BaseModel):
    key: str
    label: str
    provider: str
    available: bool  # whether the provider's API key is configured


class ModelsResponse(BaseModel):
    default: str
    override_allowed: bool
    models: list[ModelInfo]
