"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getCategories } from "@/lib/catalog";
import { ApiError } from "@/lib/api";
import {
  createProduct,
  updateProduct,
  uploadImage,
  type AdminProduct,
  type ProductWrite,
} from "@/lib/admin";

type ImageRow = { url: string; alt: string };
type VariantRow = {
  id?: number;
  sku: string;
  size: string;
  color: string;
  color_hex: string;
  price_override: string;
  stock_qty: string;
};

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function emptyVariant(): VariantRow {
  return { sku: "", size: "", color: "", color_hex: "", price_override: "", stock_qty: "0" };
}

export function ProductForm({ existing }: { existing?: AdminProduct }) {
  const router = useRouter();
  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: getCategories,
  });

  const [name, setName] = useState(existing?.name ?? "");
  const [slug, setSlug] = useState(existing?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(existing));
  const [description, setDescription] = useState(existing?.description ?? "");
  const [categoryId, setCategoryId] = useState<number | "">(
    existing?.category_id ?? "",
  );
  const [brand, setBrand] = useState(existing?.brand ?? "");
  const [fabric, setFabric] = useState(existing?.fabric ?? "");
  const [pieceCount, setPieceCount] = useState(existing?.piece_count ?? "");
  const [basePrice, setBasePrice] = useState(existing?.base_price ?? "");
  const [salePrice, setSalePrice] = useState(existing?.sale_price ?? "");
  const [isPublished, setIsPublished] = useState(existing?.is_published ?? false);

  const [images, setImages] = useState<ImageRow[]>(
    existing?.images.map((i) => ({ url: i.url, alt: i.alt ?? "" })) ?? [],
  );
  const [variants, setVariants] = useState<VariantRow[]>(
    existing?.variants.map((v) => ({
      id: v.id,
      sku: v.sku,
      size: v.size ?? "",
      color: v.color ?? "",
      color_hex: v.color_hex ?? "",
      price_override: v.price_override ?? "",
      stock_qty: String(v.stock_qty),
    })) ?? [emptyVariant()],
  );

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadNote, setUploadNote] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function effName(v: string) {
    setName(v);
    if (!slugTouched) setSlug(slugify(v));
  }

  async function onUpload(file: File) {
    setUploadNote("Uploading…");
    try {
      const url = await uploadImage(file);
      setImages((prev) => [...prev, { url, alt: name }]);
      setUploadNote(null);
    } catch (e) {
      setUploadNote(
        e instanceof ApiError && e.status === 503
          ? "Uploads aren't configured — paste an image URL below instead."
          : "Upload failed. Paste an image URL instead.",
      );
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!categoryId) {
      setError("Please choose a category.");
      return;
    }

    const payload: ProductWrite = {
      name,
      slug: slug || slugify(name),
      description: description || null,
      category_id: Number(categoryId),
      brand: brand || null,
      fabric: fabric || null,
      piece_count: pieceCount || null,
      base_price: basePrice || "0",
      sale_price: salePrice || null,
      is_published: isPublished,
      images: images
        .filter((i) => i.url.trim())
        .map((i, idx) => ({ url: i.url.trim(), alt: i.alt || null, sort_order: idx })),
      variants: variants
        .filter((v) => v.sku.trim())
        .map((v) => ({
          id: v.id,
          sku: v.sku.trim(),
          size: v.size || null,
          color: v.color || null,
          color_hex: v.color_hex || null,
          price_override: v.price_override || null,
          stock_qty: Number(v.stock_qty) || 0,
        })),
    };

    setSaving(true);
    try {
      if (existing) await updateProduct(existing.id, payload);
      else await createProduct(payload);
      router.push("/admin/products");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save product.");
      setSaving(false);
    }
  }

  const setVariant = (i: number, patch: Partial<VariantRow>) =>
    setVariants((prev) => prev.map((v, idx) => (idx === i ? { ...v, ...patch } : v)));

  return (
    <form onSubmit={onSubmit} className="max-w-3xl space-y-8">
      <h1 className="font-display text-4xl text-ink">
        {existing ? "Edit Product" : "New Product"}
      </h1>

      {/* Basics */}
      <section className="grid gap-4 sm:grid-cols-2">
        <L label="Name" full>
          <input className="ip" value={name} onChange={(e) => effName(e.target.value)} required />
        </L>
        <L label="Slug" full>
          <input
            className="ip"
            value={slug}
            onChange={(e) => {
              setSlug(e.target.value);
              setSlugTouched(true);
            }}
            required
          />
        </L>
        <L label="Category">
          <select
            className="ip"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : "")}
            required
          >
            <option value="">Select…</option>
            {(categories ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </L>
        <L label="Brand">
          <input className="ip" value={brand} onChange={(e) => setBrand(e.target.value)} />
        </L>
        <L label="Fabric">
          <input className="ip" value={fabric} onChange={(e) => setFabric(e.target.value)} />
        </L>
        <L label="Piece count">
          <input className="ip" value={pieceCount} onChange={(e) => setPieceCount(e.target.value)} />
        </L>
        <L label="Base price (PKR)">
          <input className="ip" type="number" min="0" value={basePrice} onChange={(e) => setBasePrice(e.target.value)} required />
        </L>
        <L label="Sale price (optional)">
          <input className="ip" type="number" min="0" value={salePrice} onChange={(e) => setSalePrice(e.target.value)} />
        </L>
        <L label="Description" full>
          <textarea className="ip min-h-24 resize-y" value={description} onChange={(e) => setDescription(e.target.value)} />
        </L>
      </section>

      <label className="flex items-center gap-3">
        <input type="checkbox" checked={isPublished} onChange={(e) => setIsPublished(e.target.checked)} className="h-4 w-4 accent-[var(--color-madder)]" />
        <span className="text-sm font-medium text-ink">Published (visible in storefront)</span>
      </label>

      {/* Images */}
      <section>
        <div className="flex items-center justify-between">
          <h2 className="eyebrow text-ink">Images</h2>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => fileRef.current?.click()} className="text-xs uppercase tracking-[0.12em] text-madder underline">
              Upload
            </button>
            <button type="button" onClick={() => setImages((p) => [...p, { url: "", alt: "" }])} className="text-xs uppercase tracking-[0.12em] text-ink underline">
              + Add URL
            </button>
          </div>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onUpload(f);
            e.target.value = "";
          }}
        />
        {uploadNote && <p className="mt-2 text-xs text-ink-soft">{uploadNote}</p>}
        <div className="mt-3 space-y-3">
          {images.map((img, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="relative h-16 w-12 shrink-0 overflow-hidden bg-paper-deep">
                {img.url && <Image src={img.url} alt="" fill sizes="48px" className="object-cover" />}
              </div>
              <input
                className="ip"
                placeholder="Image URL"
                value={img.url}
                onChange={(e) => setImages((p) => p.map((x, idx) => (idx === i ? { ...x, url: e.target.value } : x)))}
              />
              <button type="button" onClick={() => setImages((p) => p.filter((_, idx) => idx !== i))} className="shrink-0 text-xs text-ink-soft hover:text-madder">
                ✕
              </button>
            </div>
          ))}
          {images.length === 0 && <p className="text-sm text-ink-soft">No images yet.</p>}
        </div>
      </section>

      {/* Variants */}
      <section>
        <div className="flex items-center justify-between">
          <h2 className="eyebrow text-ink">Variants</h2>
          <button type="button" onClick={() => setVariants((p) => [...p, emptyVariant()])} className="text-xs uppercase tracking-[0.12em] text-ink underline">
            + Add variant
          </button>
        </div>
        <div className="mt-3 space-y-3">
          {variants.map((v, i) => (
            <div key={i} className="grid grid-cols-2 gap-2 border border-ink/10 bg-cream p-3 sm:grid-cols-6">
              <input className="ip" placeholder="SKU" value={v.sku} onChange={(e) => setVariant(i, { sku: e.target.value })} />
              <input className="ip" placeholder="Size" value={v.size} onChange={(e) => setVariant(i, { size: e.target.value })} />
              <input className="ip" placeholder="Color" value={v.color} onChange={(e) => setVariant(i, { color: e.target.value })} />
              <input className="ip" placeholder="#hex" value={v.color_hex} onChange={(e) => setVariant(i, { color_hex: e.target.value })} />
              <input className="ip" type="number" min="0" placeholder="Stock" value={v.stock_qty} onChange={(e) => setVariant(i, { stock_qty: e.target.value })} />
              <button type="button" onClick={() => setVariants((p) => p.filter((_, idx) => idx !== i))} className="text-xs text-ink-soft hover:text-madder">
                Remove
              </button>
            </div>
          ))}
        </div>
      </section>

      {error && <p className="border border-madder/40 bg-madder/10 p-3 text-sm text-madder">{error}</p>}

      <div className="flex gap-3">
        <button type="submit" disabled={saving} className="btn-ink disabled:bg-ink-soft/40">
          {saving ? "Saving…" : existing ? "Save Changes" : "Create Product"}
        </button>
        <button type="button" onClick={() => router.push("/admin/products")} className="px-5 text-sm uppercase tracking-[0.12em] text-ink-soft hover:text-madder">
          Cancel
        </button>
      </div>
    </form>
  );
}

function L({
  label,
  full = false,
  children,
}: {
  label: string;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={`block ${full ? "sm:col-span-2" : ""}`}>
      <span className="mb-1.5 block text-xs uppercase tracking-[0.12em] text-ink-soft">{label}</span>
      {children}
    </label>
  );
}
