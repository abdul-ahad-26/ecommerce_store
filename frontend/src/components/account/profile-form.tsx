"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/store/auth";
import { updateProfile, changePassword } from "@/lib/auth";
import { ApiError } from "@/lib/api";

const profileSchema = z.object({
  full_name: z.string().min(1, "Required"),
  phone: z.string().optional(),
});
type ProfileValues = z.infer<typeof profileSchema>;

const passwordSchema = z
  .object({
    current_password: z.string().min(1, "Required"),
    new_password: z.string().min(8, "At least 8 characters"),
    confirm: z.string(),
  })
  .refine((v) => v.new_password === v.confirm, {
    message: "Passwords do not match",
    path: ["confirm"],
  });
type PasswordValues = z.infer<typeof passwordSchema>;

export function ProfileForm() {
  const user = useAuth((s) => s.user);
  const setUser = useAuth((s) => s.setUser);
  const [profileMsg, setProfileMsg] = useState<string | null>(null);
  const [pwMsg, setPwMsg] = useState<string | null>(null);
  const [pwError, setPwError] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  const profileForm = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      full_name: user?.full_name ?? "",
      phone: user?.phone ?? "",
    },
  });

  const passwordForm = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
  });

  async function onSaveProfile(values: ProfileValues) {
    setProfileMsg(null);
    setProfileError(null);
    try {
      const updated = await updateProfile({
        full_name: values.full_name,
        phone: values.phone || null,
      });
      setUser(updated);
      setProfileMsg("Profile updated.");
    } catch (err) {
      setProfileError(
        err instanceof ApiError ? err.message : "Could not save. Try again.",
      );
    }
  }

  async function onChangePassword(values: PasswordValues) {
    setPwMsg(null);
    setPwError(null);
    try {
      await changePassword(values.current_password, values.new_password);
      passwordForm.reset();
      setPwMsg("Password changed.");
    } catch (err) {
      setPwError(
        err instanceof ApiError
          ? err.message
          : "Could not change password. Try again.",
      );
    }
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Profile details */}
      <form
        onSubmit={profileForm.handleSubmit(onSaveProfile)}
        className="border border-ink/10 bg-cream p-6"
      >
        <h3 className="eyebrow mb-4 text-ink">Your details</h3>
        <label className="block">
          <span className="mb-1.5 block text-xs uppercase tracking-[0.12em] text-ink-soft">
            Full name
          </span>
          <input className="ip" {...profileForm.register("full_name")} />
          {profileForm.formState.errors.full_name && (
            <span className="mt-1 block text-xs text-madder">
              {profileForm.formState.errors.full_name.message}
            </span>
          )}
        </label>
        <label className="mt-4 block">
          <span className="mb-1.5 block text-xs uppercase tracking-[0.12em] text-ink-soft">
            Phone
          </span>
          <input className="ip" inputMode="tel" {...profileForm.register("phone")} />
        </label>
        <p className="mt-4 text-xs text-ink-soft">
          Email: <span className="text-ink">{user?.email}</span>
        </p>

        {profileError && (
          <p className="mt-4 text-sm text-madder">{profileError}</p>
        )}
        {profileMsg && <p className="mt-4 text-sm text-sage">{profileMsg}</p>}

        <button
          type="submit"
          disabled={profileForm.formState.isSubmitting}
          className="btn-ink mt-5 disabled:bg-ink-soft/40"
        >
          {profileForm.formState.isSubmitting ? "Saving…" : "Save changes"}
        </button>
      </form>

      {/* Change password */}
      <form
        onSubmit={passwordForm.handleSubmit(onChangePassword)}
        className="border border-ink/10 bg-cream p-6"
      >
        <h3 className="eyebrow mb-4 text-ink">Change password</h3>
        <label className="block">
          <span className="mb-1.5 block text-xs uppercase tracking-[0.12em] text-ink-soft">
            Current password
          </span>
          <input
            className="ip"
            type="password"
            {...passwordForm.register("current_password")}
          />
          {passwordForm.formState.errors.current_password && (
            <span className="mt-1 block text-xs text-madder">
              {passwordForm.formState.errors.current_password.message}
            </span>
          )}
        </label>
        <label className="mt-4 block">
          <span className="mb-1.5 block text-xs uppercase tracking-[0.12em] text-ink-soft">
            New password
          </span>
          <input
            className="ip"
            type="password"
            {...passwordForm.register("new_password")}
          />
          {passwordForm.formState.errors.new_password && (
            <span className="mt-1 block text-xs text-madder">
              {passwordForm.formState.errors.new_password.message}
            </span>
          )}
        </label>
        <label className="mt-4 block">
          <span className="mb-1.5 block text-xs uppercase tracking-[0.12em] text-ink-soft">
            Confirm new password
          </span>
          <input
            className="ip"
            type="password"
            {...passwordForm.register("confirm")}
          />
          {passwordForm.formState.errors.confirm && (
            <span className="mt-1 block text-xs text-madder">
              {passwordForm.formState.errors.confirm.message}
            </span>
          )}
        </label>

        {pwError && <p className="mt-4 text-sm text-madder">{pwError}</p>}
        {pwMsg && <p className="mt-4 text-sm text-sage">{pwMsg}</p>}

        <button
          type="submit"
          disabled={passwordForm.formState.isSubmitting}
          className="btn-ink mt-5 disabled:bg-ink-soft/40"
        >
          {passwordForm.formState.isSubmitting ? "Updating…" : "Update password"}
        </button>
      </form>
    </div>
  );
}
