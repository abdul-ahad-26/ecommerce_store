"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listAdminOrders,
  updateOrderStatus,
  ORDER_STATUSES,
  type AdminOrderSummary,
} from "@/lib/admin";
import { formatPKR } from "@/lib/format";

const PAGE_SIZE = 20;

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-PK", {
    day: "numeric",
    month: "short",
  });
}

export default function AdminOrders() {
  const qc = useQueryClient();
  const initialStatus = useSearchParams().get("status") ?? "all";
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [searchInput, setSearchInput] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);

  // Debounce the search box so each keystroke doesn't hit the server.
  useEffect(() => {
    const id = setTimeout(() => {
      setQ(searchInput.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(id);
  }, [searchInput]);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "orders", { page, status: statusFilter, q }],
    queryFn: () =>
      listAdminOrders({
        page,
        page_size: PAGE_SIZE,
        status: statusFilter === "all" ? undefined : statusFilter,
        q: q || undefined,
      }),
    // Keep showing the previous page while the next one loads (no flicker).
    placeholderData: (prev) => prev,
    // New orders should surface while the table sits open.
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });

  const statusMut = useMutation({
    mutationFn: ({ number, status }: { number: string; status: string }) =>
      updateOrderStatus(number, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "orders"] });
      qc.invalidateQueries({ queryKey: ["admin", "stats"] });
    },
  });

  if (isLoading || !data) {
    return <p className="text-sm text-ink-soft">Loading orders…</p>;
  }

  const statusSelect = (o: AdminOrderSummary) => (
    <select
      value={o.status}
      disabled={statusMut.isPending}
      onChange={(e) => {
        const status = e.target.value;
        // Cancellation is destructive (stock isn't restored) — confirm it.
        // Routine transitions (pending → confirmed → shipped…) stay one click.
        if (
          status === "cancelled" &&
          !confirm(`Cancel order ${o.order_number}? Stock is not restored.`)
        ) {
          e.target.value = o.status;
          return;
        }
        statusMut.mutate({ number: o.order_number, status });
      }}
      className="border border-ink/20 bg-cream px-2 py-1.5 text-xs capitalize outline-none focus:border-madder"
    >
      {ORDER_STATUSES.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
    </select>
  );

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-4xl text-ink">Orders</h1>
        <p className="text-sm text-ink-soft">
          {data.total} order{data.total === 1 ? "" : "s"}
        </p>
      </div>

      {/* Filters (server-side: they search the whole history) */}
      <div className="mt-6 flex flex-wrap gap-3">
        <input
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search order #, name or phone"
          className="min-w-60 flex-1 border border-ink/20 bg-cream px-3 py-2 text-sm outline-none focus:border-madder"
        />
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="border border-ink/20 bg-cream px-3 py-2 text-sm capitalize outline-none focus:border-madder"
        >
          <option value="all">All statuses</option>
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {data.items.length === 0 ? (
        <p className="mt-8 text-ink-soft">
          {q || statusFilter !== "all"
            ? "No orders match your filters."
            : "No orders yet."}
        </p>
      ) : (
        <>
          {/* Desktop table */}
          <div className="mt-8 hidden overflow-x-auto sm:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink/15 text-left text-xs uppercase tracking-[0.12em] text-ink-soft">
                  <th className="py-3 pr-4">Order</th>
                  <th className="py-3 pr-4">Customer</th>
                  <th className="py-3 pr-4">Items</th>
                  <th className="py-3 pr-4">Total</th>
                  <th className="py-3 pr-4">Date</th>
                  <th className="py-3 pr-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/10">
                {data.items.map((o) => (
                  <tr key={o.order_number}>
                    <td className="py-3 pr-4">
                      <Link
                        href={`/admin/orders/${o.order_number}`}
                        className="font-medium text-ink hover:text-madder"
                      >
                        {o.order_number}
                      </Link>
                    </td>
                    <td className="py-3 pr-4 text-ink-soft">
                      {o.customer_name}
                      <br />
                      <span className="text-xs">{o.customer_phone}</span>
                    </td>
                    <td className="py-3 pr-4 tabular-nums">{o.item_count}</td>
                    <td className="py-3 pr-4 font-medium text-ink">
                      {formatPKR(o.total)}
                    </td>
                    <td className="py-3 pr-4 text-ink-soft">
                      {formatDate(o.placed_at)}
                    </td>
                    <td className="py-3 pr-4">{statusSelect(o)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <ul className="mt-8 space-y-3 sm:hidden">
            {data.items.map((o) => (
              <li
                key={o.order_number}
                className="border border-ink/10 bg-cream p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <Link
                    href={`/admin/orders/${o.order_number}`}
                    className="font-medium text-ink hover:text-madder"
                  >
                    {o.order_number}
                  </Link>
                  <span className="text-xs text-ink-soft">
                    {formatDate(o.placed_at)}
                  </span>
                </div>
                <p className="mt-1 text-sm text-ink-soft">
                  {o.customer_name} · {o.customer_phone}
                </p>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-ink">
                    {formatPKR(o.total)}{" "}
                    <span className="text-xs font-normal text-ink-soft">
                      · {o.item_count} item{o.item_count === 1 ? "" : "s"}
                    </span>
                  </span>
                  {statusSelect(o)}
                </div>
              </li>
            ))}
          </ul>

          {/* Pager */}
          {data.pages > 1 && (
            <div className="mt-8 flex items-center justify-between text-sm">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={data.page <= 1}
                className="border border-ink/20 px-4 py-2 text-xs uppercase tracking-[0.12em] text-ink transition-colors hover:border-madder hover:text-madder disabled:cursor-not-allowed disabled:opacity-40"
              >
                ‹ Prev
              </button>
              <span className="text-ink-soft">
                Page {data.page} of {data.pages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(data.pages, p + 1))}
                disabled={data.page >= data.pages}
                className="border border-ink/20 px-4 py-2 text-xs uppercase tracking-[0.12em] text-ink transition-colors hover:border-madder hover:text-madder disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next ›
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
