"use client";

/**
 * V3App — Next.js wrapper around Claude-Design's V3 Shell.
 *
 * Bridges the prototype's "tweaks" prop API to real auth, route, and theme
 * state. Persists theme and route locally so reloads land where you left off.
 */

import { useEffect, useMemo, useState } from "react";

import { useAuthStore } from "@/lib/auth-store";
import type { Mode } from "@/lib/types";

// @ts-expect-error — V3 prototype is .jsx (untyped); we add types at the boundary
import { Shell } from "./shell";

export type V3Route =
  | "home" | "chat" | "calendar" | "vault" | "beauty" | "signals" | "exam";
type Theme = "light" | "dark";
type Role = "esui" | "badrushk";

const LS_THEME = "esui:v3:theme";

export function V3App({ initialRoute }: { initialRoute?: V3Route }) {
  const user = useAuthStore((s) => s.user);

  // Default to Esui's preferred mode if available, else Ulzii.
  const initialMode: Mode = (user?.default_mode as Mode) ?? "ulzii";

  const [mode, setMode] = useState<Mode>(initialMode);
  const [route, setRoute] = useState<V3Route>(initialRoute ?? "home");
  const [theme, setTheme] = useState<Theme>(() => readLS(LS_THEME, "light") as Theme);

  // Persist theme on change
  useEffect(() => {
    writeLS(LS_THEME, theme);
    if (typeof document !== "undefined") {
      document.documentElement.dataset.theme = theme;
    }
  }, [theme]);

  // Sync mode to user's persisted default_mode whenever it changes.
  useEffect(() => {
    if (user?.default_mode) setMode(user.default_mode as Mode);
  }, [user?.default_mode]);

  // The role drives Shell's nav: badrushk only sees Beauty.
  const role: Role = (user?.role as Role) ?? "esui";

  // Tweaks-style API expected by the prototype Shell
  const tweaks = useMemo(
    () => ({ mode, route, role, theme }),
    [mode, route, role, theme],
  );

  const setTweak = (key: keyof typeof tweaks, value: string) => {
    if (key === "mode") setMode(value as Mode);
    else if (key === "route") setRoute(value as V3Route);
    else if (key === "theme") setTheme(value as Theme);
    // role is read-only from auth; ignore writes.
  };

  return <Shell tweaks={tweaks} setTweak={setTweak} />;
}

// ─── helpers ────────────────────────────────────────────────────────────────

function readLS(key: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  try {
    return window.localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function writeLS(key: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}
