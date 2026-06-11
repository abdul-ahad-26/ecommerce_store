"use client";

import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { forgotPassword } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { Motif } from "@/components/motif";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
});
type Values = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema) });

  async function onSubmit(values: Values) {
    setError(null);
    try {
      await forgotPassword(values.email);
      setSent(true);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Something went wrong. Please try again.",
      );
    }
  }

  return (
    <div className="mx-auto max-w-md px-6 py-20">
      <div className="text-center">
        <Motif className="mx-auto h-12 w-12 text-gold" />
        <h1 className="mt-6 font-display text-4xl text-ink">Reset password</h1>
        <p className="mt-2 text-sm text-ink-soft">
          Enter your email and we&apos;ll send you a link to set a new password.
        </p>
      </div>

      {sent ? (
        <div className="mt-10 border border-sage/40 bg-sage/10 p-5 text-center text-sm text-ink">
          If an account exists for that email, a reset link is on its way. Check
          your inbox (and spam folder).
        </div>
      ) : (
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
            {isSubmitting ? "Sending…" : "Send reset link"}
          </button>
        </form>
      )}

      <p className="mt-6 text-center text-sm text-ink-soft">
        Remembered it?{" "}
        <Link href="/login" className="font-semibold text-madder underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
