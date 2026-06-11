"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/store/auth";

const NAV = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/categories", label: "Categories" },
  { href: "/admin/orders", label: "Orders" },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const status = useAuth((s) => s.status);
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);

  const isAdmin = status === "authenticated" && user?.role === "admin";

  async function handleSignOut() {
    await logout();
    router.replace("/login");
  }

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login?next=/admin");
    } else if (status === "authenticated" && user?.role !== "admin") {
      router.replace("/");
    }
  }, [status, user, router]);

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-[1200px] px-6 py-24 text-center text-ink-soft">
        Checking access…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-10">
      <div className="flex items-center justify-between border-b border-ink/10 pb-5">
        <Link href="/admin" className="flex items-baseline gap-3">
          <span className="font-display text-2xl text-ink">Meher</span>
          <span className="eyebrow text-madder">Admin</span>
        </Link>
        {/* Visual hierarchy: muted identity → quiet nav link → explicit action */}
        <div className="flex items-center gap-5">
          {user?.full_name && (
            <span className="hidden sm:inline text-sm text-ink-soft/70">
              {user.full_name}
            </span>
          )}
          <Link
            href="/"
            className="text-xs font-semibold uppercase tracking-[0.14em] text-ink hover:text-madder"
          >
            View store →
          </Link>
          <button
            type="button"
            onClick={handleSignOut}
            className="border border-ink/25 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-ink transition-colors hover:border-madder hover:text-madder"
          >
            Sign out
          </button>
        </div>
      </div>

      <nav className="mt-5 flex flex-wrap gap-1">
        {NAV.map((item) => {
          const active =
            item.href === "/admin"
              ? pathname === "/admin"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`px-4 py-2 text-sm font-semibold uppercase tracking-[0.12em] transition-colors ${
                active
                  ? "bg-ink text-cream"
                  : "text-ink-soft hover:text-madder"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-10">{children}</div>
    </div>
  );
}
