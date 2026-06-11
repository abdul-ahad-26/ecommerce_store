"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { resetPassword } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { Motif } from "@/components/motif";

const schema = z
  .object({
    password: z.string().min(8, "At least 8 characters"),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    message: "Passwords do not match",
    path: ["confirm"],
  });
type Values = z.infer<typeof schema>;

export default function ResetPasswordPage() {
  const token = useSearchParams().get("token") ?? "";
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema) });

  async function onSubmit(values: Values) {
    setError(null);
    try {
      await resetPassword(token, values.password);
      setDone(true);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Could not reset your password. Request a new link.",
      );
    }
  }

  return (
    <div className="mx-auto max-w-md px-6 py-20">
      <div className="text-center">
        <Motif className="mx-auto h-12 w-12 text-gold" />
        <h1 className="mt-6 font-display text-4xl text-ink">New password</h1>
        <p className="mt-2 text-sm text-ink-soft">
          Choose a new password for your Meher account.
        </p>
      </div>

      {!token ? (
        <div className="mt-10 border border-madder/40 bg-madder/10 p-5 text-center text-sm text-madder">
          This reset link is missing its token.{" "}
          <Link href="/forgot-password" className="font-semibold underline">
            Request a new one
          </Link>
          .
        </div>
      ) : done ? (
        <div className="mt-10 border border-sage/40 bg-sage/10 p-5 text-center text-sm text-ink">
          Your password has been updated.{" "}
          <Link href="/login" className="font-semibold text-madder underline">
            Sign in
          </Link>
          .
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="mt-10 space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-xs uppercase tracking-[0.12em] text-ink-soft">
              New password
            </span>
            <input className="ip" type="password" {...register("password")} />
            {errors.password && (
              <span className="mt-1 block text-xs text-madder">
                {errors.password.message}
              </span>
            )}
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs uppercase tracking-[0.12em] text-ink-soft">
              Confirm password
            </span>
            <input className="ip" type="password" {...register("confirm")} />
            {errors.confirm && (
              <span className="mt-1 block text-xs text-madder">
                {errors.confirm.message}
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
            {isSubmitting ? "Updating…" : "Update password"}
          </button>
        </form>
      )}
    </div>
  );
}
