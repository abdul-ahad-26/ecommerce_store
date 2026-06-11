"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/store/auth";
import { ApiError } from "@/lib/api";
import { Motif } from "@/components/motif";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Required"),
});
type Values = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const next = useSearchParams().get("next") || "/account";
  const login = useAuth((s) => s.login);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema) });

  async function onSubmit(values: Values) {
    setError(null);
    try {
      await login(values.email, values.password);
      router.push(next);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Could not sign in. Try again.",
      );
    }
  }

  return (
    <div className="mx-auto max-w-md px-6 py-20">
      <div className="text-center">
        <Motif className="mx-auto h-12 w-12 text-gold" />
        <h1 className="mt-6 font-display text-4xl text-ink">Welcome back</h1>
        <p className="mt-2 text-sm text-ink-soft">
          Sign in to view your orders and addresses.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-10 space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-xs uppercase tracking-[0.12em] text-ink-soft">
            Email
          </span>
          <input className="ip" type="email" {...register("email")} />
          {errors.email && (
            <span className="mt-1 block text-xs text-madder">
              {errors.email.message}
            </span>
          )}
        </label>

        <label className="block">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-xs uppercase tracking-[0.12em] text-ink-soft">
              Password
            </span>
            <Link
              href="/forgot-password"
              className="text-xs text-madder hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <input className="ip" type="password" {...register("password")} />
          {errors.password && (
            <span className="mt-1 block text-xs text-madder">
              {errors.password.message}
            </span>
          )}
        </label>

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
          {isSubmitting ? "Signing in…" : "Sign In"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-soft">
        New to Meher?{" "}
        <Link href="/register" className="font-semibold text-madder underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}
