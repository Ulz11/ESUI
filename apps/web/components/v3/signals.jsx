"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Empty, Skel } from "./atoms";
import { I } from "./icons";
import { api } from "@/lib/api";
import { useSignals } from "@/lib/v3-hooks";

// Daily Signals — typography-first reading. Wired to /api/v1/signals.

const SOURCES = [
  { k: "chinese_philosophy", label: "Chinese philosophy", c: "#a64f63" },
  { k: "arabic_philosophy", label: "Arabic philosophy", c: "#3a6a51" },
  { k: "francis_su", label: "Francis Su", c: "#8a6a3c" },
  { k: "inspiration", label: "Inspiration", c: "#4a8cad" },
];

function SignalsView() {
  const router = useRouter();
  const [src, setSrc] = useState("chinese_philosophy");
  const [idx, setIdx] = useState(0);
  const [shared, setShared] = useState(false);
  const { items, loading, reload } = useSignals(src);
  const list = items;
  const q = list[idx];

  // Reset index when source changes or list grows
  React.useEffect(() => {
    if (idx >= list.length) setIdx(0);
  }, [list, idx]);

  const onPin = async () => {
    if (!q) return;
    try {
      await api.post(`/api/v1/signals/${q.id}/pin`);
    } catch {}
  };

  // "Share to chat" — drop the quote into the composer seed and route to /chat.
  // chat.jsx reads `esui:chat:seed` from sessionStorage on mount.
  const onShare = () => {
    if (!q) return;
    try {
      const seed = `> ${q.body}\n— ${q.title || q.source_name || ""}\n\n`;
      window.sessionStorage.setItem("esui:chat:seed", seed);
      setShared(true);
      router.push("/chat");
    } catch {}
  };

  return (
    <div style={{ height: "100%", display: "grid", gridTemplateColumns: "260px 1fr", overflow: "hidden" }}>
      <div style={{ borderRight: "1px solid var(--rule)", padding: "32px 22px", overflow: "auto" }}>
        <div className="mono" style={{ fontSize: 11, letterSpacing: ".18em", textTransform: "uppercase", color: "var(--ink-35)" }}>
          daily signals
        </div>
        <div style={{ marginTop: 24 }}>
          {SOURCES.map((s) => {
            const active = src === s.k;
            return (
              <button
                key={s.k}
                onClick={() => {
                  setSrc(s.k);
                  setIdx(0);
                }}
                style={{
                  display: "block",
                  textAlign: "left",
                  padding: "12px 0",
                  borderTop: "1px solid var(--rule-soft)",
                  width: "100%",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 3,
                      background: s.c,
                      opacity: active ? 1 : 0.35,
                    }}
                  />
                  <span
                    style={{
                      fontFamily: "var(--serif)",
                      fontSize: 15,
                      color: active ? "var(--ink)" : "var(--ink-50)",
                      fontStyle: active ? "italic" : "normal",
                    }}
                  >
                    {s.label}
                  </span>
                </div>
                <CountLabel category={s.k} />
              </button>
            );
          })}
        </div>
        <div style={{ marginTop: 32, padding: "12px 14px", border: "1px dashed var(--rule)", borderRadius: 8 }}>
          <div className="mono" style={{ fontSize: 10, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--ink-35)" }}>
            curation
          </div>
          <div style={{ fontFamily: "var(--serif)", fontSize: 14, color: "var(--ink-70)", marginTop: 4, fontStyle: "italic" }}>
            new quotes every hour
          </div>
        </div>
      </div>

      <div style={{ overflow: "auto", padding: "80px 64px", display: "grid", placeItems: "center" }}>
        <div style={{ maxWidth: 720, width: "100%" }}>
          <div
            className="mono"
            style={{
              fontSize: 11,
              letterSpacing: ".18em",
              textTransform: "uppercase",
              color: SOURCES.find((s) => s.k === src).c,
              marginBottom: 28,
            }}
          >
            {SOURCES.find((s) => s.k === src).label}
          </div>

          {loading && list.length === 0 ? (
            <div>
              <Skel w="80%" h={36} style={{ marginBottom: 12 }} />
              <Skel w="60%" h={36} />
            </div>
          ) : list.length === 0 ? (
            <Empty>
              the curator is quiet right now — fresh quotes land at the top of every hour.
            </Empty>
          ) : (
            q && (
              <>
                <div
                  style={{
                    fontFamily: "var(--serif)",
                    fontSize: 38,
                    lineHeight: 1.35,
                    letterSpacing: "-.012em",
                    color: "var(--ink)",
                  }}
                >
                  <em>&ldquo;{q.body}&rdquo;</em>
                </div>
                <div
                  style={{
                    marginTop: 36,
                    fontFamily: "var(--serif)",
                    fontStyle: "italic",
                    color: "var(--ink-50)",
                    fontSize: 16,
                  }}
                >
                  — {q.source_name || "—"}
                  {q.source_url && (
                    <>
                      {" · "}
                      <a
                        href={q.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: "var(--ink-50)", textDecoration: "underline" }}
                      >
                        source
                      </a>
                    </>
                  )}
                </div>
                <div style={{ marginTop: 48, display: "flex", alignItems: "center", gap: 16, color: "var(--ink-35)" }}>
                  <button
                    onClick={() => setIdx((idx - 1 + list.length) % list.length)}
                    className="qbtn"
                  >
                    <I.back size={14} />
                  </button>
                  <span className="tnum mono" style={{ fontSize: 11 }}>
                    {idx + 1} / {list.length}
                  </span>
                  <button
                    onClick={() => setIdx((idx + 1) % list.length)}
                    className="qbtn"
                    style={{ transform: "rotate(180deg)" }}
                  >
                    <I.back size={14} />
                  </button>
                  <div style={{ flex: 1 }} />
                  <button className="qbtn" onClick={onPin}>
                    <I.pin size={13} /> pin to vault
                  </button>
                  <button className="qbtn" onClick={onShare} disabled={shared}>
                    <I.chat size={13} /> {shared ? "shared" : "share to chat"}
                  </button>
                </div>
              </>
            )
          )}
        </div>
      </div>
    </div>
  );
}

function CountLabel({ category }) {
  const { items } = useSignals(category);
  return (
    <div className="mono" style={{ fontSize: 10.5, color: "var(--ink-35)", marginTop: 4, marginLeft: 14 }}>
      {items.length} entries
    </div>
  );
}

export { SignalsView };
