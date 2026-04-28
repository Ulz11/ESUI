"use client";

import { useState } from "react";
import type { Mode } from "@/lib/types";

const ACCENT: Record<string, string> = {
  chat: "#5b9ab8",
  vault: "#2e3360",
  exam: "#3e6f54",
  signals: "#8c6b3a",
  together: "#b05068",
};

type RouteId = "home" | "chat" | "vault" | "exam" | "signals" | "together";

function NavPill({
  id,
  label,
  active,
  onClick,
}: {
  id: string;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  const [hov, setHov] = useState(false);
  const col = ACCENT[id] || "#888";

  return (
    <button
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "7px 16px",
        borderRadius: 22,
        fontSize: 13.5,
        fontWeight: active ? 600 : 400,
        background: active ? col : hov ? col + "18" : "transparent",
        color: active ? "#fff" : hov ? col : "var(--navy-45)",
        cursor: "pointer",
        transition: "all .15s ease",
        letterSpacing: active ? "-.01em" : "0",
        boxShadow: active ? `0 2px 12px ${col}44` : "none",
      }}
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
    >
      {label}
    </button>
  );
}

function NavIconBtn({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  const [hov, setHov] = useState(false);
  return (
    <button
      style={{
        ...nS.iconBtn,
        background: hov ? "var(--page)" : "var(--surface)",
        transform: hov ? "scale(1.05)" : "none",
        transition: "all .12s",
      }}
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
    >
      {children}
    </button>
  );
}

export function TopNav({
  route,
  onNavigate,
  mode,
  setMode,
  onSettings,
  userInitial,
}: {
  route: RouteId;
  onNavigate: (r: RouteId) => void;
  mode: Mode;
  setMode: (m: Mode) => void;
  onSettings: () => void;
  userInitial: string;
}) {
  const ITEMS: Array<{ id: RouteId; label: string }> = [
    { id: "chat", label: "Chat" },
    { id: "vault", label: "Vault" },
    { id: "exam", label: "Exam" },
    { id: "signals", label: "Signals" },
    { id: "together", label: "Together" },
  ];

  return (
    <nav style={nS.nav}>
      <button style={nS.wordmark} onClick={() => onNavigate("home")}>
        ESUI
      </button>

      <div style={nS.divider} />

      <div style={nS.pills}>
        {ITEMS.map((item) => (
          <NavPill
            key={item.id}
            id={item.id}
            label={item.label}
            active={route === item.id}
            onClick={() => onNavigate(item.id)}
          />
        ))}
      </div>

      <div style={nS.right}>
        <div style={nS.modeWrap}>
          {(
            [
              ["ulzii", "Ulzii"],
              ["obama", "Obama"],
            ] as const
          ).map(([id, label]) => {
            const col = id === "ulzii" ? "#5b9ab8" : "#3e6f54";
            const active = mode === id;
            return (
              <button
                key={id}
                style={{
                  ...nS.modeBtn,
                  background: active ? col : "transparent",
                  color: active ? "#fff" : "var(--navy-45)",
                  boxShadow: active ? `0 1px 8px ${col}44` : "none",
                }}
                onClick={() => setMode(id)}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: active ? "rgba(255,255,255,.7)" : col,
                    display: "inline-block",
                    flexShrink: 0,
                  }}
                />
                {label}
              </button>
            );
          })}
        </div>

        <NavIconBtn onClick={onSettings}>
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
            <circle
              cx="7.5"
              cy="7.5"
              r="2.3"
              stroke="currentColor"
              strokeWidth="1.25"
            />
            <path
              d="M7.5 1.5v1.8M7.5 11.7v1.8M1.5 7.5h1.8M11.7 7.5h1.8M3.2 3.2l1.3 1.3M10.5 10.5l1.3 1.3M3.2 11.8l1.3-1.3M10.5 4.5l1.3-1.3"
              stroke="currentColor"
              strokeWidth="1.15"
              strokeLinecap="round"
            />
          </svg>
        </NavIconBtn>

        <div style={nS.avatar}>{userInitial.toUpperCase()}</div>
      </div>
    </nav>
  );
}

const nS: Record<string, React.CSSProperties> = {
  nav: {
    height: 62,
    background: "var(--surface)",
    borderBottom: "1px solid var(--border)",
    display: "flex",
    alignItems: "center",
    padding: "0 20px",
    gap: 6,
    flexShrink: 0,
    zIndex: 20,
    boxShadow: "0 1px 3px rgba(28,31,46,.06)",
  },
  wordmark: {
    fontFamily: "var(--serif)",
    fontWeight: 400,
    fontSize: 20,
    letterSpacing: ".1em",
    color: "var(--navy)",
    marginRight: 4,
    padding: "0 6px",
    cursor: "pointer",
    flexShrink: 0,
    transition: "opacity .15s",
  },
  divider: {
    width: 1,
    height: 22,
    background: "var(--border)",
    marginRight: 4,
    flexShrink: 0,
  },
  pills: { display: "flex", gap: 2, flex: 1 },
  right: { display: "flex", alignItems: "center", gap: 8, flexShrink: 0 },
  modeWrap: {
    display: "flex",
    background: "var(--page)",
    borderRadius: 22,
    border: "1px solid var(--border)",
    padding: 3,
    gap: 2,
  },
  modeBtn: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "5px 14px",
    borderRadius: 18,
    fontSize: 12.5,
    fontWeight: 500,
    cursor: "pointer",
    transition: "all .15s",
    border: "none",
  },
  iconBtn: {
    width: 34,
    height: 34,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    color: "var(--navy-45)",
    cursor: "pointer",
    border: "1px solid var(--border)",
    flexShrink: 0,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: "50%",
    background: "var(--sky-light)",
    color: "var(--sky-deep)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 15,
    fontFamily: "var(--serif)",
    fontWeight: 500,
    border: "1.5px solid rgba(91,154,184,.25)",
    flexShrink: 0,
  },
};

export type { RouteId };
