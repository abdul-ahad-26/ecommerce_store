import { Motif } from "@/components/motif";

export default function Loading() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
      <Motif className="h-12 w-12 animate-pulse text-gold" />
      <p className="text-xs uppercase tracking-[0.2em] text-ink-soft">
        Loading
      </p>
    </div>
  );
}
