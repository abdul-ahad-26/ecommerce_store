import type { MetadataRoute } from "next";
import { getCategories, getProducts } from "@/lib/catalog";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/shop`, changeFrequency: "daily", priority: 0.9 },
  ];

  try {
    const [categories, products] = await Promise.all([
      getCategories(),
      getProducts({ page_size: 60 }),
    ]);

    const categoryRoutes: MetadataRoute.Sitemap = categories.map((c) => ({
      url: `${SITE_URL}/category/${c.slug}`,
      changeFrequency: "weekly",
      priority: 0.7,
    }));

    const productRoutes: MetadataRoute.Sitemap = products.items.map((p) => ({
      url: `${SITE_URL}/product/${p.slug}`,
      changeFrequency: "weekly",
      priority: 0.6,
    }));

    return [...staticRoutes, ...categoryRoutes, ...productRoutes];
  } catch {
    // Backend unreachable at build time — ship the static routes at least.
    return staticRoutes;
  }
}
