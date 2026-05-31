"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/store/auth";
import { ApiError } from "@/lib/api";
import { Motif } from "@/components/motif";

const schema = z.object({
  full_name: z.string().min(1, "Required"),
  email: z.string().email("Enter a valid email"),
  phone: z.string().optional(),
  password: z.string().min(8, "At least 8 characters"),
});
type Values = z.infer<typeof schema>;

export default function RegisterPage() {
  const router = useRouter();
  const registerUser = useAuth((s) => s.register);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema) });

  async function onSubmit(values: Values) {
    setError(null);
    try {
      await registerUser({
        full_name: values.full_name,
        email: values.email,
        phone: values.phone || null,
        password: values.password,
      });
      router.push("/account");
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Could not create your account. Try again.",
      );
    }
  }

  return (
    <div className="mx-auto max-w-md px-6 py-20">
      <div className="text-center">
        <Motif className="mx-auto h-12 w-12 text-gold" />
        <h1 className="mt-6 font-display text-4xl text-ink">Create account</h1>
        <p className="mt-2 text-sm text-ink-soft">
          Save your details for faster checkout.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-10 space-y-4">
        <Field label="Full name" error={errors.full_name?.message}>
          <input className="ip" {...register("full_name")} />
        </Field>
        <Field label="Email" error={errors.email?.message}>
          <input className="ip" type="email" {...register("email")} />
        </Field>
        <Field label="Phone (optional)" error={errors.phone?.message}>
          <input className="ip" inputMode="tel" {...register("phone")} />
        </Field>
        <Field label="Password" error={errors.password?.message}>
          <input className="ip" type="password" {...register("password")} />
        </Field>

        {error && (
          <p className="border border-madder/40 bg-madder/10 p-3 text-sm text-madder">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="btn-ink w-full disabled:bg-ink-soft/40"
        >
          {isSubmitting ? "Creating…" : "Create Account"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-soft">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-madder underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs uppercase tracking-[0.12em] text-ink-soft">
        {label}
      </span>
      {children}
      {error && <span className="mt-1 block text-xs text-madder">{error}</span>}
    </label>
  );
}
