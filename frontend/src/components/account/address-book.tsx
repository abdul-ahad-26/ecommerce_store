"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  createAddress,
  deleteAddress,
  listAddresses,
  updateAddress,
  type Address,
} from "@/lib/addresses";

const PROVINCES = [
  "Punjab",
  "Sindh",
  "Khyber Pakhtunkhwa",
  "Balochistan",
  "Islamabad Capital Territory",
  "Gilgit-Baltistan",
  "Azad Kashmir",
];

const schema = z.object({
  recipient_name: z.string().min(1, "Required"),
  phone: z.string().min(7, "Enter a valid phone"),
  line1: z.string().min(1, "Required"),
  line2: z.string().optional(),
  city: z.string().min(1, "Required"),
  province: z.string().min(1),
  postal_code: z.string().optional(),
});
type Values = z.infer<typeof schema>;

export function AddressBook() {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["addresses"],
    queryFn: listAddresses,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["addresses"] });

  const createMut = useMutation({
    mutationFn: createAddress,
    onSuccess: () => {
      invalidate();
      setAdding(false);
    },
  });
  const deleteMut = useMutation({ mutationFn: deleteAddress, onSuccess: invalidate });
  const defaultMut = useMutation({
    mutationFn: (id: number) => updateAddress(id, { is_default: true }),
    onSuccess: invalidate,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { province: "Punjab" },
  });

  function onAdd(values: Values) {
    createMut.mutate(values, { onSuccess: () => reset() });
  }

  if (isLoading) {
    return <p className="text-sm text-ink-soft">Loading addresses…</p>;
  }

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2">
        {(data ?? []).map((addr: Address) => (
          <div key={addr.id} className="border border-ink/10 bg-cream p-5">
            <div className="flex items-start justify-between">
              <p className="font-medium text-ink">{addr.recipient_name}</p>
              {addr.is_default && (
                <span className="bg-ink px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-cream">
                  Default
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-ink-soft">{addr.phone}</p>
            <p className="mt-2 text-sm text-ink-soft">
              {addr.line1}
              {addr.line2 ? `, ${addr.line2}` : ""}
              <br />
              {addr.city}, {addr.province}
              {addr.postal_code ? ` ${addr.postal_code}` : ""}
            </p>
            <div className="mt-4 flex gap-4 text-xs uppercase tracking-[0.12em]">
              {!addr.is_default && (
                <button
                  onClick={() => defaultMut.mutate(addr.id)}
                  className="text-ink underline hover:text-madder"
                >
                  Set default
                </button>
              )}
              <button
                onClick={() => deleteMut.mutate(addr.id)}
                className="text-ink-soft underline hover:text-madder"
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>

      {!adding ? (
        <button onClick={() => setAdding(true)} className="btn-ink mt-6">
          + Add Address
        </button>
      ) : (
        <form
          onSubmit={handleSubmit(onAdd)}
          className="mt-6 border border-ink/10 bg-cream p-6"
        >
          <h3 className="eyebrow mb-4 text-ink">New Address</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <F label="Recipient name" err={errors.recipient_name?.message}>
              <input className="ip" {...register("recipient_name")} />
            </F>
            <F label="Phone" err={errors.phone?.message}>
              <input className="ip" inputMode="tel" {...register("phone")} />
            </F>
            <F label="Address" err={errors.line1?.message} full>
              <input className="ip" {...register("line1")} />
            </F>
            <F label="Apartment, landmark (optional)" full>
              <input className="ip" {...register("line2")} />
            </F>
            <F label="City" err={errors.city?.message}>
              <input className="ip" {...register("city")} />
            </F>
            <F label="Province">
              <select className="ip" {...register("province")}>
                {PROVINCES.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </F>
            <F label="Postal code (optional)">
              <input className="ip" {...register("postal_code")} />
            </F>
          </div>

          {createMut.isError && (
            <p className="mt-4 text-sm text-madder">
              Couldn&apos;t save the address. Please try again.
            </p>
          )}

          <div className="mt-5 flex gap-3">
            <button
              type="submit"
              disabled={createMut.isPending}
              className="btn-ink disabled:bg-ink-soft/40"
            >
              {createMut.isPending ? "Saving…" : "Save Address"}
            </button>
            <button
              type="button"
              onClick={() => {
                setAdding(false);
                reset();
              }}
              className="px-5 text-sm uppercase tracking-[0.12em] text-ink-soft hover:text-madder"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function F({
  label,
  err,
  full = false,
  children,
}: {
  label: string;
  err?: string;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={`block ${full ? "sm:col-span-2" : ""}`}>
      <span className="mb-1.5 block text-xs uppercase tracking-[0.12em] text-ink-soft">
        {label}
      </span>
      {children}
      {err && <span className="mt-1 block text-xs text-madder">{err}</span>}
    </label>
  );
}
