/** Magazine-style numbered section eyebrow, e.g. "01 — The Collection". */
export function SectionLabel({
  index,
  children,
}: {
  index: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="eyebrow tabular-nums">{index}</span>
      <span className="h-px w-8 bg-gold" aria-hidden />
      <span className="eyebrow text-ink-soft">{children}</span>
    </div>
  );
}
