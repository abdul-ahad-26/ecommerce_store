"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getOrder } from "@/lib/orders";
import { updateOrderStatus, ORDER_STATUSES } from "@/lib/admin";
import { formatPKR } from "@/lib/format";

export default function AdminOrderDetail() {
  const { number } = useParams<{ number: string }>();
  const qc = useQueryClient();

  const { data: order, isLoading } = useQuery({
    queryKey: ["admin", "order", number],
    queryFn: () => getOrder(number),
    enabled: Boolean(number),
  });

  const statusMut = useMutation({
    mutationFn: (status: string) => updateOrderStatus(number, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "order", number] });
      qc.invalidateQueries({ queryKey: ["admin", "orders"] });
      qc.invalidateQueries({ queryKey: ["admin", "stats"] });
    },
  });

  if (isLoading || !order) {
    return <p className="text-sm text-ink-soft">Loading order…</p>;
  }

  const address = [
    order.shipping_line1,
    order.shipping_line2,
    order.shipping_city,
    order.shipping_province,
    order.shipping_postal_code,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div>
      <Link
        href="/admin/orders"
        className="text-xs uppercase tracking-[0.12em] text-ink-soft hover:text-madder"
      >
        ← All orders
      </Link>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl text-ink">
            {order.order_number}
          </h1>
          <p className="mt-1 text-sm text-ink-soft">
            Placed{" "}
            {new Date(order.placed_at).toLocaleDateString("en-PK", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>
        <label className="flex items-center gap-3">
          <span className="text-xs uppercase tracking-[0.12em] text-ink-soft">
            Status
          </span>
          <select
            value={order.status}
            disabled={statusMut.isPending}
            onChange={(e) => statusMut.mutate(e.target.value)}
            className="border border-ink/20 bg-cream px-3 py-2 text-sm capitalize outline-none focus:border-madder"
          >
            {ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        {/* Items + totals */}
        <div className="border border-ink/10 bg-cream p-6">
          <h2 className="eyebrow mb-5 text-ink">Items</h2>
          <ul className="divide-y divide-ink/10">
            {order.items.map((item, i) => (
              <li key={i} className="flex items-center gap-4 py-4">
                <div className="relative h-16 w-12 shrink-0 overflow-hidden bg-paper-deep">
                  {item.image_url && (
                    <Image
                      src={item.image_url}
                      alt={item.product_name}
                      fill
                      sizes="48px"
                      className="object-cover"
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-ink">
                    {item.product_name}
                  </p>
                  <p className="text-xs text-ink-soft">
                    {[item.variant_label, `× ${item.qty}`]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <span className="text-sm font-medium text-ink">
                  {formatPKR(item.line_total)}
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-4 space-y-1.5 border-t border-ink/10 pt-4 text-sm">
            <Row label="Subtotal" value={formatPKR(order.subtotal)} />
            <Row label="Shipping" value={formatPKR(order.shipping_fee)} />
            {Number(order.discount) > 0 && (
              <Row label="Discount" value={`− ${formatPKR(order.discount)}`} />
            )}
            <div className="flex justify-between pt-1 font-semibold text-ink">
              <span>Total</span>
              <span>{formatPKR(order.total)}</span>
            </div>
          </div>
        </div>

        {/* Customer / delivery / payment */}
        <div className="space-y-6">
          <div className="border border-ink/10 bg-cream p-6">
            <h2 className="eyebrow mb-4 text-ink">Customer</h2>
            <p className="font-medium text-ink">{order.customer_name}</p>
            <p className="mt-1 text-sm text-ink-soft">{order.customer_phone}</p>
            {order.customer_email && (
              <p className="text-sm text-ink-soft">{order.customer_email}</p>
            )}
            <h3 className="eyebrow mb-2 mt-5 text-ink">Deliver to</h3>
            <p className="text-sm leading-relaxed text-ink-soft">{address}</p>
            {order.notes && (
              <>
                <h3 className="eyebrow mb-2 mt-5 text-ink">Notes</h3>
                <p className="text-sm leading-relaxed text-ink-soft">
                  {order.notes}
                </p>
              </>
            )}
          </div>

          <div className="border border-ink/10 bg-cream p-6">
            <h2 className="eyebrow mb-4 text-ink">Payment</h2>
            <Row label="Method" value={order.payment_method} />
            <p className="mt-1.5 flex justify-between text-sm">
              <span className="text-ink-soft">Status</span>
              <span
                className={`font-medium capitalize ${
                  order.payment_status === "paid" ? "text-sage" : "text-madder"
                }`}
              >
                {order.payment_status}
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <p className="flex justify-between text-sm">
      <span className="text-ink-soft">{label}</span>
      <span className="text-ink">{value}</span>
    </p>
  );
}
