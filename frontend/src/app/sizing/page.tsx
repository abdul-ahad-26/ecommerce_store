import type { Metadata } from "next";
import { InfoPage, InfoSection } from "@/components/info-page";

export const metadata: Metadata = {
  title: "Size Guide",
  description: "Find your fit — measurements for Meher's stitched women's wear.",
};

const SIZES = [
  { size: "XS", bust: "32", waist: "26", hip: "36" },
  { size: "S", bust: "34", waist: "28", hip: "38" },
  { size: "M", bust: "36", waist: "30", hip: "40" },
  { size: "L", bust: "38", waist: "32", hip: "42" },
  { size: "XL", bust: "40", waist: "34", hip: "44" },
];

export default function SizingPage() {
  return (
    <InfoPage
      eyebrow="Help"
      title="Size Guide"
      intro="Measurements are in inches. If you're between sizes, we recommend sizing up."
    >
      <InfoSection heading="Stitched sizes (inches)">
        <div className="overflow-x-auto">
          <table className="mt-2 w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-ink/20 text-left text-xs uppercase tracking-[0.12em] text-ink">
                <th className="py-2 pr-4">Size</th>
                <th className="py-2 pr-4">Bust</th>
                <th className="py-2 pr-4">Waist</th>
                <th className="py-2 pr-4">Hip</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/10">
              {SIZES.map((s) => (
                <tr key={s.size}>
                  <td className="py-2 pr-4 font-medium text-ink">{s.size}</td>
                  <td className="py-2 pr-4">{s.bust}"</td>
                  <td className="py-2 pr-4">{s.waist}"</td>
                  <td className="py-2 pr-4">{s.hip}"</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </InfoSection>

      <InfoSection heading="How to measure">
        <ul className="ml-5 list-disc space-y-1">
          <li><strong className="text-ink">Bust</strong> — around the fullest part of your chest</li>
          <li><strong className="text-ink">Waist</strong> — around the narrowest part of your waistline</li>
          <li><strong className="text-ink">Hip</strong> — around the fullest part of your hips</li>
        </ul>
      </InfoSection>

      <InfoSection heading="Unstitched fabric">
        <p>
          Unstitched suits come as fabric to be tailored to your exact
          measurements — no standard size applies. Each listing notes the number
          of pieces (e.g. 3-piece: shirt, trouser, dupatta).
        </p>
      </InfoSection>
    </InfoPage>
  );
}
