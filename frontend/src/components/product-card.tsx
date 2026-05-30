import Image from "next/image";
import Link from "next/link";
import type { ProductListItem } from "@/lib/catalog";
import { formatPKR } from "@/lib/format";

export function ProductCard({
  product,
  priority = false,
}: {
  product: ProductListItem;
  priority?: boolean;
}) {
  return (
    <Link href={`/product/${product.slug}`} className="group block">
      <div className="relative aspect-[3/4] overflow-hidden bg-paper-deep">
        {product.primary_image ? (
          <Image
            src={product.primary_image}
            alt={product.name}
            fill
            priority={priority}
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-ink-soft/40 font-display text-2xl">
            Meher
          </div>
        )}

        {/* Corner flags */}
        {product.on_sale && (
          <span className="absolute left-0 top-4 bg-madder px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-cream">
            Sale
          </span>
        )}
        {!product.in_stock && (
          <span className="absolute inset-0 flex items-center justify-center bg-paper/70 text-xs font-semibold uppercase tracking-[0.18em] text-ink">
            Sold Out
          </span>
        )}

        {/* Hover reveal */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 translate-y-full bg-ink/90 py-3 text-center text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-cream transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-y-0">
          View Piece
        </div>
      </div>

      <div className="mt-4 space-y-1">
        {product.brand && (
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-madder">
            {product.brand}
          </p>
        )}
        <h3 className="font-display text-lg leading-snug text-ink">
          {product.name}
        </h3>
        <div className="flex items-baseline gap-2 pt-1">
          <span className="text-sm font-medium text-ink">
            {formatPKR(product.price)}
          </span>
          {product.on_sale && (
            <span className="text-xs text-ink-soft line-through">
              {formatPKR(product.base_price)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
