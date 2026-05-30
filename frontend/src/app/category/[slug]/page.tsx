import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCategory, type Category } from "@/lib/catalog";
import {
  ProductListing,
  parseListingParams,
} from "@/components/product-listing";

async function loadCategory(slug: string): Promise<Category | null> {
  try {
    return await getCategory(slug);
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const category = await loadCategory(slug);
  if (!category) return { title: "Collection" };
  return {
    title: category.name,
    description: category.description ?? `Shop ${category.name} at Meher.`,
  };
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const category = await loadCategory(slug);
  if (!category) notFound();

  const { rawParams, query } = parseListingParams(await searchParams);

  return (
    <ProductListing
      index="01"
      eyebrow="Collection"
      title={category.name}
      description={category.description}
      query={{ ...query, category: slug }}
      basePath={`/category/${slug}`}
      rawParams={rawParams}
    />
  );
}
