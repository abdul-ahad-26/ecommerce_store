"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { listMyOrders } from "@/lib/orders";
import { formatPKR } from "@/lib/format";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-gold-soft/30 text-ink",
  confirmed: "bg-sage/20 text-sage",
  shipped: "bg-sage/20 text-sage",
  delivered: "bg-sage/30 text-sage",
  cancelled: "bg-madder/15 text-madder",
};

export function OrderHistory() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["orders"],
    queryFn: listMyOrders,
  });

  if (isLoading) {
    return <p className="text-sm text-ink-soft">Loading your orders…</p>;
  }
  if (isError) {
    return <p className="text-sm text-madder">Couldn&apos;t load your orders.</p>;
  }
  if (!data || data.length === 0) {
    return (
      <div className="border border-ink/10 bg-cream p-8 text-center">
        <p className="text-ink-soft">You haven&apos;t placed any orders yet.</p>
        <Link href="/shop" className="btn-ink mt-5">
          Start Shopping
        </Link>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-ink/10 border-y border-ink/10">
      {data.map((o) => (
        <li
          key={o.order_number}
          className="flex flex-wrap items-center justify-between gap-3 py-4"
        >
          <div>
            <Link
              href={`/order/${o.order_number}`}
              className="font-display text-lg text-ink hover:text-madder"
            >
              {o.order_number}
            </Link>
            <p className="text-xs uppercase tracking-[0.12em] text-ink-soft">
              {new Date(o.placed_at).toLocaleDateString("en-PK", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}{" "}
              · {o.item_count} {o.item_count === 1 ? "item" : "items"}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <span
              className={`px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.14em] ${
                STATUS_STYLES[o.status] ?? "bg-ink/5 text-ink-soft"
              }`}
            >
              {o.status}
            </span>
            <span className="text-sm font-medium text-ink">
              {formatPKR(o.total)}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
