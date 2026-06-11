import type { Metadata } from "next";
import { InfoPage, InfoSection } from "@/components/info-page";
import { CONTACT, whatsappLink } from "@/lib/site";

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
            href={whatsappLink("Hi Meher, I have a question about")}
            className="font-medium text-madder underline"
          >
            Message us on WhatsApp
          </a>{" "}
          — usually the fastest way to reach us.
        </p>
        <p>Phone: {CONTACT.phone} (Mon–Sat, 10am–7pm PKT)</p>
      </InfoSection>

      <InfoSection heading="Email">
        <p>
          <a
            href={`mailto:${CONTACT.email}`}
            className="font-medium text-madder underline"
          >
            {CONTACT.email}
          </a>
        </p>
      </InfoSection>

      {CONTACT.instagramUrl && (
        <InfoSection heading="Instagram">
          <p>
            <a
              href={CONTACT.instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-madder underline"
            >
              Follow our latest pieces
            </a>
          </p>
        </InfoSection>
      )}

      <InfoSection heading="Orders">
        <p>
          For order-specific help, please have your order number ready (it looks
          like <span className="text-ink">MR…</span> and is on your confirmation
          page). You can also view your orders under your account.
        </p>
      </InfoSection>
    </InfoPage>
  );
}
