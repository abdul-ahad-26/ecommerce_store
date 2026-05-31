"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { selectSubtotal, useCart } from "@/store/cart";
import { estimateShipping, placeOrder } from "@/lib/orders";
import { listAddresses } from "@/lib/addresses";
import { useAuth } from "@/store/auth";
import { ApiError } from "@/lib/api";
import { formatPKR } from "@/lib/format";
import { SectionLabel } from "@/components/section-label";

const PROVINCES = [
  "Punjab",
  "Sindh",
  "Khyber Pakhtunkhwa",
  "Balochistan",
  "Islamabad Capital Territory",
  "Gilgit-Baltistan",
  "Azad Kashmir",
];

const schema = z.object({
  customer_name: z.string().min(1, "Required"),
  customer_phone: z
    .string()
    .min(7, "Enter a valid phone number")
    .max(32),
  customer_email: z.union([z.literal(""), z.string().email("Invalid email")]),
  shipping_line1: z.string().min(1, "Required"),
  shipping_line2: z.string().optional(),
  shipping_city: z.string().min(1, "Required"),
  shipping_province: z.string().min(1, "Select a province"),
  shipping_postal_code: z.string().optional(),
  notes: z.string().max(1000).optional(),
});

type FormValues = z.infer<typeof schema>;

export default function CheckoutPage() {
  const router = useRouter();
  const items = useCart((s) => s.items);
  const subtotal = useCart(selectSubtotal);
  const clear = useCart((s) => s.clear);
  const user = useAuth((s) => s.user);

  const [mounted, setMounted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  useEffect(() => setMounted(true), []);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { shipping_province: "Punjab" },
  });

  // Prefill from the logged-in user's profile + default saved address.
  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      let addr = null;
      try {
        const list = await listAddresses();
        addr = list.find((a) => a.is_default) ?? list[0] ?? null;
      } catch {
        /* no addresses yet — fall back to profile */
      }
      if (!active) return;
      reset({
        customer_name: addr?.recipient_name ?? user.full_name,
        customer_phone: addr?.phone ?? user.phone ?? "",
        customer_email: user.email,
        shipping_line1: addr?.line1 ?? "",
        shipping_line2: addr?.line2 ?? "",
        shipping_city: addr?.city ?? "",
        shipping_province: addr?.province ?? "Punjab",
        shipping_postal_code: addr?.postal_code ?? "",
        notes: "",
      });
    })();
    return () => {
      active = false;
    };
  }, [user, reset]);

  const shipping = estimateShipping(subtotal);
  const total = subtotal + shipping;

  async function onSubmit(values: FormValues) {
    setSubmitError(null);
    try {
      const order = await placeOrder({
        items: items.map((i) => ({ variant_id: i.variantId, qty: i.qty })),
        customer_name: values.customer_name,
        customer_phone: values.customer_phone,
        customer_email: values.customer_email || null,
        shipping_line1: values.shipping_line1,
        shipping_line2: values.shipping_line2 || null,
        shipping_city: values.shipping_city,
        shipping_province: values.shipping_province,
        shipping_postal_code: values.shipping_postal_code || null,
        notes: values.notes || null,
      });
      clear();
      router.push(`/order/${order.order_number}`);
    } catch (err) {
      setSubmitError(
        err instanceof ApiError
          ? err.message
          : "Something went wrong placing your order. Please try again.",
      );
    }
  }

  if (!mounted) {
    return <div className="mx-auto max-w-[1100px] px-6 py-20" />;
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-[1100px] px-6 py-20 text-center">
        <h1 className="font-display text-4xl text-ink">Your bag is empty</h1>
        <p className="mt-3 text-ink-soft">
          Add a piece before heading to checkout.
        </p>
        <Link href="/shop" className="btn-ink mt-6">
          Browse the Collection
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1100px] px-6 py-14">
      <SectionLabel index="—">Checkout</SectionLabel>
      <h1 className="mt-4 font-display text-5xl text-ink">Complete your order</h1>

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="mt-10 grid gap-12 lg:grid-cols-[1.4fr_1fr]"
      >
        {/* Form fields */}
        <div className="space-y-8">
          <fieldset className="space-y-4">
            <legend className="eyebrow mb-2 text-ink">Contact</legend>
            <Field label="Full name" error={errors.customer_name?.message}>
              <input className="ip" {...register("customer_name")} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Phone" error={errors.customer_phone?.message}>
                <input
                  className="ip"
                  placeholder="03XX XXXXXXX"
                  inputMode="tel"
                  {...register("customer_phone")}
                />
              </Field>
              <Field
                label="Email (optional)"
                error={errors.customer_email?.message}
              >
                <input className="ip" {...register("customer_email")} />
              </Field>
            </div>
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="eyebrow mb-2 text-ink">Shipping address</legend>
            <Field label="Address" error={errors.shipping_line1?.message}>
              <input
                className="ip"
                placeholder="House, street, area"
                {...register("shipping_line1")}
              />
            </Field>
            <Field label="Apartment, landmark (optional)">
              <input className="ip" {...register("shipping_line2")} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="City" error={errors.shipping_city?.message}>
                <input className="ip" {...register("shipping_city")} />
              </Field>
              <Field label="Province" error={errors.shipping_province?.message}>
                <select className="ip" {...register("shipping_province")}>
                  {PROVINCES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Postal code (optional)">
                <input className="ip" {...register("shipping_postal_code")} />
              </Field>
            </div>
            <Field label="Order notes (optional)">
              <textarea
                className="ip min-h-20 resize-y"
                placeholder="Delivery instructions, preferred timing…"
                {...register("notes")}
              />
            </Field>
          </fieldset>
        </div>

        {/* Summary */}
        <aside className="h-fit border border-ink/10 bg-cream p-7">
          <h2 className="eyebrow text-ink">Order Summary</h2>
          <ul className="mt-5 space-y-3">
            {items.map((i) => (
              <li key={i.variantId} className="flex justify-between gap-3 text-sm">
                <span className="text-ink">
                  {i.productName}
                  {i.variantLabel && (
                    <span className="text-ink-soft"> — {i.variantLabel}</span>
                  )}
                  <span className="text-ink-soft"> × {i.qty}</span>
                </span>
                <span className="shrink-0 text-ink">
                  {formatPKR(i.unitPrice * i.qty)}
                </span>
              </li>
            ))}
          </ul>

          <div className="rule-gold my-5" />
          <Row label="Subtotal" value={formatPKR(subtotal)} />
          <Row
            label="Shipping"
            value={shipping === 0 ? "Free" : formatPKR(shipping)}
          />
          <div className="rule-gold my-5" />
          <Row label="Total" value={formatPKR(total)} strong />

          <div className="mt-6 border border-ink/10 bg-paper p-3 text-center text-xs uppercase tracking-[0.14em] text-ink-soft">
            Payment: Cash on Delivery
          </div>

          {submitError && (
            <p className="mt-4 border border-madder/40 bg-madder/10 p-3 text-sm text-madder">
              {submitError}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-ink mt-5 w-full disabled:bg-ink-soft/40"
          >
            {isSubmitting ? "Placing order…" : "Place Order"}
          </button>
          <p className="mt-3 text-center text-xs text-ink-soft">
            You&apos;ll pay in cash when your order is delivered.
          </p>
        </aside>
      </form>
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs uppercase tracking-[0.12em] text-ink-soft">
        {label}
      </span>
      {children}
      {error && <span className="mt-1 block text-xs text-madder">{error}</span>}
    </label>
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
