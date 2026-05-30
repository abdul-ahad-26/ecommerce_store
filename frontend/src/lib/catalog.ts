/** Catalog types (mirror the FastAPI schemas) and typed fetch helpers. */

import { apiFetch } from "./api";

export interface Category {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  parent_id: number | null;
  sort_order: number;
}

export interface ProductImage {
  id: number;
  url: string;
  alt: string | null;
  sort_order: number;
}

export interface ProductVariant {
  id: number;
  sku: string;
  size: string | null;
  color: string | null;
  color_hex: string | null;
  price: string;
  stock_qty: number;
  in_stock: boolean;
}

export interface ProductListItem {
  id: number;
  name: string;
  slug: string;
  brand: string | null;
  fabric: string | null;
  piece_count: string | null;
  base_price: string;
  sale_price: string | null;
  price: string;
  on_sale: boolean;
  in_stock: boolean;
  primary_image: string | null;
  category_slug: string;
  category_name: string;
}

export interface ProductDetail extends ProductListItem {
  description: string | null;
  category: Category;
  images: ProductImage[];
  variants: ProductVariant[];
  created_at: string;
}

export interface PaginatedProducts {
  items: ProductListItem[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface ProductQuery {
  category?: string;
  search?: string;
  brand?: string;
  size?: string;
  color?: string;
  min_price?: number;
  max_price?: number;
  sort?: "newest" | "price_asc" | "price_desc" | "name";
  page?: number;
  page_size?: number;
}

export function getCategories(): Promise<Category[]> {
  return apiFetch<Category[]>("/categories");
}

export function getCategory(slug: string): Promise<Category> {
  return apiFetch<Category>(`/categories/${slug}`);
}

export function getProducts(query: ProductQuery = {}): Promise<PaginatedProducts> {
  return apiFetch<PaginatedProducts>("/products", { params: { ...query } });
}

export function getProduct(slug: string): Promise<ProductDetail> {
  return apiFetch<ProductDetail>(`/products/${slug}`);
}
