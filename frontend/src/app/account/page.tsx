"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/store/auth";
import { OrderHistory } from "@/components/account/order-history";
import { AddressBook } from "@/components/account/address-book";
import { SectionLabel } from "@/components/section-label";

export default function AccountPage() {
  const router = useRouter();
  const status = useAuth((s) => s.status);
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);

  // Redirect to login once we know the session isn't valid.
  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login?next=/account");
    }
  }, [status, router]);

  if (status !== "authenticated" || !user) {
    return (
      <div className="mx-auto max-w-[1100px] px-6 py-24 text-center text-ink-soft">
        Loading your account…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1100px] px-6 py-14">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <SectionLabel index="—">My Account</SectionLabel>
          <h1 className="mt-4 font-display text-5xl text-ink">
            {user.full_name.split(" ")[0]}
          </h1>
          <p className="mt-1 text-sm text-ink-soft">{user.email}</p>
        </div>
        <button
          onClick={async () => {
            await logout();
            router.push("/");
          }}
          className="text-xs uppercase tracking-[0.14em] text-ink-soft underline hover:text-madder"
        >
          Sign out
        </button>
      </div>

      <section className="mt-14">
        <h2 className="eyebrow mb-6 text-ink">Order History</h2>
        <OrderHistory />
      </section>

      <section className="mt-16">
        <h2 className="eyebrow mb-6 text-ink">Saved Addresses</h2>
        <AddressBook />
      </section>
    </div>
  );
}
