import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getProduct,
  getProducts,
  type ProductDetail,
  type ProductListItem,
} from "@/lib/catalog";
import { ProductView } from "@/components/product-view";
import { ProductGrid } from "@/components/product-grid";
import { SectionLabel } from "@/components/section-label";

async function loadProduct(slug: string): Promise<ProductDetail | null> {
  try {
    return await getProduct(slug);
  } catch {
    return null;
  }
}

// Same-category pieces, excluding the one being viewed.
async function loadSimilar(
  categorySlug: string,
  currentSlug: string,
): Promise<ProductListItem[]> {
  try {
    const res = await getProducts({ category: categorySlug, page_size: 5 });
    return res.items.filter((p) => p.slug !== currentSlug).slice(0, 4);
  } catch {
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await loadProduct(slug);
  if (!product) return { title: "Product" };

  const description =
    product.description ?? `${product.name} — available at Meher.`;
  const image = product.images[0]?.url;

  return {
    title: product.name,
    description,
    openGraph: {
      title: product.name,
      description,
      url: `/product/${product.slug}`,
      type: "website",
      ...(image ? { images: [{ url: image }] } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: product.name,
      description,
      ...(image ? { images: [image] } : {}),
    },
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await loadProduct(slug);
  if (!product) notFound();

  const similar = await loadSimilar(product.category.slug, product.slug);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description ?? undefined,
    image: product.images.map((i) => i.url),
    brand: product.brand
      ? { "@type": "Brand", name: product.brand }
      : undefined,
    category: product.category.name,
    offers: {
      "@type": "Offer",
      url: `${siteUrl}/product/${product.slug}`,
      priceCurrency: "PKR",
      price: Number(product.price),
      availability: product.in_stock
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
    },
  };

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* Breadcrumb */}
      <nav className="mb-8 flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-ink-soft">
        <Link href="/" className="hover:text-madder">
          Home
        </Link>
        <span className="text-gold">/</span>
        <Link
          href={`/category/${product.category.slug}`}
          className="hover:text-madder"
        >
          {product.category.name}
        </Link>
        <span className="text-gold">/</span>
        <span className="text-ink">{product.name}</span>
      </nav>

      <ProductView product={product} />

      {similar.length > 0 && (
        <section className="mt-24">
          <SectionLabel index="—">You may also like</SectionLabel>
          <div className="mt-10">
            <ProductGrid products={similar} />
          </div>
        </section>
      )}
    </div>
  );
}
