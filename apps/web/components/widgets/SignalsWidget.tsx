"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import type { Signal, SignalsCycle } from "@/lib/types";

const CATEGORIES: Array<{ id: string; label: string; color: string }> = [
  { id: "global", label: "Global", color: "#5b9ab8" },
  { id: "tech", label: "Tech", color: "#3e6f54" },
  { id: "math", label: "Mathematics", color: "#8b6fba" },
  { id: "arabic", label: "Arabic Philosophy", color: "#b5893a" },
  { id: "chinese", label: "Chinese Philosophy", color: "#c0534d" },
  { id: "research", label: "Research", color: "#6b7094" },
];

export function SignalsWidget() {
  const [cycle, setCycle] = useState<SignalsCycle | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [pinned, setPinned] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    api
      .get<SignalsCycle>("/api/v1/signals/current")
      .then(setCycle)
      .catch(() => setError("we couldn't reach the world to find new signals"));
  };

  useEffect(() => {
    load();
  }, []);

  // listen for new cycles
  useEffect(() => {
    const s = getSocket();
    if (!s) return;
    const onRefresh = () => load();
    s.on("cycle:refreshed", onRefresh);
    return () => {
      s.off("cycle:refreshed", onRefresh);
    };
  }, []);

  const dismiss = (id: string) => {
    setDismissed((p) => new Set(p).add(id));
    api.post(`/api/v1/signals/${id}/dismiss`).catch(() => {});
  };

  const pin = (id: string) => {
    setPinned((p) => new Set(p).add(id));
    api.post(`/api/v1/signals/${id}/pin`).catch(() => {
      // rollback on failure
      setPinned((p) => {
        const next = new Set(p);
        next.delete(id);
        return next;
      });
    });
  };

  const items = cycle?.items.filter((s) => !dismissed.has(s.id)) || [];
  const refreshed = cycle?.refreshed_at
    ? new Date(cycle.refreshed_at).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <div style={sS.container}>
      <div style={sS.header}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
          }}
        >
          <h2 style={sS.title}>Signals</h2>
          <span style={sS.cycle}>
            {refreshed ? `refreshed at ${refreshed}` : "—"}
          </span>
        </div>
      </div>
      {error && cycle === null ? (
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 40,
          }}
        >
          <p style={sS.quietBig}>
            we couldn't reach the world to find new signals — we'll try again at the next cycle.
          </p>
        </div>
      ) : items.length === 0 ? (
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 40,
          }}
        >
          <p style={sS.quietBig}>signals are quiet right now — check back in a few hours</p>
        </div>
      ) : (
        <div style={sS.grid}>
          {CATEGORIES.map((cat) => {
            const catItems = items.filter((s) => s.category === cat.id);
            return (
              <div key={cat.id} style={sS.col}>
                <div style={sS.catHead}>
                  <span
                    style={{
                      width: 3,
                      height: 13,
                      background: cat.color,
                      borderRadius: 2,
                      flexShrink: 0,
                      display: "block",
                    }}
                  />
                  {cat.label}
                </div>
                {catItems.length === 0 ? (
                  <p style={sS.quiet}>quiet</p>
                ) : (
                  catItems.map((sig) => (
                    <SignalCard
                      key={sig.id}
                      sig={sig}
                      color={cat.color}
                      pinned={pinned.has(sig.id)}
                      onPin={() => pin(sig.id)}
                      onDismiss={() => dismiss(sig.id)}
                    />
                  ))
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SignalCard({
  sig,
  color,
  pinned,
  onPin,
  onDismiss,
}: {
  sig: Signal;
  color: string;
  pinned: boolean;
  onPin: () => void;
  onDismiss: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      style={{ ...sS.card, transition: "all .2s ease" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span
        style={{
          width: 2,
          background: color + "55",
          borderRadius: 1,
          flexShrink: 0,
          alignSelf: "stretch",
          minHeight: 36,
          display: "block",
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={sS.cardTitle}>{sig.title}</p>
        <p style={sS.cardBody}>{sig.body}</p>
        {sig.source_name && <p style={sS.cardSrc}>{sig.source_name}</p>}
        <div
          style={{
            ...sS.actions,
            opacity: hovered ? 1 : 0,
            transition: "opacity .15s",
          }}
        >
          {sig.source_url && (
            <a
              href={sig.source_url}
              target="_blank"
              rel="noopener noreferrer"
              style={sS.actBtn}
              onClick={() =>
                api.post(`/api/v1/signals/${sig.id}/open`).catch(() => {})
              }
            >
              open ↗
            </a>
          )}
          <button
            style={{ ...sS.actBtn, color: pinned ? color : undefined }}
            onClick={onPin}
            disabled={pinned}
          >
            {pinned ? "✓ saved to vault" : "save to vault"}
          </button>
          <button
            style={{ ...sS.actBtn, marginLeft: "auto", color: "var(--navy-35)" }}
            onClick={onDismiss}
          >
            dismiss
          </button>
        </div>
      </div>
    </div>
  );
}

const sS: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    overflow: "hidden",
  },
  header: {
    padding: "18px 20px 14px",
    borderBottom: "1px solid var(--vanilla-border)",
    background: "var(--white)",
    flexShrink: 0,
  },
  title: {
    fontSize: 18,
    fontWeight: 300,
    fontFamily: "var(--serif)",
    color: "var(--navy)",
  },
  cycle: { fontSize: 11.5, color: "var(--navy-35)" },
  grid: {
    flex: 1,
    overflowY: "auto",
    overflowX: "auto",
    padding: "14px 14px 24px",
    display: "grid",
    gridTemplateColumns: "repeat(6, minmax(210px,1fr))",
    gap: 10,
    alignContent: "start",
  },
  col: { display: "flex", flexDirection: "column", gap: 8 },
  catHead: {
    display: "flex",
    alignItems: "center",
    gap: 7,
    fontSize: 10.5,
    fontWeight: 600,
    letterSpacing: ".07em",
    textTransform: "uppercase",
    color: "var(--navy-60)",
    paddingBottom: 8,
    borderBottom: "1px solid var(--vanilla-border)",
    marginBottom: 2,
  },
  quiet: {
    fontSize: 12,
    color: "var(--navy-35)",
    fontStyle: "italic",
    fontFamily: "var(--serif)",
    padding: "8px 0",
  },
  quietBig: {
    fontSize: 14,
    color: "var(--navy-35)",
    fontStyle: "italic",
    fontFamily: "var(--serif)",
    textAlign: "center",
    lineHeight: 1.7,
    maxWidth: 420,
  },
  card: {
    background: "var(--white)",
    border: "1px solid var(--vanilla-border)",
    borderRadius: "var(--rs)",
    padding: "11px 10px",
    display: "flex",
    gap: 9,
  },
  cardTitle: {
    fontSize: 12.5,
    fontWeight: 500,
    fontFamily: "var(--serif)",
    color: "var(--navy)",
    lineHeight: 1.4,
    marginBottom: 5,
  },
  cardBody: {
    fontSize: 12,
    fontFamily: "var(--serif)",
    lineHeight: 1.65,
    color: "var(--navy-60)",
    fontWeight: 300,
    marginBottom: 5,
  },
  cardSrc: {
    fontSize: 10.5,
    color: "var(--navy-35)",
    fontStyle: "italic",
    fontFamily: "var(--serif)",
    marginBottom: 6,
  },
  actions: { display: "flex", alignItems: "center", gap: 10 },
  actBtn: {
    fontSize: 11,
    color: "var(--navy-60)",
    cursor: "pointer",
    background: "none",
    border: "none",
    padding: 0,
    textDecoration: "none",
  },
};
