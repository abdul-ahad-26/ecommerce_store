"use client";

/**
 * Client-side cart, persisted to localStorage (Zustand).
 *
 * Items are keyed by variantId. Prices are stored as numbers (PKR). The cart is
 * re-validated against the backend at checkout (Phase 3); this store is the
 * source of truth for what the shopper has selected.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface CartItem {
  variantId: number;
  productSlug: string;
  productName: string;
  variantLabel: string | null;
  unitPrice: number;
  image: string | null;
  qty: number;
  // Available stock at add-time — a soft cap so the qty steppers can't exceed
  // stock. Checkout still re-validates against the live DB (authoritative).
  maxQty?: number;
}

interface CartState {
  items: CartItem[];
  addItem: (item: Omit<CartItem, "qty">, qty?: number) => void;
  setQty: (variantId: number, qty: number) => void;
  removeItem: (variantId: number) => void;
  clear: () => void;
}

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      addItem: (item, qty = 1) =>
        set((state) => {
          const existing = state.items.find(
            (i) => i.variantId === item.variantId,
          );
          if (existing) {
            // Refresh the snapshot (price/maxQty) and cap the merged quantity.
            const max = item.maxQty ?? existing.maxQty ?? Infinity;
            return {
              items: state.items.map((i) =>
                i.variantId === item.variantId
                  ? { ...i, ...item, qty: Math.min(i.qty + qty, max) }
                  : i,
              ),
            };
          }
          const cap = item.maxQty ?? Infinity;
          return { items: [...state.items, { ...item, qty: Math.min(qty, cap) }] };
        }),
      setQty: (variantId, qty) =>
        set((state) => ({
          items:
            qty <= 0
              ? state.items.filter((i) => i.variantId !== variantId)
              : state.items.map((i) =>
                  i.variantId === variantId
                    ? { ...i, qty: i.maxQty ? Math.min(qty, i.maxQty) : qty }
                    : i,
                ),
        })),
      removeItem: (variantId) =>
        set((state) => ({
          items: state.items.filter((i) => i.variantId !== variantId),
        })),
      clear: () => set({ items: [] }),
    }),
    { name: "meher-cart" },
  ),
);

/** Total item count (sum of quantities). */
export const selectCount = (s: CartState) =>
  s.items.reduce((n, i) => n + i.qty, 0);

/** Subtotal in PKR. */
export const selectSubtotal = (s: CartState) =>
  s.items.reduce((sum, i) => sum + i.unitPrice * i.qty, 0);
