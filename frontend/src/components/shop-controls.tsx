"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

const SORT_OPTIONS = [
  { value: "newest", label: "Newest" },
  { value: "price_asc", label: "Price: Low to High" },
  { value: "price_desc", label: "Price: High to Low" },
  { value: "name", label: "Name (A–Z)" },
];

export function ShopControls({ total }: { total: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("search") ?? "");

  function update(next: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value === null || value === "") params.delete(key);
      else params.set(key, value);
    }
    // Any filter/sort change resets to page 1.
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-col gap-4 border-y border-ink/10 py-4 sm:flex-row sm:items-center sm:justify-between">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          update({ search });
        }}
        className="flex items-center gap-2"
      >
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search pieces…"
          className="w-full border border-ink/15 bg-cream px-3 py-2 text-sm outline-none placeholder:text-ink-soft/60 focus:border-madder sm:w-64"
        />
        <button
          type="submit"
          className="border border-ink bg-ink px-4 py-2 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-cream hover:bg-madder"
        >
          Go
        </button>
      </form>

      <div className="flex items-center justify-between gap-4 sm:justify-end">
        <span className="text-xs uppercase tracking-[0.14em] text-ink-soft tabular-nums">
          {total} {total === 1 ? "piece" : "pieces"}
        </span>
        <label className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-ink-soft">
          Sort
          <select
            value={searchParams.get("sort") ?? "newest"}
            onChange={(e) => update({ sort: e.target.value })}
            className="border border-ink/15 bg-cream px-2 py-2 text-xs text-ink outline-none focus:border-madder"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
