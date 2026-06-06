import type { Metadata } from "next";
import { InfoPage, InfoSection } from "@/components/info-page";

export const metadata: Metadata = {
  title: "Returns & Exchanges",
  description: "Meher's 7-day return and exchange policy for Pakistani women's wear.",
};

export default function ReturnsPage() {
  return (
    <InfoPage
      eyebrow="Help"
      title="Returns & Exchanges"
      intro="Not quite right? We offer easy returns and exchanges within 7 days of delivery."
    >
      <InfoSection heading="Our policy">
        <p>
          You may request a return or exchange within <strong className="text-ink">7
          days</strong> of receiving your order, provided the item is:
        </p>
        <ul className="ml-5 list-disc space-y-1">
          <li>Unworn, unwashed, and undamaged</li>
          <li>With original tags and packaging intact</li>
        </ul>
        <p>
          For hygiene reasons, sale items and unstitched fabric that has been cut
          or stitched cannot be returned.
        </p>
      </InfoSection>

      <InfoSection heading="How to request">
        <p>
          Contact us within 7 days with your order number and reason. We&apos;ll
          arrange a pickup or guide you to send the parcel back. Once we receive
          and inspect the item, we&apos;ll process your exchange or refund.
        </p>
      </InfoSection>

      <InfoSection heading="Refunds">
        <p>
          Refunds are issued via bank transfer or easypaisa/JazzCash within 5–7
          working days of approval. For exchanges, the replacement is dispatched
          once the original is received.
        </p>
      </InfoSection>
    </InfoPage>
  );
}
