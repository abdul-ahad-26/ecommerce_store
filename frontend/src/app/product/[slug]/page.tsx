import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProduct, type ProductDetail } from "@/lib/catalog";
import { ProductView } from "@/components/product-view";

async function loadProduct(slug: string): Promise<ProductDetail | null> {
  try {
    return await getProduct(slug);
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
  const product = await loadProduct(slug);
  if (!product) return { title: "Product" };
  return {
    title: product.name,
    description:
      product.description ?? `${product.name} — available at Meher.`,
    openGraph: product.images[0]
      ? { images: [{ url: product.images[0].url }] }
      : undefined,
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
    </div>
  );
}
