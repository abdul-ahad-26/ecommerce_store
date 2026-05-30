import Link from "next/link";
import { Motif } from "@/components/motif";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-6 py-32 text-center">
      <Motif className="h-16 w-16 text-gold" />
      <p className="eyebrow mt-8">Error 404</p>
      <h1 className="mt-4 font-display text-5xl text-ink">
        This thread leads nowhere.
      </h1>
      <p className="mt-4 text-ink-soft">
        The page you&apos;re looking for isn&apos;t here — it may have moved, or
        this feature is still being woven.
      </p>
      <Link href="/" className="btn-ink mt-8">
        Return Home
      </Link>
    </div>
  );
}
