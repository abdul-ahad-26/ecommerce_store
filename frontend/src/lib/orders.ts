/** Order types (mirror FastAPI schemas) and checkout/lookup helpers. */

import { apiFetch } from "./api";

export interface CheckoutItem {
  variant_id: number;
  qty: number;
}

export interface CheckoutRequest {
  items: CheckoutItem[];
  customer_name: string;
  customer_phone: string;
  customer_email?: string | null;
  shipping_line1: string;
  shipping_line2?: string | null;
  shipping_city: string;
  shipping_province: string;
  shipping_postal_code?: string | null;
  notes?: string | null;
}

export interface OrderItem {
  product_name: string;
  variant_label: string | null;
  unit_price: string;
  qty: number;
  line_total: string;
}

export interface Order {
  order_number: string;
  status: string;
  payment_method: string;
  payment_status: string;
  subtotal: string;
  shipping_fee: string;
  discount: string;
  total: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  shipping_line1: string;
  shipping_line2: string | null;
  shipping_city: string;
  shipping_province: string;
  shipping_postal_code: string | null;
  notes: string | null;
  placed_at: string;
  items: OrderItem[];
}

export interface OrderSummary {
  order_number: string;
  status: string;
  total: string;
  item_count: number;
  placed_at: string;
}

// Shipping rule — mirrors the backend (free over Rs 5,000, else Rs 200).
export const FREE_SHIPPING_THRESHOLD = 5000;
export const SHIPPING_FEE = 200;

export function estimateShipping(subtotal: number): number {
  return subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;
}

export function placeOrder(payload: CheckoutRequest): Promise<Order> {
  return apiFetch<Order>("/orders", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getOrder(orderNumber: string): Promise<Order> {
  return apiFetch<Order>(`/orders/${orderNumber}`);
}

export function listMyOrders(): Promise<OrderSummary[]> {
  return apiFetch<OrderSummary[]>("/orders");
}
