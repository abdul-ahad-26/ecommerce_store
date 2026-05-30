"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { selectSubtotal, useCart } from "@/store/cart";
import { formatPKR } from "@/lib/format";
import { SectionLabel } from "@/components/section-label";

export default function CartPage() {
  const items = useCart((s) => s.items);
  const setQty = useCart((s) => s.setQty);
  const removeItem = useCart((s) => s.removeItem);
  const subtotal = useCart(selectSubtotal);

  // Avoid SSR/client mismatch from persisted localStorage.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <div className="mx-auto max-w-[1400px] px-6 py-20" />;
  }

  return (
    <div className="mx-auto max-w-[1100px] px-6 py-14">
      <SectionLabel index="—">Your Selection</SectionLabel>
      <h1 className="mt-4 font-display text-5xl text-ink">Shopping Bag</h1>

      {items.length === 0 ? (
        <div className="py-20 text-center">
          <p className="font-display text-2xl text-ink">Your bag is empty.</p>
          <Link href="/shop" className="btn-ink mt-6">
            Browse the Collection
          </Link>
        </div>
      ) : (
        <div className="mt-10 grid gap-12 lg:grid-cols-[1.6fr_1fr]">
          {/* Items */}
          <ul className="divide-y divide-ink/10 border-y border-ink/10">
            {items.map((item) => (
              <li key={item.variantId} className="flex gap-4 py-5">
                <Link
                  href={`/product/${item.productSlug}`}
                  className="relative aspect-[3/4] w-20 shrink-0 overflow-hidden bg-paper-deep"
                >
                  {item.image && (
                    <Image
                      src={item.image}
                      alt={item.productName}
                      fill
                      sizes="80px"
                      className="object-cover"
                    />
                  )}
                </Link>

                <div className="flex flex-1 flex-col justify-between">
                  <div>
                    <Link
                      href={`/product/${item.productSlug}`}
                      className="font-display text-lg text-ink hover:text-madder"
                    >
                      {item.productName}
                    </Link>
                    {item.variantLabel && (
                      <p className="text-xs uppercase tracking-[0.12em] text-ink-soft">
                        {item.variantLabel}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex items-center border border-ink/20">
                      <button
                        onClick={() => setQty(item.variantId, item.qty - 1)}
                        className="px-3 py-1.5 hover:text-madder"
                        aria-label="Decrease quantity"
                      >
                        −
                      </button>
                      <span className="w-8 text-center text-sm tabular-nums">
                        {item.qty}
                      </span>
                      <button
                        onClick={() => setQty(item.variantId, item.qty + 1)}
                        className="px-3 py-1.5 hover:text-madder"
                        aria-label="Increase quantity"
                      >
                        +
                      </button>
                    </div>
                    <button
                      onClick={() => removeItem(item.variantId)}
                      className="text-xs uppercase tracking-[0.12em] text-ink-soft underline hover:text-madder"
                    >
                      Remove
                    </button>
                  </div>
                </div>

                <div className="text-right text-sm font-medium text-ink">
                  {formatPKR(item.unitPrice * item.qty)}
                </div>
              </li>
            ))}
          </ul>

          {/* Summary */}
          <aside className="h-fit border border-ink/10 bg-cream p-7">
            <h2 className="eyebrow text-ink">Order Summary</h2>
            <div className="mt-5 flex justify-between text-sm">
              <span className="text-ink-soft">Subtotal</span>
              <span className="font-medium text-ink">{formatPKR(subtotal)}</span>
            </div>
            <div className="mt-2 flex justify-between text-sm">
              <span className="text-ink-soft">Shipping</span>
              <span className="text-ink-soft">Calculated at checkout</span>
            </div>
            <div className="rule-gold my-5" />
            <Link
              href="/checkout"
              className="btn-ink w-full"
              aria-disabled
            >
              Proceed to Checkout
            </Link>
            <p className="mt-3 text-center text-xs text-ink-soft">
              Checkout &amp; Cash on Delivery arrive in the next release.
            </p>
          </aside>
        </div>
      )}
    </div>
  );
}
