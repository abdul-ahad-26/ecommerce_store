"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { getStats } from "@/lib/admin";
import { formatPKR } from "@/lib/format";

export default function AdminDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "stats"],
    queryFn: getStats,
  });

  if (isLoading || !data) {
    return <p className="text-sm text-ink-soft">Loading dashboard…</p>;
  }

  const cards = [
    { label: "Revenue", value: formatPKR(data.revenue) },
    { label: "Total Orders", value: data.total_orders, href: "/admin/orders" },
    {
      label: "Pending Orders",
      value: data.pending_orders,
      alert: data.pending_orders > 0,
      href: "/admin/orders?status=pending",
    },
    {
      label: "Published Products",
      value: `${data.published_products} / ${data.total_products}`,
      href: "/admin/products",
    },
    {
      label: "Low Stock Variants",
      value: data.low_stock_variants,
      alert: data.low_stock_variants > 0,
      href: "/admin/products",
    },
  ];

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => {
          const body = (
            <>
              <p className="eyebrow text-ink-soft">{c.label}</p>
              <p
                className={`mt-2 font-display text-4xl ${
                  c.alert ? "text-madder" : "text-ink"
                }`}
              >
                {c.value}
              </p>
            </>
          );
          return c.href ? (
            <Link
              key={c.label}
              href={c.href}
              className="border border-ink/10 bg-cream p-6 transition-colors hover:border-madder/40"
            >
              {body}
            </Link>
          ) : (
            <div key={c.label} className="border border-ink/10 bg-cream p-6">
              {body}
            </div>
          );
        })}
      </div>

      <div className="mt-12">
        <div className="flex items-center justify-between">
          <h2 className="eyebrow text-ink">Recent Orders</h2>
          <Link
            href="/admin/orders"
            className="text-xs uppercase tracking-[0.12em] text-madder hover:underline"
          >
            View all →
          </Link>
        </div>

        {data.recent_orders.length === 0 ? (
          <p className="mt-4 text-sm text-ink-soft">No orders yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-ink/10 border-y border-ink/10">
            {data.recent_orders.map((o) => (
              <li key={o.order_number}>
                <Link
                  href={`/order/${o.order_number}`}
                  className="flex items-center justify-between py-3 text-sm transition-colors hover:text-madder"
                >
                  <span className="font-medium text-ink">{o.order_number}</span>
                  <span className="text-ink-soft">{o.customer_name}</span>
                  <span className="uppercase tracking-[0.1em] text-ink-soft">{o.status}</span>
                  <span className="font-medium text-ink">{formatPKR(o.total)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
