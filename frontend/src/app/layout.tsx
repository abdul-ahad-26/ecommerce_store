import type { Metadata } from "next";
import { Fraunces, Hanken_Grotesk, Noto_Nastaliq_Urdu } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { getCategories, type Category } from "@/lib/catalog";

// Fetch nav categories without letting a backend hiccup break the whole site.
async function getNavCategories(): Promise<Category[]> {
  try {
    return await getCategories();
  } catch {
    return [];
  }
}

// Editorial display serif with optical sizing — the voice of the brand.
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  axes: ["opsz", "SOFT"],
  display: "swap",
});

// Clean, warm grotesque for body and UI.
const hanken = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

// Nastaliq Urdu for the bilingual brand mark and cultural accents.
const nastaliq = Noto_Nastaliq_Urdu({
  subsets: ["arabic"],
  variable: "--font-urdu",
  weight: ["400", "500", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  ),
  title: {
    default: "Meher — Pakistani Women's Wear",
    template: "%s · Meher",
  },
  description:
    "Meher (مہر) — premium Pakistani women's wear. Lawn, stitched & unstitched shalwar kameez. Cash on delivery across Pakistan.",
  openGraph: {
    title: "Meher — Pakistani Women's Wear",
    description:
      "Premium Pakistani women's wear — lawn, stitched & unstitched shalwar kameez. Cash on delivery across Pakistan.",
    type: "website",
    locale: "en_PK",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const categories = await getNavCategories();

  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${hanken.variable} ${nastaliq.variable} h-full`}
    >
      <body className="min-h-full flex flex-col bg-paper text-ink antialiased font-body">
        <Providers>
          <SiteHeader categories={categories} />
          <main className="flex-1">{children}</main>
          <SiteFooter />
        </Providers>
      </body>
    </html>
  );
}
