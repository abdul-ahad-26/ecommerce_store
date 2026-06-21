"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { ProductDetail, ProductVariant } from "@/lib/catalog";
import { formatPKR } from "@/lib/format";
import { useCart } from "@/store/cart";
import { Motif } from "./motif";
import { ShareButton } from "./share-button";

function variantLabel(v: ProductVariant): string {
  return [v.size, v.color].filter(Boolean).join(" · ");
}

export function ProductView({ product }: { product: ProductDetail }) {
  const addItem = useCart((s) => s.addItem);

  const sizes = useMemo(
    () => [...new Set(product.variants.map((v) => v.size).filter(Boolean))],
    [product.variants],
  ) as string[];
  const colors = useMemo(() => {
    const seen = new Map<string, string | null>();
    for (const v of product.variants) {
      if (v.color && !seen.has(v.color)) seen.set(v.color, v.color_hex);
    }
    return [...seen.entries()].map(([name, hex]) => ({ name, hex }));
  }, [product.variants]);

  const firstInStock =
    product.variants.find((v) => v.in_stock) ?? product.variants[0];

  const [size, setSize] = useState<string | null>(firstInStock?.size ?? null);
  const [color, setColor] = useState<string | null>(
    firstInStock?.color ?? null,
  );
  const [qty, setQty] = useState(1);
  const [imageIndex, setImageIndex] = useState(0);
  const [added, setAdded] = useState(false);

  const variant = useMemo(
    () =>
      product.variants.find(
        (v) =>
          (sizes.length === 0 || v.size === size) &&
          (colors.length === 0 || v.color === color),
      ) ?? null,
    [product.variants, sizes.length, colors.length, size, color],
  );

  const price = variant ? variant.price : product.price;
  const canAdd = variant !== null && variant.in_stock;

  // Never let the shopper pick more than is in stock — checkout would reject it.
  const maxQty = variant && variant.in_stock ? variant.stock_qty : 1;
  const lowStock = variant?.in_stock && variant.stock_qty <= 5;

  // Re-clamp quantity when the selected variant (and its stock) changes.
  useEffect(() => {
    setQty((q) => Math.min(Math.max(1, q), Math.max(1, maxQty)));
  }, [maxQty]);

  function handleAdd() {
    if (!variant) return;
    addItem(
      {
        variantId: variant.id,
        productSlug: product.slug,
        productName: product.name,
        variantLabel: variantLabel(variant) || null,
        unitPrice: Number(variant.price),
        image: product.images[0]?.url ?? null,
        maxQty: variant.stock_qty,
      },
      qty,
    );
    setAdded(true);
    setTimeout(() => setAdded(false), 2500);
  }

  return (
    <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
      {/* Gallery */}
      <div className="flex flex-col-reverse gap-4 sm:flex-row">
        {product.images.length > 1 && (
          <div className="flex gap-3 sm:flex-col">
            {product.images.map((img, i) => (
              <button
                key={img.id}
                onClick={() => setImageIndex(i)}
                className={`relative aspect-[3/4] w-16 overflow-hidden border transition-colors ${
                  i === imageIndex
                    ? "border-madder"
                    : "border-ink/10 hover:border-ink/30"
                }`}
                aria-label={`View image ${i + 1}`}
              >
                <Image
                  src={img.url}
                  alt={img.alt ?? product.name}
                  fill
                  sizes="64px"
                  className="object-cover"
                />
              </button>
            ))}
          </div>
        )}
        <div className="relative aspect-[3/4] flex-1 overflow-hidden bg-paper-deep">
          {product.images[imageIndex] ? (
            <Image
              src={product.images[imageIndex].url}
              alt={product.images[imageIndex].alt ?? product.name}
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <Motif className="h-24 w-24 text-gold" />
            </div>
          )}
          <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-ink/10" />
        </div>
      </div>

      {/* Details */}
      <div className="lg:py-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            {product.brand && <p className="eyebrow">{product.brand}</p>}
            <h1 className="mt-3 font-display text-4xl leading-tight text-ink sm:text-5xl">
              {product.name}
            </h1>
          </div>
          <ShareButton path={`/product/${product.slug}`} title={product.name} />
        </div>

        <div className="mt-4 flex items-baseline gap-3">
          <span className="text-2xl font-medium text-ink">
            {formatPKR(price)}
          </span>
          {product.on_sale && (
            <span className="text-base text-ink-soft line-through">
              {formatPKR(product.base_price)}
            </span>
          )}
          {product.on_sale && (
            <span className="bg-madder px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-cream">
              Sale
            </span>
          )}
        </div>

        {(product.fabric || product.piece_count) && (
          <p className="mt-3 text-sm text-ink-soft">
            {[product.piece_count, product.fabric].filter(Boolean).join(" · ")}
          </p>
        )}

        <div className="rule-gold my-7" />

        {/* Color */}
        {colors.length > 0 && (
          <div className="mb-6">
            <p className="eyebrow mb-3 text-ink">
              Colour{color ? <span className="text-ink-soft"> — {color}</span> : null}
            </p>
            <div className="flex gap-2.5">
              {colors.map((c) => (
                <button
                  key={c.name}
                  onClick={() => setColor(c.name)}
                  title={c.name}
                  aria-label={c.name}
                  className={`h-8 w-8 rounded-full ring-1 ring-ink/15 transition-transform ${
                    color === c.name
                      ? "ring-2 ring-madder ring-offset-2 ring-offset-paper"
                      : "hover:scale-110"
                  }`}
                  style={{ backgroundColor: c.hex ?? "#ccc" }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Size */}
        {sizes.length > 0 && (
          <div className="mb-6">
            <p className="eyebrow mb-3 text-ink">Size</p>
            <div className="flex flex-wrap gap-2.5">
              {sizes.map((s) => {
                const selected = size === s;
                return (
                  <button
                    key={s}
                    onClick={() => setSize(s)}
                    className={`min-w-12 border px-4 py-2.5 text-sm transition-colors ${
                      selected
                        ? "border-ink bg-ink text-cream"
                        : "border-ink/20 text-ink hover:border-ink"
                    }`}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Quantity + Add */}
        <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center border border-ink/20">
            <button
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              className="px-4 py-3 text-lg leading-none hover:text-madder"
              aria-label="Decrease quantity"
            >
              −
            </button>
            <span className="w-10 text-center text-sm tabular-nums">{qty}</span>
            <button
              onClick={() => setQty((q) => Math.min(maxQty, q + 1))}
              disabled={qty >= maxQty}
              className="px-4 py-3 text-lg leading-none hover:text-madder disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:text-ink"
              aria-label="Increase quantity"
            >
              +
            </button>
          </div>

          <button
            onClick={handleAdd}
            disabled={!canAdd}
            className="btn-ink flex-1 disabled:cursor-not-allowed disabled:bg-ink-soft/40"
          >
            {added ? "Added to Bag ✓" : canAdd ? "Add to Bag" : "Sold Out"}
          </button>
        </div>

        {lowStock && (
          <p className="mt-3 text-sm text-madder">
            Only {variant!.stock_qty} left
          </p>
        )}

        {added && (
          <p className="mt-3 text-sm text-sage">
            Added to your bag.{" "}
            <Link href="/cart" className="font-semibold underline">
              View bag
            </Link>
          </p>
        )}

        {product.description && (
          <div className="mt-9">
            <p className="eyebrow mb-3 text-ink">Details</p>
            <p className="text-sm leading-relaxed text-ink-soft">
              {product.description}
            </p>
          </div>
        )}

        <div className="mt-8 flex items-center gap-3 border-t border-ink/10 pt-6 text-xs uppercase tracking-[0.14em] text-ink-soft">
          <Motif className="h-5 w-5 text-gold" />
          Cash on Delivery available nationwide
        </div>
      </div>
    </div>
  );
}
