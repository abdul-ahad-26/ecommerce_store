"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  deleteProduct,
  listAdminProducts,
  type AdminProductsQuery,
} from "@/lib/admin";
import { formatPKR } from "@/lib/format";

const PAGE_SIZE = 20;
const STOCK_OPTIONS = ["in", "low", "out"] as const;
type StockFilter = AdminProductsQuery["stock"] | "all";

export default function AdminProducts() {
  const qc = useQueryClient();
  // ?stock=low deep-link (used by the dashboard's Low Stock card).
  const initialStock = useSearchParams().get("stock");
  const [searchInput, setSearchInput] = useState("");
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // all | live | draft
  const [stockFilter, setStockFilter] = useState<StockFilter>(
    STOCK_OPTIONS.includes(initialStock as never)
      ? (initialStock as StockFilter)
      : "all",
  );
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
    queryKey: [
      "admin",
      "products",
      { page, q, status: statusFilter, stock: stockFilter },
    ],
    queryFn: () =>
      listAdminProducts({
        page,
        page_size: PAGE_SIZE,
        q: q || undefined,
        published:
          statusFilter === "all" ? undefined : statusFilter === "live",
        stock: stockFilter === "all" ? undefined : stockFilter,
      }),
    placeholderData: (prev) => prev,
  });

  const deleteMut = useMutation({
    mutationFn: deleteProduct,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "products"] }),
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-4xl text-ink">Products</h1>
        <Link href="/admin/products/new" className="btn-ink">
          + New Product
        </Link>
      </div>

      {/* Filters (server-side) */}
      <div className="mt-6 flex flex-wrap gap-3">
        <input
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search name or brand"
          className="min-w-60 flex-1 border border-ink/20 bg-cream px-3 py-2 text-sm outline-none focus:border-madder"
        />
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="border border-ink/20 bg-cream px-3 py-2 text-sm outline-none focus:border-madder"
        >
          <option value="all">All products</option>
          <option value="live">Live</option>
          <option value="draft">Draft</option>
        </select>
        <select
          value={stockFilter}
          onChange={(e) => {
            setStockFilter(e.target.value as StockFilter);
            setPage(1);
          }}
          className="border border-ink/20 bg-cream px-3 py-2 text-sm outline-none focus:border-madder"
        >
          <option value="all">All stock</option>
          <option value="in">In stock</option>
          <option value="low">Low stock</option>
          <option value="out">Out of stock</option>
        </select>
      </div>

      {isLoading || !data ? (
        <p className="mt-8 text-sm text-ink-soft">Loading…</p>
      ) : data.items.length === 0 ? (
        <p className="mt-8 text-sm text-ink-soft">
          {q || statusFilter !== "all" || stockFilter !== "all"
            ? "No products match your filters."
            : "No products yet."}
        </p>
      ) : (
        <>
        {/* Mobile cards */}
        <ul className="mt-8 space-y-3 sm:hidden">
          {data.items.map((p) => {
            const stock = p.variants.reduce((n, v) => n + v.stock_qty, 0);
            return (
              <li key={p.id} className="border border-ink/10 bg-cream p-4">
                <div className="flex items-center gap-3">
                  <div className="relative h-14 w-11 shrink-0 overflow-hidden bg-paper-deep">
                    {p.images[0] && (
                      <Image
                        src={p.images[0].url}
                        alt={p.name}
                        fill
                        sizes="44px"
                        className="object-cover"
                      />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-ink">{p.name}</p>
                    <p className="text-xs text-ink-soft">
                      {formatPKR(p.sale_price ?? p.base_price)} ·{" "}
                      <span className={stock === 0 ? "text-madder" : ""}>
                        {stock} in stock
                      </span>{" "}
                      · {p.is_published ? "Live" : "Draft"}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex gap-4 text-xs uppercase tracking-[0.12em]">
                  <Link
                    href={`/admin/products/${p.id}`}
                    className="text-ink underline hover:text-madder"
                  >
                    Edit
                  </Link>
                  <button
                    onClick={() => {
                      if (confirm(`Delete "${p.name}"?`)) {
                        deleteMut.mutate(p.id);
                      }
                    }}
                    className="text-ink-soft underline hover:text-madder"
                  >
                    Delete
                  </button>
                </div>
              </li>
            );
          })}
        </ul>

        {/* Desktop table */}
        <div className="mt-8 hidden overflow-x-auto sm:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink/15 text-left text-xs uppercase tracking-[0.12em] text-ink-soft">
                <th className="py-3 pr-4">Product</th>
                <th className="py-3 pr-4">Price</th>
                <th className="py-3 pr-4">Stock</th>
                <th className="py-3 pr-4">Status</th>
                <th className="py-3 pr-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/10">
              {data.items.map((p) => {
                const stock = p.variants.reduce((n, v) => n + v.stock_qty, 0);
                return (
                  <tr key={p.id}>
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-3">
                        <div className="relative h-14 w-11 shrink-0 overflow-hidden bg-paper-deep">
                          {p.images[0] && (
                            <Image
                              src={p.images[0].url}
                              alt={p.name}
                              fill
                              sizes="44px"
                              className="object-cover"
                            />
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-ink">{p.name}</p>
                          <p className="text-xs text-ink-soft">
                            {p.brand} · {p.variants.length} variants
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-ink">
                      {formatPKR(p.sale_price ?? p.base_price)}
                    </td>
                    <td className="py-3 pr-4 tabular-nums">
                      <span className={stock === 0 ? "text-madder" : "text-ink"}>
                        {stock}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      <span
                        className={`px-2 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.12em] ${
                          p.is_published
                            ? "bg-sage/20 text-sage"
                            : "bg-ink/10 text-ink-soft"
                        }`}
                      >
                        {p.is_published ? "Live" : "Draft"}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex gap-3 text-xs uppercase tracking-[0.12em]">
                        <Link
                          href={`/admin/products/${p.id}`}
                          className="text-ink underline hover:text-madder"
                        >
                          Edit
                        </Link>
                        <button
                          onClick={() => {
                            if (confirm(`Delete "${p.name}"?`)) {
                              deleteMut.mutate(p.id);
                            }
                          }}
                          className="text-ink-soft underline hover:text-madder"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

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
              Page {data.page} of {data.pages} · {data.total} products
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
