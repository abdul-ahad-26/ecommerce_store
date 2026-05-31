"use client";

import Image from "next/image";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { deleteProduct, listAdminProducts } from "@/lib/admin";
import { formatPKR } from "@/lib/format";

export default function AdminProducts() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "products"],
    queryFn: listAdminProducts,
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

      {isLoading || !data ? (
        <p className="mt-8 text-sm text-ink-soft">Loading…</p>
      ) : (
        <div className="mt-8 overflow-x-auto">
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
              {data.map((p) => {
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
      )}
    </div>
  );
}
