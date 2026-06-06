import type { Metadata } from "next";
import { InfoPage, InfoSection } from "@/components/info-page";

export const metadata: Metadata = {
  title: "Contact",
  description: "Get in touch with Meher — we're here to help with orders and sizing.",
};

export default function ContactPage() {
  return (
    <InfoPage
      eyebrow="Help"
      title="Contact Us"
      intro="Questions about an order, sizing, or a piece? We're happy to help."
    >
      <InfoSection heading="WhatsApp & phone">
        <p>
          <a
            href="https://wa.me/920000000000"
            className="font-medium text-madder underline"
          >
            Message us on WhatsApp
          </a>{" "}
          — usually the fastest way to reach us.
        </p>
        <p>Phone: +92 000 0000000 (Mon–Sat, 10am–7pm PKT)</p>
      </InfoSection>

      <InfoSection heading="Email">
        <p>
          <a href="mailto:hello@meher.pk" className="font-medium text-madder underline">
            hello@meher.pk
          </a>
        </p>
      </InfoSection>

      <InfoSection heading="Orders">
        <p>
          For order-specific help, please have your order number ready (it looks
          like <span className="text-ink">MR…</span> and is on your confirmation
          page). You can also view your orders under your account.
        </p>
      </InfoSection>

      <p className="text-sm text-ink-soft/80">
        Replace the placeholder phone, WhatsApp number, and email above with the
        store&apos;s real contact details before going live.
      </p>
    </InfoPage>
  );
}
