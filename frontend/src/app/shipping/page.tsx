import type { Metadata } from "next";
import { InfoPage, InfoSection } from "@/components/info-page";
import { formatPKR } from "@/lib/format";

export const metadata: Metadata = {
  title: "Shipping & Cash on Delivery",
  description:
    "Delivery times, charges, and how Cash on Delivery works at Meher — nationwide across Pakistan.",
};

export default function ShippingPage() {
  return (
    <InfoPage
      eyebrow="Help"
      title="Shipping & COD"
      intro="We deliver nationwide across Pakistan, with Cash on Delivery on every order."
    >
      <InfoSection heading="Delivery time">
        <p>
          Orders are dispatched within 1–2 working days. Delivery typically takes:
        </p>
        <ul className="ml-5 list-disc space-y-1">
          <li>Major cities (Karachi, Lahore, Islamabad, etc.) — 2–4 working days</li>
          <li>Other cities &amp; towns — 4–7 working days</li>
        </ul>
        <p>
          We&apos;ll call to confirm your order before dispatch, so please keep
          your phone reachable.
        </p>
      </InfoSection>

      <InfoSection heading="Shipping charges">
        <ul className="ml-5 list-disc space-y-1">
          <li>
            <strong className="text-ink">Free shipping</strong> on orders over{" "}
            {formatPKR(5000)}
          </li>
          <li>Flat {formatPKR(200)} on orders below {formatPKR(5000)}</li>
        </ul>
      </InfoSection>

      <InfoSection heading="Cash on Delivery (COD)">
        <p>
          Pay in cash to the courier when your parcel arrives — no advance
          payment, no card needed. Please keep the exact amount ready. Orders are
          shipped via trusted couriers such as TCS and Leopards with tracking.
        </p>
      </InfoSection>

      <InfoSection heading="Order tracking">
        <p>
          Once dispatched, you&apos;ll receive a tracking number by SMS/WhatsApp.
          You can also view your orders any time under your account.
        </p>
      </InfoSection>
    </InfoPage>
  );
}
