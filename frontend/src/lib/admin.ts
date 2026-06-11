/** Admin API types + helpers (all require the admin role). */

import { apiFetch } from "./api";

export interface AdminVariant {
  id?: number;
  sku: string;
  size: string | null;
  color: string | null;
  color_hex: string | null;
  price_override: string | null;
  stock_qty: number;
}

export interface AdminImage {
  id?: number;
  url: string;
  alt: string | null;
  sort_order: number;
}

export interface AdminProduct {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  category_id: number;
  brand: string | null;
  fabric: string | null;
  piece_count: string | null;
  base_price: string;
  sale_price: string | null;
  is_published: boolean;
  created_at: string;
  images: AdminImage[];
  variants: AdminVariant[];
}

export interface ProductWrite {
  name: string;
  slug: string;
  description?: string | null;
  category_id: number;
  brand?: string | null;
  fabric?: string | null;
  piece_count?: string | null;
  base_price: string;
  sale_price?: string | null;
  is_published: boolean;
  images: { url: string; alt?: string | null; sort_order?: number }[];
  variants: {
    id?: number;
    sku: string;
    size?: string | null;
    color?: string | null;
    color_hex?: string | null;
    price_override?: string | null;
    stock_qty: number;
  }[];
}

export interface AdminOrderSummary {
  order_number: string;
  customer_name: string;
  customer_phone: string;
  status: string;
  payment_status: string;
  total: string;
  item_count: number;
  placed_at: string;
}

export interface PaginatedAdminProducts {
  items: AdminProduct[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface AdminProductsQuery {
  page?: number;
  page_size?: number;
  q?: string;
  published?: boolean;
}

export interface PaginatedAdminOrders {
  items: AdminOrderSummary[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface AdminOrdersQuery {
  page?: number;
  page_size?: number;
  status?: string;
  q?: string;
}

export interface DashboardStats {
  total_orders: number;
  pending_orders: number;
  revenue: string;
  total_products: number;
  published_products: number;
  low_stock_variants: number;
  recent_orders: AdminOrderSummary[];
}

export interface CategoryWrite {
  name: string;
  slug: string;
  description?: string | null;
  image_url?: string | null;
  parent_id?: number | null;
  sort_order?: number;
}

export interface UploadSignature {
  cloud_name: string;
  api_key: string;
  timestamp: number;
  signature: string;
  folder: string;
}

/**
 * Upload an image to Cloudinary using a backend-signed request.
 * Throws ApiError(503) if Cloudinary isn't configured — callers should then
 * fall back to pasting an image URL.
 */
export async function uploadImage(file: File): Promise<string> {
  const sig = await apiFetch<UploadSignature>("/admin/uploads/signature");
  const form = new FormData();
  form.append("file", file);
  form.append("api_key", sig.api_key);
  form.append("timestamp", String(sig.timestamp));
  form.append("signature", sig.signature);
  form.append("folder", sig.folder);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${sig.cloud_name}/image/upload`,
    { method: "POST", body: form },
  );
  if (!res.ok) throw new Error("Cloudinary upload failed");
  const data = (await res.json()) as { secure_url: string };
  return data.secure_url;
}

export const ORDER_STATUSES = [
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
] as const;

// --- Dashboard ---
export const getStats = () => apiFetch<DashboardStats>("/admin/stats");

// --- Products ---
export const listAdminProducts = (params: AdminProductsQuery = {}) =>
  apiFetch<PaginatedAdminProducts>("/admin/products", { params: { ...params } });
export const getAdminProduct = (id: number) =>
  apiFetch<AdminProduct>(`/admin/products/${id}`);
export const createProduct = (payload: ProductWrite) =>
  apiFetch<AdminProduct>("/admin/products", {
    method: "POST",
    body: JSON.stringify(payload),
  });
export const updateProduct = (id: number, payload: ProductWrite) =>
  apiFetch<AdminProduct>(`/admin/products/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
export const deleteProduct = (id: number) =>
  apiFetch<void>(`/admin/products/${id}`, { method: "DELETE" });

// --- Categories ---
export const createCategory = (payload: CategoryWrite) =>
  apiFetch("/admin/categories", {
    method: "POST",
    body: JSON.stringify(payload),
  });
export const updateCategory = (id: number, payload: CategoryWrite) =>
  apiFetch(`/admin/categories/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
export const deleteCategory = (id: number) =>
  apiFetch<void>(`/admin/categories/${id}`, { method: "DELETE" });

// --- Orders ---
// Server-side pagination + filters so search/status work across the full
// order history, not just one page.
export const listAdminOrders = (params: AdminOrdersQuery = {}) =>
  apiFetch<PaginatedAdminOrders>("/admin/orders", { params: { ...params } });
export const updateOrderStatus = (orderNumber: string, status: string) =>
  apiFetch<AdminOrderSummary>(`/admin/orders/${orderNumber}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
