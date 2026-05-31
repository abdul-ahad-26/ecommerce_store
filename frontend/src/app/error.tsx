"use client";

import { useEffect } from "react";
import { Motif } from "@/components/motif";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // In production this is where you'd report to an error tracker.
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-6 py-32 text-center">
      <Motif className="h-14 w-14 text-madder" />
      <h1 className="mt-8 font-display text-4xl text-ink">
        Something came undone.
      </h1>
      <p className="mt-3 text-ink-soft">
        An unexpected error occurred. Please try again.
      </p>
      <button onClick={reset} className="btn-ink mt-8">
        Try Again
      </button>
    </div>
  );
}
