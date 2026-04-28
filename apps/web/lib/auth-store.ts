"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { User } from "./types";

type AuthState = {
  token: string | null;
  user: User | null;
  expiresAt: string | null;
  setSession: (s: { token: string; user: User; expiresAt: string }) => void;
  clear: () => void;
  isAuthenticated: () => boolean;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      expiresAt: null,
      setSession: ({ token, user, expiresAt }) =>
        set({ token, user, expiresAt }),
      clear: () => set({ token: null, user: null, expiresAt: null }),
      isAuthenticated: () => {
        const { token, expiresAt } = get();
        if (!token) return false;
        if (!expiresAt) return true;
        return new Date(expiresAt).getTime() > Date.now();
      },
    }),
    {
      name: "esui-auth",
      storage: createJSONStorage(() => localStorage),
    }
  )
);

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return useAuthStore.getState().token;
  } catch {
    return null;
  }
}
