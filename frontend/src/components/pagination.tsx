import Link from "next/link";

/** Server-rendered pagination using query-string links. */
export function Pagination({
  page,
  pages,
  makeHref,
}: {
  page: number;
  pages: number;
  makeHref: (page: number) => string;
}) {
  if (pages <= 1) return null;

  const nums = Array.from({ length: pages }, (_, i) => i + 1);

  return (
    <nav className="mt-16 flex items-center justify-center gap-2" aria-label="Pagination">
      {page > 1 && (
        <Link
          href={makeHref(page - 1)}
          className="px-3 py-2 text-xs uppercase tracking-[0.14em] text-ink-soft hover:text-madder"
        >
          ← Prev
        </Link>
      )}
      {nums.map((n) => (
        <Link
          key={n}
          href={makeHref(n)}
          aria-current={n === page ? "page" : undefined}
          className={`flex h-9 w-9 items-center justify-center text-sm tabular-nums transition-colors ${
            n === page
              ? "bg-ink text-cream"
              : "border border-ink/15 text-ink hover:border-madder hover:text-madder"
          }`}
        >
          {n}
        </Link>
      ))}
      {page < pages && (
        <Link
          href={makeHref(page + 1)}
          className="px-3 py-2 text-xs uppercase tracking-[0.14em] text-ink-soft hover:text-madder"
        >
          Next →
        </Link>
      )}
    </nav>
  );
}
