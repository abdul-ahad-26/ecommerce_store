import Link from "next/link";
import Image from "next/image";
import { getProducts, type ProductListItem } from "@/lib/catalog";
import { ProductGrid } from "@/components/product-grid";
import { SectionLabel } from "@/components/section-label";
import { Motif } from "@/components/motif";

const COLLECTIONS = [
  { slug: "lawn", name: "Lawn", note: "Breathable everyday elegance" },
  { slug: "stitched", name: "Stitched", note: "Ready to wear, ready to shine" },
  { slug: "unstitched", name: "Unstitched", note: "Tailored to your story" },
];

async function getFeatured(): Promise<ProductListItem[]> {
  try {
    const res = await getProducts({ sort: "newest", page_size: 8 });
    return res.items;
  } catch {
    return [];
  }
}

export default async function Home() {
  const featured = await getFeatured();
  const heroImage = featured.find((p) => p.primary_image)?.primary_image;

  return (
    <>
      {/* ---------------- HERO ---------------- */}
      <section className="mx-auto grid max-w-[1400px] items-center gap-10 px-6 py-16 md:grid-cols-[1.15fr_0.85fr] md:py-24">
        <div>
          <div className="reveal" style={{ animationDelay: "60ms" }}>
            <SectionLabel index="—">Spring / Summer Edit</SectionLabel>
          </div>
          <h1
            className="reveal mt-6 font-display text-5xl leading-[1.05] tracking-tight text-ink sm:text-6xl lg:text-7xl"
            style={{ animationDelay: "160ms" }}
          >
            Grace, woven
            <br />
            into every
            <span className="italic text-madder"> thread.</span>
          </h1>
          <p
            className="reveal mt-6 max-w-md text-base leading-relaxed text-ink-soft"
            style={{ animationDelay: "260ms" }}
          >
            Lawn, stitched and unstitched shalwar kameez for the modern
            Pakistani woman — crafted with heritage, delivered to your door.
          </p>
          <div
            className="reveal mt-9 flex items-center gap-5"
            style={{ animationDelay: "360ms" }}
          >
            <Link href="/shop" className="btn-ink">
              Explore the Collection
            </Link>
            <span className="urdu text-2xl text-gold">مہر</span>
          </div>
        </div>

        {/* Hero visual */}
        <div
          className="reveal relative aspect-[4/5] overflow-hidden bg-paper-deep"
          style={{ animationDelay: "240ms" }}
        >
          {heroImage ? (
            <Image
              src={heroImage}
              alt="Featured piece from the collection"
              fill
              priority
              sizes="(max-width: 768px) 100vw, 40vw"
              className="object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <Motif className="h-24 w-24 text-gold" />
            </div>
          )}
          <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-ink/10" />
          <span className="absolute bottom-4 left-4 bg-paper/85 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-ink backdrop-blur">
            New In
          </span>
        </div>
      </section>

      <div className="mx-auto max-w-[1400px] px-6">
        <div className="rule-gold" />
      </div>

      {/* ---------------- COLLECTIONS ---------------- */}
      <section className="mx-auto max-w-[1400px] px-6 py-20">
        <SectionLabel index="01">The Collections</SectionLabel>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {COLLECTIONS.map((c, i) => (
            <Link
              key={c.slug}
              href={`/category/${c.slug}`}
              className="reveal group relative flex aspect-[4/3] flex-col justify-between overflow-hidden border border-ink/10 bg-cream p-7 transition-colors hover:border-madder/40"
              style={{ animationDelay: `${120 + i * 100}ms` }}
            >
              <Motif className="h-9 w-9 text-gold transition-transform duration-500 group-hover:rotate-12" />
              <div>
                <h3 className="font-display text-4xl text-ink">{c.name}</h3>
                <p className="mt-1 text-sm text-ink-soft">{c.note}</p>
                <span className="mt-4 inline-block text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-madder">
                  Shop now →
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ---------------- FEATURED ---------------- */}
      <section className="mx-auto max-w-[1400px] px-6 pb-20">
        <div className="flex items-end justify-between">
          <SectionLabel index="02">New Arrivals</SectionLabel>
          <Link
            href="/shop"
            className="hidden text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-ink hover:text-madder sm:inline"
          >
            View all →
          </Link>
        </div>
        <div className="mt-10">
          <ProductGrid products={featured} />
        </div>
      </section>

      {/* ---------------- HERITAGE STRIP ---------------- */}
      <section className="bg-ink text-cream">
        <div className="mx-auto grid max-w-[1400px] items-center gap-8 px-6 py-20 md:grid-cols-[0.7fr_1.3fr]">
          <div className="flex items-center gap-4">
            <Motif className="h-14 w-14 text-gold-soft" />
            <span className="urdu text-4xl text-gold-soft">مہر</span>
          </div>
          <div>
            <p className="eyebrow text-gold-soft">03 — The Craft</p>
            <p className="mt-4 font-display text-3xl leading-snug sm:text-4xl">
              Every piece carries the quiet artistry of Pakistani textile —
              block prints, fine embroidery, and fabric that breathes.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
