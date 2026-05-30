import { getProducts, type ProductQuery } from "@/lib/catalog";
import { ProductGrid } from "./product-grid";
import { ShopControls } from "./shop-controls";
import { Pagination } from "./pagination";
import { SectionLabel } from "./section-label";

interface Props {
  index: string;
  eyebrow: string;
  title: string;
  description?: string | null;
  query: ProductQuery;
  basePath: string;
  rawParams: Record<string, string>;
}

export async function ProductListing({
  index,
  eyebrow,
  title,
  description,
  query,
  basePath,
  rawParams,
}: Props) {
  const data = await getProducts(query);

  function makeHref(page: number): string {
    const params = new URLSearchParams(rawParams);
    if (page <= 1) params.delete("page");
    else params.set("page", String(page));
    const qs = params.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  }

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-14">
      <SectionLabel index={index}>{eyebrow}</SectionLabel>
      <h1 className="mt-4 font-display text-5xl text-ink sm:text-6xl">{title}</h1>
      {description && (
        <p className="mt-3 max-w-xl text-ink-soft">{description}</p>
      )}

      <div className="mt-8">
        <ShopControls total={data.total} />
      </div>
      <div className="mt-12">
        <ProductGrid products={data.items} />
      </div>
      <Pagination page={data.page} pages={data.pages} makeHref={makeHref} />
    </div>
  );
}

/** Normalize Next's searchParams into a flat string record + a ProductQuery. */
export function parseListingParams(
  raw: Record<string, string | string[] | undefined>,
): { rawParams: Record<string, string>; query: ProductQuery } {
  const flat: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string") flat[key] = value;
    else if (Array.isArray(value) && value[0]) flat[key] = value[0];
  }

  const query: ProductQuery = {
    search: flat.search,
    brand: flat.brand,
    size: flat.size,
    color: flat.color,
    sort: (flat.sort as ProductQuery["sort"]) || undefined,
    min_price: flat.min_price ? Number(flat.min_price) : undefined,
    max_price: flat.max_price ? Number(flat.max_price) : undefined,
    page: flat.page ? Number(flat.page) : undefined,
  };

  return { rawParams: flat, query };
}
