"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Empty, ModePill, Skel, Tag } from "./atoms";
import { I } from "./icons";
import { api } from "@/lib/api";
import { createVaultDoc, useVault } from "@/lib/v3-hooks";

// Vault — 4 tabs + Graph. Wired to /api/v1/vault/documents (filtered by content_type).

function VaultView({ mode }) {
  const [tab, setTab] = useState("notes");
  const [query, setQuery] = useState("");

  const ideas = useVault({ content_type: "idea" });
  const notes = useVault({ content_type: "note,journal,draft,research,reference" });
  const chats = useVault({ content_type: "chat_history" });
  const arts = useVault({ content_type: "project_artifact" });

  const counts = {
    ideas: ideas.docs.length,
    notes: notes.docs.length,
    chat: chats.docs.length,
    art: arts.docs.length,
  };

  // Substring filter by title — keeps the "search this tab" promise honest.
  const filterDocs = (docs) => {
    const q = query.trim().toLowerCase();
    if (!q) return docs;
    return docs.filter((d) =>
      ((d.title || "") + " " + (d.content_md || "")).toLowerCase().includes(q),
    );
  };

  return (
    <div style={{ height: "100%", display: "grid", gridTemplateRows: "auto 1fr", overflow: "hidden" }}>
      <div style={{ padding: "22px 32px 0", borderBottom: "1px solid var(--rule-soft)" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <div>
            <div className="mono" style={{ fontSize: 11, letterSpacing: ".18em", textTransform: "uppercase", color: "var(--ink-35)" }}>
              vault
            </div>
            <div style={{ fontFamily: "var(--serif)", fontSize: 28, marginTop: 4 }}>
              <em>everything she's keeping</em>
            </div>
          </div>
          <SearchBar value={query} onChange={setQuery} />
        </div>
        <div style={{ display: "flex", gap: 4, marginTop: 18 }}>
          {[
            ["ideas", "ideas", counts.ideas],
            ["notes", "notes", counts.notes],
            ["chat", "chat history", counts.chat],
            ["art", "project artifacts", counts.art],
            ["graph", "graph", null],
          ].map(([k, l, c]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              style={{
                padding: "10px 14px",
                borderBottom: tab === k ? "2px solid var(--ink)" : "2px solid transparent",
                color: tab === k ? "var(--ink)" : "var(--ink-50)",
                fontSize: 13.5,
                marginBottom: -1,
                display: "inline-flex",
                alignItems: "baseline",
                gap: 8,
              }}
            >
              {l}
              {c !== null && c !== undefined && (
                <span className="mono" style={{ fontSize: 10.5, color: "var(--ink-35)" }}>
                  {c}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
      <div style={{ overflow: "auto" }}>
        {tab === "ideas" && <IdeasList docs={filterDocs(ideas.docs)} loading={ideas.loading} reload={ideas.reload} />}
        {tab === "notes" && <NotesView docs={filterDocs(notes.docs)} loading={notes.loading} reload={notes.reload} />}
        {tab === "chat" && <ChatHistoryList docs={filterDocs(chats.docs)} loading={chats.loading} />}
        {tab === "art" && <ArtifactsList docs={filterDocs(arts.docs)} loading={arts.loading} />}
        {tab === "graph" && <VaultGraph />}
      </div>
    </div>
  );
}

function SearchBar({ value, onChange }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 12px",
        border: "1px solid var(--rule)",
        borderRadius: 100,
        fontSize: 12.5,
        color: "var(--ink-50)",
        width: 240,
      }}
    >
      <I.search size={13} />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="search this tab…"
        style={{
          background: "transparent",
          border: "none",
          outline: "none",
          fontStyle: "italic",
          fontFamily: "var(--serif)",
          color: "var(--ink-70)",
          flex: 1,
          fontSize: 13,
        }}
      />
    </div>
  );
}

function IdeasList({ docs, loading, reload }) {
  const [draft, setDraft] = useState("");
  const onCapture = async () => {
    const t = draft.trim();
    if (!t) return;
    try {
      await createVaultDoc({
        title: t.split("\n")[0].slice(0, 100),
        content_md: t,
        content_type: "idea",
      });
      setDraft("");
      reload();
    } catch {}
  };
  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "32px" }}>
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") onCapture();
        }}
        placeholder="capture a thought… (⌘⏎ to save)"
        rows={2}
        style={{
          width: "100%",
          padding: "14px 16px",
          border: "1px solid var(--rule)",
          borderRadius: "var(--r-md)",
          fontFamily: "var(--serif)",
          fontSize: 16,
          fontStyle: draft ? "normal" : "italic",
          color: "var(--ink)",
          background: "var(--surface)",
        }}
      />
      <div style={{ marginTop: 24 }}>
        {loading && docs.length === 0 ? (
          <div>
            <Skel w="60%" h={16} style={{ marginBottom: 10 }} />
            <Skel w="80%" h={14} />
          </div>
        ) : docs.length === 0 ? (
          <Empty>nothing here yet — capture a thought.</Empty>
        ) : (
          docs.map((d, idx) => (
            <div
              key={d.id}
              style={{
                padding: "14px 0",
                borderTop: idx === 0 ? "none" : "1px solid var(--rule-soft)",
                display: "grid",
                gridTemplateColumns: "1fr auto",
                gap: 14,
              }}
            >
              <div>
                <div style={{ fontFamily: "var(--serif)", fontSize: 16, color: "var(--ink)" }}>{d.title}</div>
                <div
                  style={{
                    fontFamily: "var(--serif)",
                    fontSize: 14,
                    color: "var(--ink-50)",
                    marginTop: 4,
                    lineHeight: 1.5,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {(d.content_md || "").slice(0, 240)}
                  {(d.content_md || "").length > 240 ? "…" : ""}
                </div>
              </div>
              <div className="mono" style={{ fontSize: 11, color: "var(--ink-35)" }}>
                {timeAgo(d.updated_at)}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function NotesView({ docs, loading }) {
  const [activeId, setActiveId] = useState(null);
  useEffect(() => {
    if (!activeId && docs.length > 0) setActiveId(docs[0].id);
  }, [activeId, docs]);
  const active = docs.find((d) => d.id === activeId);

  if (loading && docs.length === 0) {
    return (
      <div style={{ padding: 40 }}>
        <Skel w="60%" h={28} style={{ marginBottom: 10 }} />
        <Skel w="40%" h={20} />
      </div>
    );
  }
  if (docs.length === 0) {
    return <Empty>no notes yet — start with whatever's on your mind.</Empty>;
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", height: "100%", overflow: "hidden" }}>
      <div style={{ borderRight: "1px solid var(--rule)", overflow: "auto", padding: "18px 14px" }}>
        {docs.map((n) => (
          <div
            key={n.id}
            onClick={() => setActiveId(n.id)}
            style={{
              padding: "10px 12px",
              borderRadius: 8,
              background: n.id === activeId ? "var(--ink-06)" : "transparent",
              marginBottom: 4,
              cursor: "pointer",
            }}
          >
            <div style={{ fontSize: 13.5, color: "var(--ink)" }}>{n.title}</div>
            <div className="mono" style={{ fontSize: 10.5, color: "var(--ink-35)", marginTop: 3 }}>
              {timeAgo(n.updated_at)} · {n.content_type}
            </div>
          </div>
        ))}
      </div>
      <div style={{ overflow: "auto", padding: "40px 56px", maxWidth: 720, width: "100%" }}>
        {active && (
          <>
            <div className="mono" style={{ fontSize: 11, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--ink-35)" }}>
              {active.content_type}
            </div>
            <div style={{ fontFamily: "var(--serif)", fontSize: 34, lineHeight: 1.15, letterSpacing: "-.015em", marginTop: 10 }}>
              <em>{active.title}</em>
            </div>
            <div style={{ marginTop: 32, fontFamily: "var(--serif)", fontSize: 17, lineHeight: 1.7, color: "var(--ink)", whiteSpace: "pre-wrap" }}>
              {active.content_md}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ChatHistoryList({ docs, loading }) {
  if (loading && docs.length === 0) return <div style={{ padding: 40 }}><Skel w="60%" /></div>;
  if (docs.length === 0)
    return (
      <Empty>archive a conversation from chat to keep it here.</Empty>
    );
  return (
    <div style={{ maxWidth: 920, margin: "0 auto", padding: "32px" }}>
      {docs.map((a, i) => (
        <div
          key={a.id}
          style={{
            padding: "18px 0",
            borderTop: i === 0 ? "none" : "1px solid var(--rule-soft)",
            display: "grid",
            gridTemplateColumns: "1fr auto",
            gap: 16,
            alignItems: "baseline",
          }}
        >
          <div>
            <div style={{ fontFamily: "var(--serif)", fontSize: 17 }}>{a.title}</div>
            <div
              style={{
                fontSize: 13,
                color: "var(--ink-50)",
                marginTop: 4,
                fontFamily: "var(--serif)",
                fontStyle: "italic",
                whiteSpace: "pre-wrap",
              }}
            >
              {(a.content_md || "").slice(0, 240)}…
            </div>
          </div>
          <div className="mono" style={{ fontSize: 11.5, color: "var(--ink-35)" }}>
            {timeAgo(a.updated_at)}
          </div>
        </div>
      ))}
    </div>
  );
}

function ArtifactsList({ docs, loading }) {
  if (loading && docs.length === 0) return <div style={{ padding: 40 }}><Skel /></div>;
  if (docs.length === 0)
    return (
      <Empty>nothing made yet — ulzii or obama will save things here when you ask.</Empty>
    );
  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: "32px", display: "grid", gap: 14 }}>
      {docs.map((d) => (
        <div
          key={d.id}
          style={{
            padding: "18px 22px",
            border: "1px solid var(--rule)",
            borderRadius: "var(--r-md)",
            background: "var(--surface)",
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
            <span
              className="mono"
              style={{
                fontSize: 10,
                letterSpacing: ".14em",
                textTransform: "uppercase",
                color: "var(--forest-deep)",
                background: "var(--forest-soft)",
                padding: "2px 8px",
                borderRadius: 100,
              }}
            >
              {String(d.kind || "artifact").replace(/_/g, " ")}
            </span>
            <div style={{ fontFamily: "var(--serif)", fontSize: 18 }}>{d.title}</div>
            <div className="mono" style={{ fontSize: 11, color: "var(--ink-35)", marginLeft: "auto" }}>
              {timeAgo(d.updated_at)}
            </div>
          </div>
          <div
            style={{
              marginTop: 10,
              fontFamily: "var(--serif)",
              fontSize: 14.5,
              color: "var(--ink-70)",
              lineHeight: 1.55,
              whiteSpace: "pre-wrap",
            }}
          >
            {(d.content_md || "").slice(0, 320)}
            {(d.content_md || "").length > 320 ? "…" : ""}
          </div>
        </div>
      ))}
    </div>
  );
}

function VaultGraph() {
  const [data, setData] = useState({ nodes: [], edges: [] });
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api
      .get("/api/v1/vault/graph?max_nodes=80")
      .then(setData)
      .catch(() => setData({ nodes: [], edges: [] }))
      .finally(() => setLoading(false));
  }, []);

  // 2D placeholder — V3 graph3d module to be wired separately.
  if (loading) {
    return <div style={{ padding: 40 }}><Skel /></div>;
  }
  if (!data.nodes || data.nodes.length === 0) {
    return <Empty>the constellation begins when you add a few notes.</Empty>;
  }

  return (
    <div style={{ height: "100%", padding: 32, color: "var(--ink-50)", fontStyle: "italic", fontFamily: "var(--serif)" }}>
      {data.nodes.length} nodes, {data.edges?.length ?? 0} edges. (3D constellation coming.)
    </div>
  );
}

const VAULT_GRAPH = {};

function timeAgo(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const sec = (Date.now() - d.getTime()) / 1000;
  if (sec < 60) return "now";
  if (sec < 3600) return `${Math.floor(sec / 60)}m`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h`;
  if (sec < 2592000) return `${Math.floor(sec / 86400)}d`;
  return d.toLocaleDateString();
}

export { VaultView, VAULT_GRAPH };
