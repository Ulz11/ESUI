"use client";

/* V3 design primitives — small, reusable. */

import { type CSSProperties, type ReactNode, useState } from "react";

import type { Mode } from "@/lib/types";

// ─── Mode pill (Ulzii / Obama) ──────────────────────────────────────────────

export function ModePill({
  mode,
  size = "md",
  muted = false,
}: {
  mode: Mode;
  size?: "xs" | "md";
  muted?: boolean;
}) {
  const isUlzii = mode === "ulzii";
  const c = isUlzii ? "var(--sky)" : "var(--forest)";
  const bg = isUlzii ? "var(--sky-soft)" : "var(--forest-soft)";
  const dot = (
    <span
      style={{
        width: 6,
        height: 6,
        borderRadius: 3,
        background: c,
        boxShadow: muted
          ? "none"
          : `0 0 0 3px ${isUlzii ? "rgba(74,140,173,.18)" : "rgba(58,106,81,.18)"}`,
      }}
    />
  );
  if (size === "xs") {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          fontSize: 11,
          color: "var(--ink-50)",
          letterSpacing: ".02em",
        }}
      >
        {dot}
        <span>{isUlzii ? "ulzii" : "obama"}</span>
      </span>
    );
  }
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "3px 9px 3px 7px",
        borderRadius: 100,
        background: bg,
        color: isUlzii ? "var(--sky-deep)" : "var(--forest-deep)",
        fontSize: 12,
        letterSpacing: ".01em",
      }}
    >
      {dot}
      <span style={{ fontWeight: 500 }}>{isUlzii ? "Ulzii" : "Obama"}</span>
    </span>
  );
}

// ─── Hairline rule with optional label ──────────────────────────────────────

export function Rule({
  label,
  style,
}: {
  label?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        color: "var(--ink-35)",
        ...style,
      }}
    >
      <span style={{ flex: 1, height: 1, background: "var(--rule)" }} />
      {label && (
        <span
          style={{
            fontSize: 11,
            letterSpacing: ".08em",
            textTransform: "uppercase",
          }}
        >
          {label}
        </span>
      )}
      {label && <span style={{ flex: 1, height: 1, background: "var(--rule)" }} />}
    </div>
  );
}

// ─── Section title (small caps) ─────────────────────────────────────────────

export function SectionTitle({
  children,
  right,
  style,
}: {
  children: ReactNode;
  right?: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        marginBottom: 14,
        ...style,
      }}
    >
      <div
        style={{
          fontSize: 11,
          letterSpacing: ".14em",
          textTransform: "uppercase",
          color: "var(--ink-50)",
          fontWeight: 500,
        }}
      >
        {children}
      </div>
      {right}
    </div>
  );
}

// ─── Ghost button ───────────────────────────────────────────────────────────

export function GhostBtn({
  children,
  onClick,
  active,
  style,
  title,
}: {
  children: ReactNode;
  onClick?: () => void;
  active?: boolean;
  style?: CSSProperties;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        padding: "6px 10px",
        borderRadius: 8,
        fontSize: 12.5,
        color: active ? "var(--ink)" : "var(--ink-50)",
        background: active ? "var(--ink-06)" : "transparent",
        letterSpacing: ".005em",
        transition: "background .15s, color .15s",
        ...style,
      }}
      onMouseEnter={(e) => {
        if (!active) (e.currentTarget as HTMLButtonElement).style.color = "var(--ink)";
      }}
      onMouseLeave={(e) => {
        if (!active) (e.currentTarget as HTMLButtonElement).style.color = "var(--ink-50)";
      }}
    >
      {children}
    </button>
  );
}

// ─── Tag chip (user vs ai) ──────────────────────────────────────────────────

export function Tag({
  children,
  ai,
  onClick,
}: {
  children: ReactNode;
  ai?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "2px 8px",
        borderRadius: 100,
        fontSize: 11.5,
        letterSpacing: ".005em",
        background: "transparent",
        border: "1px solid var(--rule)",
        color: ai ? "var(--ink-50)" : "var(--ink-70)",
        fontStyle: ai ? "italic" : "normal",
      }}
    >
      {children}
    </button>
  );
}

// ─── Empty state ────────────────────────────────────────────────────────────

export function Empty({
  children,
  style,
}: {
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        padding: "48px 24px",
        textAlign: "center",
        color: "var(--ink-50)",
        fontFamily: "var(--serif)",
        fontSize: 16,
        fontStyle: "italic",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ─── Provider / intent chip ─────────────────────────────────────────────────

export function ProviderChip({
  provider,
  intent,
  model,
}: {
  provider: string;
  intent?: string;
  model?: string;
}) {
  return (
    <span
      title={model}
      style={{
        fontSize: 11,
        color: "var(--ink-35)",
        letterSpacing: ".005em",
        fontFamily: "var(--mono)",
      }}
    >
      {provider}
      {intent ? ` · ${intent}` : ""}
    </span>
  );
}

// ─── Skeleton bar ───────────────────────────────────────────────────────────

export function Skel({
  w = "100%",
  h = 12,
  style,
}: {
  w?: string | number;
  h?: number;
  style?: CSSProperties;
}) {
  return (
    <span
      style={{
        display: "inline-block",
        width: w,
        height: h,
        borderRadius: 4,
        background:
          "linear-gradient(90deg, rgba(26,29,44,.05), rgba(26,29,44,.10), rgba(26,29,44,.05))",
        backgroundSize: "200% 100%",
        animation: "shimmer 1.6s ease infinite",
        ...style,
      }}
    />
  );
}

// ─── Cursor for streaming text ──────────────────────────────────────────────

export function Cursor() {
  return (
    <span
      aria-hidden="true"
      style={{
        display: "inline-block",
        width: 7,
        height: "1em",
        background: "currentColor",
        marginLeft: 2,
        verticalAlign: "-2px",
        animation: "blink 1.1s step-start infinite",
        opacity: 0.7,
      }}
    />
  );
}

// ─── Avatar ─────────────────────────────────────────────────────────────────

export function Avatar({
  name = "E",
  color = "var(--ink-2)",
  size = 26,
  ring,
}: {
  name?: string;
  color?: string;
  size?: number;
  ring?: string;
}) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        display: "grid",
        placeItems: "center",
        background: color,
        color: "var(--paper)",
        fontFamily: "var(--serif)",
        fontStyle: "italic",
        fontSize: size * 0.45,
        letterSpacing: "-.02em",
        boxShadow: ring ? `0 0 0 2px ${ring}` : "none",
      }}
    >
      {name}
    </div>
  );
}

// ─── Reusable card surface ──────────────────────────────────────────────────

export function Surface({
  children,
  style,
  soft,
}: {
  children: ReactNode;
  style?: CSSProperties;
  soft?: boolean;
}) {
  return (
    <div
      style={{
        background: soft ? "transparent" : "var(--surface)",
        border: soft ? "1px dashed var(--rule)" : "1px solid var(--rule)",
        borderRadius: "var(--r-lg)",
        boxShadow: soft ? "none" : "var(--shadow-paper)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ─── tiny live-clock hook (used by Home, settings, etc.) ────────────────────

export function useNow(intervalMs = 1000): Date {
  const [now, setNow] = useState<Date>(() => new Date());
  useEffectClock(setNow, intervalMs);
  return now;
}

// kept tiny + hook-rule-friendly
import { useEffect } from "react";
function useEffectClock(setNow: (d: Date) => void, intervalMs: number) {
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [setNow, intervalMs]);
}
