import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrder, type Order } from "@/lib/orders";
import { formatPKR } from "@/lib/format";
import { Motif } from "@/components/motif";

export const metadata: Metadata = {
  title: "Order Confirmed",
  robots: { index: false },
};

async function loadOrder(orderNumber: string): Promise<Order | null> {
  try {
    return await getOrder(orderNumber);
  } catch {
    return null;
  }
}

export default async function OrderConfirmationPage({
  params,
}: {
  params: Promise<{ order_number: string }>;
}) {
  const { order_number } = await params;
  const order = await loadOrder(order_number);
  if (!order) notFound();

  const placed = new Date(order.placed_at).toLocaleDateString("en-PK", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="mx-auto max-w-[760px] px-6 py-16">
      {/* Confirmation header */}
      <div className="text-center">
        <Motif className="mx-auto h-14 w-14 text-gold" />
        <p className="eyebrow mt-6">Order Confirmed</p>
        <h1 className="mt-3 font-display text-4xl text-ink sm:text-5xl">
          Shukria, {order.customer_name.split(" ")[0]}!
        </h1>
        <p className="mt-3 text-ink-soft">
          Your order is placed. We&apos;ll call to confirm before dispatch.
        </p>
        <p className="mt-5 inline-block border border-ink/15 bg-cream px-5 py-2 text-sm tracking-[0.1em]">
          Order <strong className="text-ink">{order.order_number}</strong>
          <span className="text-ink-soft"> · {placed}</span>
        </p>
      </div>

      {/* Items */}
      <div className="mt-12 border border-ink/10 bg-cream">
        <ul className="divide-y divide-ink/10">
          {order.items.map((item, i) => (
            <li key={i} className="flex items-center justify-between gap-4 px-6 py-4">
              <div>
                <p className="font-display text-lg text-ink">
                  {item.product_name}
                </p>
                {item.variant_label && (
                  <p className="text-xs uppercase tracking-[0.12em] text-ink-soft">
                    {item.variant_label} · Qty {item.qty}
                  </p>
                )}
              </div>
              <span className="shrink-0 text-sm font-medium text-ink">
                {formatPKR(item.line_total)}
              </span>
            </li>
          ))}
        </ul>

        <div className="space-y-2 border-t border-ink/10 px-6 py-5">
          <Row label="Subtotal" value={formatPKR(order.subtotal)} />
          <Row
            label="Shipping"
            value={
              Number(order.shipping_fee) === 0
                ? "Free"
                : formatPKR(order.shipping_fee)
            }
          />
          <div className="rule-gold my-3" />
          <Row label="Total (Cash on Delivery)" value={formatPKR(order.total)} strong />
        </div>
      </div>

      {/* Delivery details */}
      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        <Panel title="Delivering to">
          <p className="text-ink">{order.customer_name}</p>
          <p className="text-ink-soft">{order.customer_phone}</p>
          <p className="mt-2 text-ink-soft">
            {order.shipping_line1}
            {order.shipping_line2 ? `, ${order.shipping_line2}` : ""}
            <br />
            {order.shipping_city}, {order.shipping_province}
            {order.shipping_postal_code ? ` ${order.shipping_postal_code}` : ""}
          </p>
        </Panel>
        <Panel title="Payment">
          <p className="text-ink">Cash on Delivery</p>
          <p className="text-ink-soft">
            Pay {formatPKR(order.total)} in cash when your parcel arrives.
          </p>
          <p className="mt-2 text-xs uppercase tracking-[0.12em] text-sage">
            Status: {order.status}
          </p>
        </Panel>
      </div>

      <div className="mt-10 text-center">
        <Link href="/shop" className="btn-ink">
          Continue Shopping
        </Link>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex justify-between text-sm">
      <span className={strong ? "font-medium text-ink" : "text-ink-soft"}>
        {label}
      </span>
      <span className={strong ? "text-lg font-medium text-ink" : "text-ink"}>
        {value}
      </span>
    </div>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-ink/10 p-6">
      <h2 className="eyebrow mb-3 text-ink">{title}</h2>
      <div className="space-y-0.5 text-sm leading-relaxed">{children}</div>
    </div>
  );
}
