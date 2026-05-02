"use client";

import React, { useEffect, useState } from "react";
import { Empty, Skel, Tag } from "./atoms";
import { I } from "./icons";
import { api } from "@/lib/api";
import { useMe, useMemories, useUsage } from "@/lib/v3-hooks";

// Settings drawer — wired to /me, /me/usage, /memory.

function SettingsDrawer({ open, onClose }) {
  const [section, setSection] = useState("memory");
  if (!open) return null;
  return (
    <div
      className="fi"
      style={{ position: "fixed", inset: 0, background: "rgba(13,15,23,.32)", zIndex: 55 }}
      onClick={onClose}
    >
      <div
        className="fu"
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "absolute",
          right: 0,
          top: 0,
          bottom: 0,
          width: "min(720px, 92vw)",
          background: "var(--paper)",
          borderLeft: "1px solid var(--rule)",
          display: "grid",
          gridTemplateColumns: "180px 1fr",
          overflow: "hidden",
        }}
      >
        <div style={{ borderRight: "1px solid var(--rule)", padding: "32px 18px" }}>
          <div className="mono" style={{ fontSize: 11, letterSpacing: ".18em", textTransform: "uppercase", color: "var(--ink-35)" }}>
            settings
          </div>
          <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 2 }}>
            {[
              ["profile", "profile"],
              ["memory", "memory"],
              ["usage", "usage"],
              ["theme", "theme"],
            ].map(([k, l]) => (
              <button
                key={k}
                onClick={() => setSection(k)}
                style={{
                  textAlign: "left",
                  padding: "8px 10px",
                  borderRadius: 6,
                  background: section === k ? "var(--ink-06)" : "transparent",
                  color: section === k ? "var(--ink)" : "var(--ink-50)",
                  fontSize: 13.5,
                }}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
        <div style={{ overflow: "auto", padding: "36px 36px" }}>
          {section === "memory" && <MemoryAudit />}
          {section === "profile" && <ProfilePanel />}
          {section === "usage" && <UsagePanel />}
          {section === "theme" && <ThemePanel />}
        </div>
      </div>
    </div>
  );
}

function MemoryAudit() {
  const { items, reload } = useMemories();
  const [filter, setFilter] = useState("");
  const visible = items.filter((m) => !filter || m.text.toLowerCase().includes(filter.toLowerCase()));

  const onForget = async (id) => {
    try {
      await api.post(`/api/v1/memory/${id}/forget`);
      reload();
    } catch {}
  };

  return (
    <div>
      <div style={{ fontFamily: "var(--serif)", fontSize: 26 }}>
        <em>memory</em>
      </div>
      <div
        style={{
          fontFamily: "var(--serif)",
          fontSize: 15,
          color: "var(--ink-50)",
          marginTop: 6,
          fontStyle: "italic",
        }}
      >
        what the AI has come to know about her. all of it editable, all of it forgettable.
      </div>
      <div
        style={{
          marginTop: 24,
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 12px",
          border: "1px solid var(--rule)",
          borderRadius: 100,
        }}
      >
        <I.search size={13} />
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="search memories…"
          style={{
            background: "transparent",
            border: "none",
            outline: "none",
            fontFamily: "var(--serif)",
            fontStyle: filter ? "normal" : "italic",
            color: "var(--ink-70)",
            fontSize: 14,
            flex: 1,
          }}
        />
      </div>
      <div style={{ marginTop: 22 }}>
        {visible.length === 0 ? (
          <Empty>nothing remembered yet — talk a little, the AI will catch on.</Empty>
        ) : (
          visible.map((m) => (
            <div
              key={m.id}
              style={{
                padding: "14px 0",
                borderTop: "1px solid var(--rule-soft)",
                display: "grid",
                gridTemplateColumns: "1fr auto auto",
                gap: 14,
                alignItems: "baseline",
              }}
            >
              <div>
                <div style={{ fontFamily: "var(--serif)", fontSize: 15.5, color: "var(--ink)" }}>{m.text}</div>
                <div style={{ display: "flex", gap: 8, marginTop: 6, alignItems: "center" }}>
                  {m.category && <Tag>{m.category}</Tag>}
                  <span className="mono" style={{ fontSize: 11, color: "var(--ink-35)" }}>
                    {m.source_kind || "—"} · {m.last_used_at ? `used ${timeAgo(m.last_used_at)}` : "unused"}
                  </span>
                </div>
              </div>
              <div style={{ display: "flex", gap: 2 }}>
                {Array.from({ length: 3 }).map((_, di) => (
                  <span
                    key={di}
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 3,
                      background: di < Math.round((m.salience || 0) * 3) ? "var(--ink-50)" : "var(--ink-10)",
                    }}
                  />
                ))}
              </div>
              <div style={{ display: "flex", gap: 4 }}>
                <button className="qbtn" onClick={() => onForget(m.id)}>
                  forget
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function ProfilePanel() {
  const { user } = useMe();
  return (
    <div>
      <div style={{ fontFamily: "var(--serif)", fontSize: 26 }}>
        <em>profile</em>
      </div>
      <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 18 }}>
        {user ? (
          [
            ["display name", user.display_name],
            ["email", user.email],
            ["timezone", user.timezone],
            ["default mode", user.default_mode],
          ].map(([k, v]) => (
            <div
              key={k}
              style={{
                display: "grid",
                gridTemplateColumns: "160px 1fr",
                borderTop: "1px solid var(--rule-soft)",
                paddingTop: 14,
              }}
            >
              <div
                className="mono"
                style={{
                  fontSize: 11,
                  letterSpacing: ".1em",
                  textTransform: "uppercase",
                  color: "var(--ink-50)",
                }}
              >
                {k}
              </div>
              <div style={{ fontFamily: "var(--serif)", fontSize: 16 }}>{v || "—"}</div>
            </div>
          ))
        ) : (
          <Skel w="60%" />
        )}
      </div>
    </div>
  );
}

function UsagePanel() {
  const u = useUsage(30);
  return (
    <div>
      <div style={{ fontFamily: "var(--serif)", fontSize: 26 }}>
        <em>usage</em>
      </div>
      <div style={{ marginTop: 24, padding: "22px 24px", border: "1px solid var(--rule)", borderRadius: "var(--r-md)" }}>
        <div className="mono" style={{ fontSize: 11, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--ink-50)" }}>
          today
        </div>
        <div className="tnum" style={{ fontFamily: "var(--serif)", fontSize: 34, marginTop: 6 }}>
          {u ? `$${u.today_usd?.toFixed(2)}` : "—"}
        </div>
        <div className="mono" style={{ fontSize: 11, color: "var(--ink-35)", marginTop: 4 }}>
          of ${u?.daily_cap_usd?.toFixed(2) || "20.00"} daily cap
        </div>
      </div>
      <div style={{ marginTop: 18 }}>
        {(u?.by_task || []).map((row) => (
          <div
            key={row.task}
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "12px 0",
              borderTop: "1px solid var(--rule-soft)",
            }}
          >
            <span>{row.task}</span>
            <span className="mono tnum" style={{ color: "var(--ink-50)" }}>
              ${row.cost_usd?.toFixed(2)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ThemePanel() {
  return (
    <div>
      <div style={{ fontFamily: "var(--serif)", fontSize: 26 }}>
        <em>theme</em>
      </div>
      <div style={{ marginTop: 24, fontFamily: "var(--serif)", fontStyle: "italic", color: "var(--ink-50)" }}>
        toggle in the topbar.
      </div>
    </div>
  );
}

function timeAgo(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  const sec = (Date.now() - d.getTime()) / 1000;
  if (sec < 60) return "just now";
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  if (sec < 2592000) return `${Math.floor(sec / 86400)}d ago`;
  return d.toLocaleDateString();
}

export { SettingsDrawer };
