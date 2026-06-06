import { SectionLabel } from "./section-label";

/** Shared layout for static content pages (shipping, returns, sizing, contact). */
export function InfoPage({
  eyebrow,
  title,
  intro,
  children,
}: {
  eyebrow: string;
  title: string;
  intro?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <SectionLabel index="—">{eyebrow}</SectionLabel>
      <h1 className="mt-4 font-display text-5xl text-ink">{title}</h1>
      {intro && <p className="mt-4 max-w-xl text-lg text-ink-soft">{intro}</p>}
      <div className="rule-gold my-10" />
      <div className="space-y-8 leading-relaxed text-ink-soft">{children}</div>
    </div>
  );
}

/** A titled section block within an info page. */
export function InfoSection({
  heading,
  children,
}: {
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-2 font-display text-2xl text-ink">{heading}</h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}
