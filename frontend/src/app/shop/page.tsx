import type { Metadata } from "next";
import {
  ProductListing,
  parseListingParams,
} from "@/components/product-listing";

export const metadata: Metadata = {
  title: "Shop All",
  description: "Browse all Pakistani women's wear — lawn, stitched and unstitched.",
};

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { rawParams, query } = parseListingParams(await searchParams);

  return (
    <ProductListing
      index="—"
      eyebrow="The Edit"
      title="Shop All"
      description="Every piece in the collection, in one place."
      query={query}
      basePath="/shop"
      rawParams={rawParams}
    />
  );
}
