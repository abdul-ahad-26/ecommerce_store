"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Category } from "@/lib/catalog";
import { selectCount, useCart } from "@/store/cart";
import { useAuth } from "@/store/auth";

const STATIC_LINKS = [
  { href: "/shop", label: "Shop All" },
];

function BagIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 7h12l1 13H5L6 7Z M9 7V5a3 3 0 0 1 6 0v2"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="6.4" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M15.8 15.8 20 20"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="8" r="3.4" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function SiteHeader({ categories = [] }: { categories?: Category[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const navCategories = categories.filter((c) => c.parent_id === null);

  // Global search — expands inline on desktop, lives in the menu on mobile.
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setSearchOpen(false);
    setOpen(false);
    setQuery("");
    router.push(`/shop?search=${encodeURIComponent(q)}`);
  }

  // Cart count — guarded so SSR (0) and first client render match before
  // localStorage hydrates.
  const count = useCart(selectCount);
  const isAdmin = useAuth((s) => s.user?.role === "admin");
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <header className="sticky top-0 z-50">
      {/* Announcement bar */}
      <div className="bg-ink text-cream">
        <div className="mx-auto flex max-w-[1400px] items-center justify-center gap-2 px-4 py-2 text-center text-[0.7rem] font-medium tracking-[0.14em] uppercase">
          <span className="urdu text-gold-soft text-sm">مہر</span>
          <span className="hidden sm:inline">
            Cash on Delivery across Pakistan
          </span>
          <span className="text-gold">·</span>
          <span>Free shipping over Rs 5,000</span>
        </div>
      </div>

      {/* Main bar */}
      <div className="border-b border-ink/10 bg-paper/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-4 py-4 sm:px-6">
          {/* Mobile menu toggle */}
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex flex-col gap-[5px] p-1 md:hidden"
            aria-label="Toggle menu"
            aria-expanded={open}
          >
            <span className="h-px w-6 bg-ink" />
            <span className="h-px w-6 bg-ink" />
            <span className="h-px w-6 bg-ink" />
          </button>

          {/* Desktop nav (left) */}
          <nav className="hidden items-center gap-7 text-[0.78rem] font-semibold uppercase tracking-[0.14em] md:flex md:flex-1">
            {STATIC_LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="hover:text-madder transition-colors">
                {l.label}
              </Link>
            ))}
            {navCategories.map((c) => (
              <Link
                key={c.id}
                href={`/category/${c.slug}`}
                className="hover:text-madder transition-colors"
              >
                {c.name}
              </Link>
            ))}
          </nav>

          {/* Brand mark (center) */}
          <Link href="/" className="flex flex-col items-center leading-none">
            <span className="font-display text-2xl tracking-tight text-ink sm:text-3xl">
              Meher
            </span>
            <span className="urdu -mt-1 text-sm text-madder">مہر</span>
          </Link>

          {/* Icons (right) */}
          <div className="flex flex-1 items-center justify-end gap-4">
            {searchOpen ? (
              <form onSubmit={submitSearch} className="hidden items-center gap-2 md:flex">
                <input
                  ref={searchRef}
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Escape" && setSearchOpen(false)}
                  onBlur={() => !query && setSearchOpen(false)}
                  placeholder="Search pieces…"
                  className="w-44 border-b border-ink/30 bg-transparent pb-1 text-sm outline-none placeholder:text-ink-soft/60 focus:border-madder"
                  aria-label="Search products"
                />
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                aria-label="Search"
                className="hidden hover:text-madder transition-colors md:block"
              >
                <SearchIcon />
              </button>
            )}
            {mounted && isAdmin && (
              <Link
                href="/admin"
                className="hidden text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-madder hover:text-ink sm:inline"
              >
                Admin
              </Link>
            )}
            <Link
              href="/account"
              aria-label="Account"
              className="hover:text-madder transition-colors"
            >
              <UserIcon />
            </Link>
            <Link
              href="/cart"
              aria-label="Cart"
              className="relative hover:text-madder transition-colors"
            >
              <BagIcon />
              {mounted && count > 0 && (
                <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-madder px-1 text-[0.6rem] font-semibold text-cream tabular-nums">
                  {count}
                </span>
              )}
            </Link>
          </div>
        </div>

        {/* Mobile menu */}
        {open && (
          <nav className="border-t border-ink/10 px-6 py-4 md:hidden">
            <form onSubmit={submitSearch} className="mb-4 flex items-center gap-2">
              <SearchIcon />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search pieces…"
                className="flex-1 border-b border-ink/30 bg-transparent pb-1 text-sm outline-none placeholder:text-ink-soft/60 focus:border-madder"
                aria-label="Search products"
              />
            </form>
            <ul className="flex flex-col gap-3 text-sm font-semibold uppercase tracking-[0.14em]">
              {STATIC_LINKS.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} onClick={() => setOpen(false)}>
                    {l.label}
                  </Link>
                </li>
              ))}
              {navCategories.map((c) => (
                <li key={c.id}>
                  <Link href={`/category/${c.slug}`} onClick={() => setOpen(false)}>
                    {c.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </div>
    </header>
  );
}
