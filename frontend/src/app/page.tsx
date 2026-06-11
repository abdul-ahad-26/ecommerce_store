import Image from "next/image";
import Link from "next/link";
import {
  getCategories,
  getProducts,
  type ProductListItem,
} from "@/lib/catalog";
import { ProductGrid } from "@/components/product-grid";
import { SectionLabel } from "@/components/section-label";
import { Motif } from "@/components/motif";
import {
  CodIcon,
  ShippingIcon,
  ReturnsIcon,
  CraftIcon,
} from "@/components/assurance-icons";
import { HeroCarousel, type HeroSlide } from "@/components/hero-carousel";
import { CONTACT } from "@/lib/site";
import { TESTIMONIALS } from "@/data/testimonials";
import { formatPKR } from "@/lib/format";

const COLLECTIONS = [
  { slug: "lawn", name: "Lawn", note: "Breathable everyday elegance" },
  { slug: "stitched", name: "Stitched", note: "Ready to wear, ready to shine" },
  { slug: "unstitched", name: "Unstitched", note: "Tailored to your story" },
];

const ASSURANCES = [
  { title: "Cash on Delivery", note: "Pay when it arrives — nationwide", Icon: CodIcon },
  { title: "Free Shipping", note: "On orders over Rs 5,000", Icon: ShippingIcon },
  { title: "7-Day Returns", note: "Easy exchanges & returns", Icon: ReturnsIcon },
  { title: "Crafted in Pakistan", note: "Heritage textile, made with care", Icon: CraftIcon },
];

async function getFeatured(): Promise<ProductListItem[]> {
  try {
    const res = await getProducts({ sort: "newest", page_size: 8 });
    return res.items;
  } catch {
    return [];
  }
}

/**
 * One image per collection card: the category's own image if the admin set
 * one, else the first featured product from that category, else one targeted
 * product fetch, else null (motif fallback card).
 */
async function getCollectionImages(
  featured: ProductListItem[],
): Promise<Record<string, string | null>> {
  const categories = await getCategories().catch(() => []);
  const images: Record<string, string | null> = {};

  for (const c of COLLECTIONS) {
    images[c.slug] =
      categories.find((cat) => cat.slug === c.slug)?.image_url ??
      featured.find((p) => p.category_slug === c.slug && p.primary_image)
        ?.primary_image ??
      null;
  }

  await Promise.all(
    COLLECTIONS.filter((c) => !images[c.slug]).map(async (c) => {
      try {
        const res = await getProducts({ category: c.slug, page_size: 1 });
        images[c.slug] = res.items[0]?.primary_image ?? null;
      } catch {
        // keep null — card falls back to the motif treatment
      }
    }),
  );

  return images;
}

export default async function Home() {
  const featured = await getFeatured();
  const collectionImages = await getCollectionImages(featured);
  const heroSlides: HeroSlide[] = featured
    .filter((p) => p.primary_image)
    .slice(0, 5)
    .map((p) => ({
      image: p.primary_image as string,
      name: p.name,
      slug: p.slug,
      price: formatPKR(p.price),
    }));

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

        {/* Hero visual — rotating featured pieces */}
        {heroSlides.length > 0 ? (
          <HeroCarousel slides={heroSlides} />
        ) : (
          <div
            className="reveal relative flex aspect-[4/5] items-center justify-center overflow-hidden bg-paper-deep"
            style={{ animationDelay: "240ms" }}
          >
            <Motif className="h-24 w-24 text-gold" />
            <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-ink/10" />
          </div>
        )}
      </section>

      {/* ---------------- ASSURANCES ---------------- */}
      <section className="mx-auto max-w-[1400px] px-6">
        <div className="grid grid-cols-2 gap-px border border-ink/10 bg-ink/10 lg:grid-cols-4">
          {ASSURANCES.map(({ title, note, Icon }) => (
            <div key={title} className="bg-cream px-6 py-7 text-center">
              <Icon className="mx-auto h-8 w-8 text-gold" />
              <p className="mt-3 font-display text-lg text-ink">{title}</p>
              <p className="mt-1 text-xs text-ink-soft">{note}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="mx-auto max-w-[1400px] px-6">
        <div className="rule-gold mt-16" />
      </div>

      {/* ---------------- COLLECTIONS ---------------- */}
      <section className="mx-auto max-w-[1400px] px-6 py-20">
        <SectionLabel index="01">The Collections</SectionLabel>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {COLLECTIONS.map((c, i) => {
            const img = collectionImages[c.slug];
            return img ? (
              // Photo card — category imagery with an editorial overlay.
              <Link
                key={c.slug}
                href={`/category/${c.slug}`}
                className="reveal group relative flex aspect-[4/3] flex-col justify-end overflow-hidden border border-ink/10"
                style={{ animationDelay: `${120 + i * 100}ms` }}
              >
                <Image
                  src={img}
                  alt={`${c.name} collection`}
                  fill
                  sizes="(max-width: 768px) 100vw, 33vw"
                  className="object-cover transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-ink/75 via-ink/25 to-transparent" />
                <div className="relative p-7">
                  <h3 className="font-display text-4xl text-cream">{c.name}</h3>
                  <p className="mt-1 text-sm text-cream/85">{c.note}</p>
                  <span className="mt-4 inline-block text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-gold-soft">
                    Shop now →
                  </span>
                </div>
              </Link>
            ) : (
              // Fallback when no imagery exists yet for the category.
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
            );
          })}
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

      {/* ---------------- TESTIMONIALS (only when real quotes exist) ---------------- */}
      {TESTIMONIALS.length > 0 && (
        <section className="mx-auto max-w-[1400px] px-6 py-20">
          <SectionLabel index="04">What our customers say</SectionLabel>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {TESTIMONIALS.map((t) => (
              <figure
                key={t.name}
                className="flex flex-col justify-between border border-ink/10 bg-cream p-7"
              >
                <blockquote className="font-display text-xl leading-snug text-ink">
                  “{t.quote}”
                </blockquote>
                <figcaption className="mt-6 text-sm text-ink-soft">
                  <span className="font-semibold text-ink">{t.name}</span> ·{" "}
                  {t.city}
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}

      {/* ---------------- SOCIAL CTA ---------------- */}
      {/* Instagram-first: WhatsApp/email live in the footer on every page, so
          this band only earns its place when there's a feed to follow.
          No bottom padding — the footer's mt-24 already provides the gap. */}
      {CONTACT.instagramUrl && (
        <section className="mx-auto max-w-[1400px] px-6 pt-4">
          <div className="flex flex-col items-center gap-5 border border-gold/40 bg-paper-deep px-6 py-14 text-center">
            <Motif className="h-10 w-10 text-gold" />
            <h2 className="font-display text-3xl text-ink sm:text-4xl">
              Follow our journey
            </h2>
            <p className="max-w-md text-sm text-ink-soft">
              New arrivals, styling notes and behind-the-scenes from the
              atelier.
            </p>
            <a
              href={CONTACT.instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-ink"
            >
              Follow on Instagram
            </a>
          </div>
        </section>
      )}
    </>
  );
}
