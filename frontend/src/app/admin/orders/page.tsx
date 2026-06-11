"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listAdminOrders,
  updateOrderStatus,
  ORDER_STATUSES,
} from "@/lib/admin";
import { formatPKR } from "@/lib/format";

export default function AdminOrders() {
  const qc = useQueryClient();
  const initialStatus = useSearchParams().get("status") ?? "all";
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "orders"],
    queryFn: listAdminOrders,
  });

  const statusMut = useMutation({
    mutationFn: ({ number, status }: { number: string; status: string }) =>
      updateOrderStatus(number, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "orders"] });
      qc.invalidateQueries({ queryKey: ["admin", "stats"] });
    },
  });

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.filter((o) => {
      if (statusFilter !== "all" && o.status !== statusFilter) return false;
      if (!q) return true;
      return (
        o.order_number.toLowerCase().includes(q) ||
        o.customer_name.toLowerCase().includes(q) ||
        o.customer_phone.toLowerCase().includes(q)
      );
    });
  }, [data, statusFilter, search]);

  if (isLoading || !data) {
    return <p className="text-sm text-ink-soft">Loading orders…</p>;
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-4xl text-ink">Orders</h1>
        <p className="text-sm text-ink-soft">
          {filtered.length} of {data.length}
        </p>
      </div>

      {/* Filters */}
      <div className="mt-6 flex flex-wrap gap-3">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search order #, name or phone"
          className="min-w-60 flex-1 border border-ink/20 bg-cream px-3 py-2 text-sm outline-none focus:border-madder"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
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

      {data.length === 0 ? (
        <p className="mt-8 text-ink-soft">No orders yet.</p>
      ) : filtered.length === 0 ? (
        <p className="mt-8 text-ink-soft">No orders match your filters.</p>
      ) : (
        <div className="mt-8 overflow-x-auto">
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
              {filtered.map((o) => (
                <tr key={o.order_number}>
                  <td className="py-3 pr-4">
                    <Link
                      href={`/order/${o.order_number}`}
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
                    {new Date(o.placed_at).toLocaleDateString("en-PK", {
                      day: "numeric",
                      month: "short",
                    })}
                  </td>
                  <td className="py-3 pr-4">
                    <select
                      value={o.status}
                      disabled={statusMut.isPending}
                      onChange={(e) =>
                        statusMut.mutate({
                          number: o.order_number,
                          status: e.target.value,
                        })
                      }
                      className="border border-ink/20 bg-cream px-2 py-1.5 text-xs capitalize outline-none focus:border-madder"
                    >
                      {ORDER_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
