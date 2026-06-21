/**
 * Client types + helpers for the AI shopping assistant.
 *
 * The chat itself streams through the Vercel AI SDK transport (see
 * components/assistant-widget.tsx); this module holds the shared types, the
 * model-list fetch for the dev picker, and the cart-action → CartItem mapper.
 */

import { apiFetch } from "./api";
import type { CartItem } from "@/store/cart";

/** Structured cart suggestion the backend emits as a `data-cart-action` part.
 * The model never writes to the cart — the widget executes this on confirm. */
export interface CartActionData {
  action: "add_to_cart";
  variant_id: number;
  slug: string;
  product_name: string;
  variant_label: string | null;
  unit_price: number;
  image: string | null;
  qty: number;
  available_qty: number;
  label: string;
}

/** A product card the assistant emits as a `data-product` part. */
export interface ProductCardData {
  slug: string;
  name: string;
  price: number;
  on_sale: boolean;
  image: string | null;
  in_stock: boolean;
  // First in-stock variant, for quick add-to-cart (null if out of stock).
  variant_id: number | null;
  variant_label: string | null;
  unit_price: number | null;
  available_qty: number | null;
}

export interface AssistantModel {
  key: string;
  label: string;
  provider: string;
  available: boolean;
}

export interface ModelsResponse {
  default: string;
  override_allowed: boolean;
  models: AssistantModel[];
}

export function listModels(): Promise<ModelsResponse> {
  return apiFetch<ModelsResponse>("/assistant/models");
}

/** Map a cart-action part to the cart store's item shape. */
export function cartActionToItem(a: CartActionData): Omit<CartItem, "qty"> {
  return {
    variantId: a.variant_id,
    productSlug: a.slug,
    productName: a.product_name,
    variantLabel: a.variant_label,
    unitPrice: a.unit_price,
    image: a.image,
    maxQty: a.available_qty,
  };
}

/** Map a product card's quick-add variant to a cart item (null if no variant). */
export function productCardToItem(
  p: ProductCardData,
): Omit<CartItem, "qty"> | null {
  if (p.variant_id == null || p.unit_price == null) return null;
  return {
    variantId: p.variant_id,
    productSlug: p.slug,
    productName: p.name,
    variantLabel: p.variant_label,
    unitPrice: p.unit_price,
    image: p.image,
    maxQty: p.available_qty ?? undefined,
  };
}
