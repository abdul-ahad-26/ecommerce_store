/** Saved-address types and CRUD helpers (all require auth). */

import { apiFetch } from "./api";

export interface Address {
  id: number;
  recipient_name: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  province: string;
  postal_code: string | null;
  is_default: boolean;
}

export type AddressInput = Omit<Address, "id">;

export function listAddresses(): Promise<Address[]> {
  return apiFetch<Address[]>("/addresses");
}

export function createAddress(payload: Partial<AddressInput>): Promise<Address> {
  return apiFetch<Address>("/addresses", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateAddress(
  id: number,
  payload: Partial<AddressInput>,
): Promise<Address> {
  return apiFetch<Address>(`/addresses/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function deleteAddress(id: number): Promise<void> {
  return apiFetch<void>(`/addresses/${id}`, { method: "DELETE" });
}
