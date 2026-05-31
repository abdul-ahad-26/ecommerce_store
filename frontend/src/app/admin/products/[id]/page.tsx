"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { getAdminProduct } from "@/lib/admin";
import { ProductForm } from "@/components/admin/product-form";

export default function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const productId = Number(id);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin", "products", productId],
    queryFn: () => getAdminProduct(productId),
  });

  if (isLoading) return <p className="text-sm text-ink-soft">Loading product…</p>;
  if (isError || !data)
    return <p className="text-sm text-madder">Product not found.</p>;

  return <ProductForm existing={data} />;
}
