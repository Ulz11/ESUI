"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { disconnectSocket } from "@/lib/socket";
import type { Memory, Mode, Usage, User } from "@/lib/types";

const CAT_COL: Record<string, string> = {
  academic: "#5b9ab8",
  personal: "#c0534d",
  work: "#3e6f54",
  preference: "#8b6fba",
};

export function SettingsDrawer({
  onClose,
  mode,
  setMode,
  theme,
  setTheme,
}: {
  onClose: () => void;
  mode: Mode;
  setMode: (m: Mode) => void;
  theme: "light" | "dark" | "system";
  setTheme: (t: "light" | "dark" | "system") => void;
}) {
  const [tab, setTab] = useState<"profile" | "memory" | "usage" | "theme">(
    "profile"
  );
  return (
    <div style={stS.overlay} onClick={onClose}>
      <div
        style={stS.drawer}
        onClick={(e) => e.stopPropagation()}
        className="anim-slide-r"
      >
        <div style={stS.head}>
          <h2 style={stS.title}>Settings</h2>
          <button style={stS.xBtn} onClick={onClose} aria-label="close">
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <path
                d="M3.5 3.5l8 8M11.5 3.5l-8 8"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <div style={stS.tabs}>
          {(
            [
              ["profile", "Profile"],
              ["memory", "Memory"],
              ["usage", "Usage"],
              ["theme", "Theme"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              style={{ ...stS.tab, ...(tab === id ? stS.tabActive : {}) }}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </div>

        <div style={stS.body}>
          {tab === "profile" && <ProfileTab mode={mode} setMode={setMode} />}
          {tab === "memory" && <MemoryTab />}
          {tab === "usage" && <UsageTab />}
          {tab === "theme" && <ThemeTab theme={theme} setTheme={setTheme} />}
        </div>
      </div>
    </div>
  );
}

function ProfileTab({
  mode,
  setMode,
}: {
  mode: Mode;
  setMode: (m: Mode) => void;
}) {
  const router = useRouter();
  const me = useAuthStore((s) => s.user);
  const setSession = useAuthStore((s) => s.setSession);
  const token = useAuthStore((s) => s.token);
  const expiresAt = useAuthStore((s) => s.expiresAt);
  const clear = useAuthStore((s) => s.clear);

  const [displayName, setDisplayName] = useState(me?.display_name || "");
  const [tz, setTz] = useState(me?.timezone || "UTC");
  const [savedFlash, setSavedFlash] = useState(false);

  const save = async () => {
    if (!me || !token || !expiresAt) return;
    try {
      const updated = await api.patch<User>("/api/v1/me", {
        display_name: displayName,
        timezone: tz,
        default_mode: mode,
      });
      setSession({ token, user: updated, expiresAt });
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1200);
    } catch {}
  };

  const signOut = () => {
    clear();
    disconnectSocket();
    router.replace("/login");
  };

  return (
    <div style={stS.section}>
      <div style={stS.avatarRow}>
        <div style={stS.avatar}>
          {(me?.display_name?.[0] || "E").toUpperCase()}
        </div>
        <div>
          <p
            style={{
              fontSize: 15,
              fontWeight: 500,
              fontFamily: "var(--serif)",
              marginBottom: 2,
            }}
          >
            {me?.display_name || "—"}
          </p>
          <p style={{ fontSize: 12, color: "var(--navy-60)" }}>
            {me?.email || ""}
          </p>
        </div>
      </div>
      <Field label="Display name">
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          onBlur={save}
          style={stS.input}
        />
      </Field>
      <Field label="Timezone">
        <input
          value={tz}
          onChange={(e) => setTz(e.target.value)}
          onBlur={save}
          style={stS.input}
        />
      </Field>
      <Field label="Default mode">
        <div style={{ display: "flex", gap: 8 }}>
          {(
            [
              ["ulzii", "Ulzii", "var(--sky)", "var(--sky-bg)"],
              ["obama", "Obama", "var(--forest)", "var(--forest-bg)"],
            ] as const
          ).map(([id, label, col, bg]) => (
            <button
              key={id}
              style={{
                padding: "5px 16px",
                borderRadius: 20,
                border: `1.5px solid ${
                  mode === id ? col : "var(--vanilla-border)"
                }`,
                background: mode === id ? bg : "none",
                color: mode === id ? col : "var(--navy-60)",
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
                transition: "all .12s",
              }}
              onClick={() => {
                setMode(id);
                save();
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </Field>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: 6,
        }}
      >
        {savedFlash && (
          <span
            style={{
              fontSize: 12,
              color: "var(--forest)",
              fontFamily: "var(--serif)",
              fontStyle: "italic",
            }}
          >
            ✓ saved
          </span>
        )}
        <button
          style={{
            marginLeft: "auto",
            fontSize: 12,
            color: "var(--rose)",
            fontFamily: "var(--serif)",
            fontStyle: "italic",
            background: "none",
            border: "none",
            cursor: "pointer",
          }}
          onClick={signOut}
        >
          sign out
        </button>
      </div>
    </div>
  );
}

function MemoryTab() {
  const [mems, setMems] = useState<Memory[]>([]);
  const [q, setQ] = useState("");
  const [fading, setFading] = useState<Set<string>>(new Set());

  useEffect(() => {
    api
      .get<Memory[]>("/api/v1/memory?limit=200")
      .then(setMems)
      .catch(() => {});
  }, []);

  const filtered = q.trim()
    ? mems.filter(
        (m) =>
          m.text.toLowerCase().includes(q.toLowerCase()) ||
          (m.category || "").toLowerCase().includes(q.toLowerCase())
      )
    : mems;

  const forget = async (id: string) => {
    setFading((p) => new Set(p).add(id));
    try {
      await api.post(`/api/v1/memory/${id}/forget`);
      setTimeout(() => {
        setMems((p) => p.filter((m) => m.id !== id));
        setFading((p) => {
          const n = new Set(p);
          n.delete(id);
          return n;
        });
      }, 380);
    } catch {
      setFading((p) => {
        const n = new Set(p);
        n.delete(id);
        return n;
      });
    }
  };

  return (
    <div style={stS.section}>
      <p style={stS.memIntro}>what the AI knows about you — you decide what stays</p>
      <div style={stS.memSearch}>
        <svg
          width="13"
          height="13"
          viewBox="0 0 13 13"
          fill="none"
          style={{ color: "var(--navy-35)", flexShrink: 0 }}
        >
          <circle cx="6" cy="6" r="4" stroke="currentColor" strokeWidth="1.3" />
          <path
            d="M9 9l2.5 2.5"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
          />
        </svg>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="search memories…"
          style={{
            flex: 1,
            fontSize: 13,
            background: "none",
            border: "none",
            outline: "none",
          }}
        />
      </div>
      {filtered.length === 0 ? (
        <p
          style={{
            fontSize: 13,
            fontFamily: "var(--serif)",
            fontStyle: "italic",
            color: "var(--navy-35)",
            padding: "20px 0",
          }}
        >
          no memories yet — they'll appear as you talk
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {filtered.map((m) => {
            const cat = m.category || "general";
            const col = CAT_COL[cat] || "#888";
            return (
              <div
                key={m.id}
                style={{
                  ...stS.memRow,
                  opacity: fading.has(m.id) ? 0 : 1,
                  transform: fading.has(m.id) ? "translateX(6px)" : "none",
                  transition: "all .35s ease",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p
                    style={{
                      fontSize: 13,
                      fontFamily: "var(--serif)",
                      color: "var(--navy)",
                      lineHeight: 1.5,
                      marginBottom: 5,
                    }}
                  >
                    {m.text}
                  </p>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 7,
                      flexWrap: "wrap",
                    }}
                  >
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 500,
                        padding: "2px 6px",
                        borderRadius: 8,
                        background: col + "18",
                        color: col,
                      }}
                    >
                      {cat}
                    </span>
                    <span style={{ fontSize: 10.5, color: "var(--navy-35)" }}>
                      {m.source_kind || "—"}
                    </span>
                    <div
                      style={{
                        width: 28,
                        height: 2.5,
                        background: "var(--vanilla-border)",
                        borderRadius: 2,
                        overflow: "hidden",
                        marginLeft: "auto",
                      }}
                    >
                      <div
                        style={{
                          height: "100%",
                          width: `${m.salience * 100}%`,
                          background: col,
                          borderRadius: 2,
                        }}
                      />
                    </div>
                    <span style={{ fontSize: 10.5, color: "var(--navy-35)" }}>
                      {m.last_used_at ? formatRelative(m.last_used_at) : "—"}
                    </span>
                  </div>
                </div>
                <button
                  style={stS.forgetBtn}
                  onClick={() => forget(m.id)}
                >
                  forget
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function UsageTab() {
  const [usage, setUsage] = useState<Usage | null>(null);
  useEffect(() => {
    api
      .get<Usage>("/api/v1/me/usage?range_days=30")
      .then(setUsage)
      .catch(() => {});
  }, []);
  if (!usage) {
    return (
      <div style={stS.section}>
        <p
          style={{
            fontSize: 12,
            color: "var(--navy-35)",
            fontFamily: "var(--serif)",
            fontStyle: "italic",
          }}
        >
          loading usage…
        </p>
      </div>
    );
  }
  const totalUsd = usage.by_task.reduce((s, t) => s + t.cost_usd, 0);
  const maxV = Math.max(1, ...usage.by_task.map((t) => t.cost_usd));
  return (
    <div style={stS.section}>
      <div style={stS.usageTop}>
        <Stat n={`$${usage.today_usd.toFixed(2)}`} l="today" />
        <Stat n={`$${usage.daily_cap_usd.toFixed(2)}`} l="daily cap" />
        <Stat n={`$${totalUsd.toFixed(2)}`} l={`last ${usage.range_days}d`} />
      </div>
      <p style={stS.fieldLabel}>by task ({usage.range_days}d)</p>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        {usage.by_task.length === 0 ? (
          <p
            style={{
              fontSize: 12,
              color: "var(--navy-35)",
              fontStyle: "italic",
              fontFamily: "var(--serif)",
            }}
          >
            quiet here
          </p>
        ) : (
          usage.by_task.map((t) => (
            <div
              key={t.task}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                fontSize: 12,
              }}
            >
              <span style={{ width: 100, color: "var(--navy-60)" }}>
                {t.task}
              </span>
              <div
                style={{
                  flex: 1,
                  height: 4,
                  background: "var(--vanilla-border)",
                  borderRadius: 2,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${(t.cost_usd / maxV) * 100}%`,
                    background: "var(--sky)",
                    opacity: 0.65,
                  }}
                />
              </div>
              <span
                style={{
                  fontSize: 11.5,
                  color: "var(--navy-35)",
                  width: 60,
                  textAlign: "right",
                }}
              >
                ${t.cost_usd.toFixed(2)}
              </span>
            </div>
          ))
        )}
      </div>
      <p
        style={{
          fontSize: 11.5,
          color: "var(--navy-35)",
          fontFamily: "var(--serif)",
          fontStyle: "italic",
          marginTop: 6,
        }}
      >
        daily cap resets at midnight UTC
      </p>
    </div>
  );
}

function ThemeTab({
  theme,
  setTheme,
}: {
  theme: "light" | "dark" | "system";
  setTheme: (t: "light" | "dark" | "system") => void;
}) {
  return (
    <div style={stS.section}>
      <Field label="Appearance">
        <div style={{ display: "flex", gap: 8 }}>
          {(
            [
              ["light", "Light"],
              ["dark", "Dark"],
              ["system", "System"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              style={{
                padding: "5px 16px",
                borderRadius: 20,
                border: `1.5px solid ${
                  theme === id ? "var(--navy)" : "var(--vanilla-border)"
                }`,
                background: theme === id ? "var(--navy)" : "none",
                color: theme === id ? "var(--vanilla)" : "var(--navy-60)",
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
                transition: "all .12s",
              }}
              onClick={() => setTheme(id)}
            >
              {label}
            </button>
          ))}
        </div>
      </Field>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={stS.fieldLabel}>{label}</span>
      {children}
    </div>
  );
}

function Stat({ n, l }: { n: string; l: string }) {
  return (
    <div>
      <p
        style={{
          fontSize: 26,
          fontWeight: 300,
          fontFamily: "var(--serif)",
          color: "var(--navy)",
          lineHeight: 1,
        }}
      >
        {n}
      </p>
      <p style={{ fontSize: 11.5, color: "var(--navy-35)", marginTop: 3 }}>
        {l}
      </p>
    </div>
  );
}

function formatRelative(iso: string): string {
  const t = new Date(iso).getTime();
  if (!t) return "";
  const diff = Date.now() - t;
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

const stS: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(28,31,46,.35)",
    backdropFilter: "blur(3px)",
    zIndex: 200,
    display: "flex",
    justifyContent: "flex-end",
  },
  drawer: {
    width: 420,
    height: "100%",
    background: "var(--white)",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    borderLeft: "1px solid var(--vanilla-border)",
  },
  head: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "18px 22px",
    borderBottom: "1px solid var(--vanilla-border)",
    flexShrink: 0,
  },
  title: { fontSize: 17, fontWeight: 300, fontFamily: "var(--serif)" },
  xBtn: {
    width: 27,
    height: 27,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "var(--navy-60)",
    cursor: "pointer",
    borderRadius: "var(--rs)",
  },
  tabs: {
    display: "flex",
    padding: "0 14px",
    borderBottom: "1px solid var(--vanilla-border)",
    flexShrink: 0,
  },
  tab: {
    padding: "9px 11px",
    fontSize: 12.5,
    fontWeight: 500,
    color: "var(--navy-60)",
    cursor: "pointer",
    borderBottom: "2px solid transparent",
  },
  tabActive: {
    color: "var(--navy)",
    borderBottom: "2px solid var(--navy)",
  },
  body: { flex: 1, overflowY: "auto" },
  section: { padding: "18px 22px", display: "flex", flexDirection: "column", gap: 16 },
  avatarRow: { display: "flex", alignItems: "center", gap: 12, marginBottom: 4 },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: "50%",
    background: "var(--sky-bg)",
    color: "var(--sky)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 17,
    fontFamily: "var(--serif)",
    border: "1.5px solid var(--sky-border)",
    flexShrink: 0,
  },
  input: {
    padding: "8px 11px",
    border: "1px solid var(--vanilla-border)",
    borderRadius: "var(--rs)",
    fontSize: 13.5,
    fontFamily: "var(--serif)",
    color: "var(--navy)",
    background: "var(--vanilla)",
    outline: "none",
  },
  fieldLabel: {
    fontSize: 10.5,
    fontWeight: 600,
    letterSpacing: ".07em",
    textTransform: "uppercase",
    color: "var(--navy-35)",
  },
  memIntro: {
    fontSize: 13,
    fontFamily: "var(--serif)",
    fontStyle: "italic",
    color: "var(--navy-60)",
    lineHeight: 1.6,
  },
  memSearch: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "7px 10px",
    border: "1px solid var(--vanilla-border)",
    borderRadius: "var(--rs)",
    background: "var(--vanilla)",
  },
  memRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: 8,
    padding: "10px 11px",
    border: "1px solid var(--vanilla-border)",
    borderRadius: "var(--rs)",
    background: "var(--vanilla)",
  },
  forgetBtn: {
    fontSize: 11,
    color: "var(--navy-35)",
    cursor: "pointer",
    background: "none",
    border: "none",
    flexShrink: 0,
    fontStyle: "italic",
    fontFamily: "var(--serif)",
    marginTop: 2,
  },
  usageTop: {
    display: "flex",
    gap: 22,
    paddingBottom: 18,
    borderBottom: "1px solid var(--vanilla-border)",
  },
};
