"use client";

/**
 * Auth state (Zustand). The access token is held in memory only (via
 * lib/api setAccessToken); the refresh token is an httpOnly cookie. On app
 * load we call /auth/refresh to silently restore the session.
 */

import { create } from "zustand";
import { setAccessToken } from "@/lib/api";
import * as authApi from "@/lib/auth";
import type { AuthUser } from "@/lib/auth";

type Status = "loading" | "authenticated" | "unauthenticated";

interface AuthState {
  status: Status;
  user: AuthUser | null;
  init: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: authApi.RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuth = create<AuthState>((set) => ({
  status: "loading",
  user: null,

  init: async () => {
    try {
      const res = await authApi.refresh();
      setAccessToken(res.access_token);
      set({ status: "authenticated", user: res.user });
    } catch {
      setAccessToken(null);
      set({ status: "unauthenticated", user: null });
    }
  },

  login: async (email, password) => {
    const res = await authApi.login(email, password);
    setAccessToken(res.access_token);
    set({ status: "authenticated", user: res.user });
  },

  register: async (payload) => {
    const res = await authApi.register(payload);
    setAccessToken(res.access_token);
    set({ status: "authenticated", user: res.user });
  },

  logout: async () => {
    try {
      await authApi.logout();
    } finally {
      setAccessToken(null);
      set({ status: "unauthenticated", user: null });
    }
  },
}));
