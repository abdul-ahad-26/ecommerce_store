import type { ProductListItem } from "@/lib/catalog";
import { ProductCard } from "./product-card";

export function ProductGrid({ products }: { products: ProductListItem[] }) {
  if (products.length === 0) {
    return (
      <div className="py-24 text-center">
        <p className="font-display text-2xl text-ink">Nothing here yet.</p>
        <p className="mt-2 text-sm text-ink-soft">
          Try adjusting your filters or explore another collection.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-x-5 gap-y-12 lg:grid-cols-3 xl:grid-cols-4">
      {products.map((product, i) => (
        <div
          key={product.id}
          className="reveal"
          style={{ animationDelay: `${Math.min(i * 60, 480)}ms` }}
        >
          <ProductCard product={product} priority={i < 4} />
        </div>
      ))}
    </div>
  );
}
