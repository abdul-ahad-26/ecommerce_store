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
  label: string;
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
  };
}
