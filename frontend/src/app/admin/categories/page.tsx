"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getCategories } from "@/lib/catalog";
import { createCategory, deleteCategory } from "@/lib/admin";
import { ApiError } from "@/lib/api";

function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function AdminCategories() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["categories"],
    queryFn: getCategories,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["categories"] });

  const createMut = useMutation({
    mutationFn: () =>
      createCategory({ name: name.trim(), slug: slugify(name) }),
    onSuccess: () => {
      invalidate();
      setName("");
      setError(null);
    },
    onError: (e) =>
      setError(e instanceof ApiError ? e.message : "Could not create category"),
  });

  const deleteMut = useMutation({
    mutationFn: deleteCategory,
    onSuccess: invalidate,
    onError: (e) =>
      setError(e instanceof ApiError ? e.message : "Could not delete category"),
  });

  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-4xl text-ink">Categories</h1>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) createMut.mutate();
        }}
        className="mt-8 flex gap-3"
      >
        <input
          className="ip"
          placeholder="New category name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button
          type="submit"
          disabled={createMut.isPending || !name.trim()}
          className="btn-ink shrink-0 disabled:bg-ink-soft/40"
        >
          Add
        </button>
      </form>
      {name && (
        <p className="mt-2 text-xs text-ink-soft">slug: {slugify(name)}</p>
      )}
      {error && <p className="mt-3 text-sm text-madder">{error}</p>}

      {isLoading || !data ? (
        <p className="mt-8 text-sm text-ink-soft">Loading…</p>
      ) : (
        <ul className="mt-8 divide-y divide-ink/10 border-y border-ink/10">
          {data.map((c) => (
            <li key={c.id} className="flex items-center justify-between py-3">
              <div>
                <span className="font-medium text-ink">{c.name}</span>
                <span className="ml-2 text-xs text-ink-soft">/{c.slug}</span>
              </div>
              <button
                onClick={() => {
                  setError(null);
                  if (confirm(`Delete category "${c.name}"?`)) {
                    deleteMut.mutate(c.id);
                  }
                }}
                className="text-xs uppercase tracking-[0.12em] text-ink-soft underline hover:text-madder"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
