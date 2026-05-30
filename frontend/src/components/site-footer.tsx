import Link from "next/link";
import { Motif } from "./motif";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-ink/10 bg-paper-deep">
      <div className="mx-auto max-w-[1400px] px-6 py-16">
        <div className="grid gap-12 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-3">
              <span className="font-display text-3xl text-ink">Meher</span>
              <span className="urdu text-xl text-madder">مہر</span>
            </div>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-ink-soft">
              Premium Pakistani women&apos;s wear — lawn, stitched and unstitched
              shalwar kameez, crafted in the spirit of grace.
            </p>
            <Motif className="mt-6 h-10 w-10 text-gold" />
          </div>

          <FooterCol title="Shop">
            <FooterLink href="/shop">All Pieces</FooterLink>
            <FooterLink href="/category/lawn">Lawn</FooterLink>
            <FooterLink href="/category/stitched">Stitched</FooterLink>
            <FooterLink href="/category/unstitched">Unstitched</FooterLink>
          </FooterCol>

          <FooterCol title="Help">
            <FooterLink href="/shipping">Shipping &amp; COD</FooterLink>
            <FooterLink href="/returns">Returns</FooterLink>
            <FooterLink href="/sizing">Size Guide</FooterLink>
            <FooterLink href="/contact">Contact</FooterLink>
          </FooterCol>

          <FooterCol title="Account">
            <FooterLink href="/account">My Orders</FooterLink>
            <FooterLink href="/login">Sign In</FooterLink>
            <FooterLink href="/register">Register</FooterLink>
          </FooterCol>
        </div>

        <div className="rule-gold mt-14" />
        <div className="mt-6 flex flex-col items-center justify-between gap-3 text-xs tracking-wide text-ink-soft sm:flex-row">
          <p>© {new Date().getFullYear()} Meher. Made in Pakistan.</p>
          <p className="uppercase tracking-[0.18em]">
            Cash on Delivery · Nationwide
          </p>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h4 className="eyebrow mb-4 text-ink">{title}</h4>
      <ul className="space-y-2.5 text-sm text-ink-soft">{children}</ul>
    </div>
  );
}

function FooterLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <li>
      <Link href={href} className="hover:text-madder transition-colors">
        {children}
      </Link>
    </li>
  );
}
