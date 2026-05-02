"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Empty, Skel } from "./atoms";
import { I } from "./icons";
import { api, API_URL } from "@/lib/api";
import { getAuthToken } from "@/lib/auth-store";
import { useBeauty } from "@/lib/v3-hooks";

// Beauty — calm gallery (esui-only writes; badrushk read-only)
// Wired to /api/v1/beauty/media. Drag-drop upload, lightbox, delete.

function BeautyView({ role = "esui" }) {
  const [open, setOpen] = useState(null);
  const [drag, setDrag] = useState(false);
  const [uploading, setUploading] = useState(0);
  const fileInput = useRef(null);
  const dragDepth = useRef(0);

  const { items, loading, reload } = useBeauty();

  const upload = useCallback(
    async (file) => {
      if (role !== "esui") return;
      const fd = new FormData();
      fd.append("file", file);
      const token = getAuthToken();
      setUploading((n) => n + 1);
      try {
        const res = await fetch(`${API_URL}/api/v1/beauty/media`, {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          body: fd,
        });
        if (!res.ok) throw new Error(String(res.status));
        await res.json();
        reload();
      } catch {} finally {
        setUploading((n) => n - 1);
      }
    },
    [role, reload],
  );

  const onFiles = useCallback(
    (list) => {
      for (const f of Array.from(list)) {
        if (f.type.startsWith("image/") || f.type.startsWith("video/")) upload(f);
      }
    },
    [upload],
  );

  const onDelete = useCallback(
    async (id) => {
      if (role !== "esui") return;
      try {
        await api.delete(`/api/v1/beauty/media/${id}`);
        setOpen(null);
        reload();
      } catch {}
    },
    [role, reload],
  );

  // Group items by week/month
  const groups = groupByEra(items);

  return (
    <div
      style={{ height: "100%", display: "grid", gridTemplateRows: "auto 1fr", overflow: "hidden", position: "relative" }}
      onDragEnter={(e) => {
        e.preventDefault();
        dragDepth.current += 1;
        if (dragDepth.current === 1 && role === "esui") setDrag(true);
      }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={(e) => {
        e.preventDefault();
        dragDepth.current = Math.max(0, dragDepth.current - 1);
        if (dragDepth.current === 0) setDrag(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        dragDepth.current = 0;
        setDrag(false);
        if (e.dataTransfer.files?.length && role === "esui") onFiles(e.dataTransfer.files);
      }}
    >
      <div
        style={{
          padding: "22px 32px",
          borderBottom: "1px solid var(--rule-soft)",
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
        }}
      >
        <div>
          <div className="mono" style={{ fontSize: 11, letterSpacing: ".18em", textTransform: "uppercase", color: "var(--ink-35)" }}>
            beauty
          </div>
          <div style={{ fontFamily: "var(--serif)", fontSize: 28, marginTop: 4 }}>
            <em>a wall in her room</em>
            {uploading > 0 && (
              <span className="mono" style={{ marginLeft: 12, fontSize: 12, color: "var(--ink-50)", fontStyle: "normal" }}>
                · uploading {uploading}…
              </span>
            )}
          </div>
        </div>
        {role === "esui" ? (
          <>
            <button
              onClick={() => fileInput.current?.click()}
              style={{
                padding: "8px 14px",
                border: "1px solid var(--rule)",
                borderRadius: 100,
                fontSize: 13,
                color: "var(--ink-70)",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <I.plus size={13} /> add
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="image/*,video/*"
              multiple
              style={{ display: "none" }}
              onChange={(e) => {
                if (e.target.files) onFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </>
        ) : (
          <span className="mono" style={{ fontSize: 11, color: "var(--ink-35)" }}>
            read-only · viewing as badrushk
          </span>
        )}
      </div>

      <div style={{ overflow: "auto", padding: "32px 40px" }}>
        {loading && items.length === 0 ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(12, 1fr)",
              gridAutoRows: "110px",
              gap: 12,
            }}
          >
            {[5, 3, 4, 3, 4, 5, 3].map((cw, i) => (
              <Skel
                key={i}
                style={{
                  gridColumn: `span ${cw}`,
                  gridRow: "span 2",
                  borderRadius: 6,
                  height: "100%",
                }}
              />
            ))}
          </div>
        ) : items.length === 0 ? (
          <Empty>
            drag images or videos here. quiet enough to feel like a wall in your room.
          </Empty>
        ) : (
          groups.map((g) => (
            <React.Fragment key={g.label}>
              <div
                className="mono"
                style={{
                  fontSize: 11,
                  letterSpacing: ".18em",
                  textTransform: "uppercase",
                  color: "var(--ink-35)",
                  marginBottom: 16,
                  marginTop: g.first ? 0 : 28,
                }}
              >
                {g.label}
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(12, 1fr)",
                  gridAutoRows: "110px",
                  gap: 12,
                  marginBottom: 32,
                }}
              >
                {g.items.map((m, j) => (
                  <BeautyCard
                    key={m.id}
                    m={m}
                    span={spanFor(j, g.items.length)}
                    onClick={() => setOpen(items.findIndex((i) => i.id === m.id))}
                  />
                ))}
              </div>
            </React.Fragment>
          ))
        )}
      </div>

      {drag && role === "esui" && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(26,29,44,0.05)",
            display: "grid",
            placeItems: "center",
            pointerEvents: "none",
            zIndex: 4,
          }}
        >
          <div
            style={{
              border: "2px dashed var(--ink-35)",
              color: "var(--ink-50)",
              fontFamily: "var(--serif)",
              fontStyle: "italic",
              fontSize: 16,
              padding: "24px 32px",
              borderRadius: 10,
              background: "var(--surface)",
            }}
          >
            drop to add
          </div>
        </div>
      )}

      {open != null && items[open] && (
        <Lightbox
          m={items[open]}
          role={role}
          onClose={() => setOpen(null)}
          onPrev={() => setOpen((open - 1 + items.length) % items.length)}
          onNext={() => setOpen((open + 1) % items.length)}
          onDelete={() => onDelete(items[open].id)}
        />
      )}
    </div>
  );
}

function BeautyCard({ m, span = "c4 r2", onClick }) {
  const [c, r] = span.split(" ");
  const cw = +c.slice(1);
  const rh = +r.slice(1);
  return (
    <button
      onClick={onClick}
      style={{
        gridColumn: `span ${cw}`,
        gridRow: `span ${rh}`,
        background: "var(--ink-06)",
        borderRadius: 6,
        overflow: "hidden",
        cursor: "pointer",
        position: "relative",
        boxShadow: "0 1px 2px rgba(26,29,44,.05), 0 8px 30px -12px rgba(26,29,44,.18)",
        padding: 0,
      }}
    >
      {m.url ? (
        m.kind === "video" ? (
          <video
            src={m.url}
            preload="metadata"
            muted
            playsInline
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        ) : (
          <img
            src={m.url}
            alt={m.caption || ""}
            loading="lazy"
            decoding="async"
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        )
      ) : (
        <Skel style={{ width: "100%", height: "100%", borderRadius: 6 }} />
      )}
      {m.kind === "video" && (
        <div
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            padding: "2px 6px",
            borderRadius: 4,
            background: "rgba(13,15,23,.5)",
            color: "#fbf8f1",
            fontSize: 10,
            fontFamily: "var(--mono)",
            letterSpacing: ".08em",
            textTransform: "uppercase",
          }}
        >
          video
        </div>
      )}
      {m.caption && (
        <div
          className="caption"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            padding: "22px 14px 10px",
            background: "linear-gradient(to top, rgba(13,15,23,.55), transparent)",
            color: "#fbf8f1",
            fontFamily: "var(--serif)",
            fontSize: 13,
            fontStyle: "italic",
            opacity: 0,
            transition: "opacity .2s",
          }}
        >
          {m.caption}
        </div>
      )}
    </button>
  );
}

function Lightbox({ m, role, onClose, onPrev, onNext, onDelete }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") onPrev();
      if (e.key === "ArrowRight") onNext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onPrev, onNext]);

  const [confirmDel, setConfirmDel] = useState(false);

  return (
    <div
      className="fi"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(13,15,23,.85)",
        backdropFilter: "blur(8px)",
        zIndex: 60,
        display: "grid",
        gridTemplateRows: "1fr auto",
        padding: "40px 80px",
      }}
    >
      <div onClick={onClose} style={{ display: "grid", placeItems: "center", borderRadius: 8 }}>
        {m.url &&
          (m.kind === "video" ? (
            <video src={m.url} controls autoPlay style={{ maxWidth: "100%", maxHeight: "100%" }} />
          ) : (
            <img
              src={m.url}
              alt={m.caption || ""}
              style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
            />
          ))}
      </div>
      <div style={{ paddingTop: 18, color: "#fbf8f1", display: "flex", alignItems: "baseline", gap: 18 }}>
        <div style={{ fontFamily: "var(--serif)", fontSize: 18, fontStyle: "italic" }}>{m.caption || ""}</div>
        <div style={{ flex: 1 }} />
        <div className="mono" style={{ fontSize: 11, opacity: 0.7 }}>
          {fmtTaken(m.taken_at) || fmtTaken(m.created_at)}
        </div>
        {role === "esui" &&
          (confirmDel ? (
            <>
              <button onClick={onDelete} style={{ color: "#fbf8f1", padding: 6, fontSize: 12 }}>
                remove
              </button>
              <button onClick={() => setConfirmDel(false)} style={{ color: "#fbf8f1", padding: 6, fontSize: 12, opacity: 0.6 }}>
                cancel
              </button>
            </>
          ) : (
            <button onClick={() => setConfirmDel(true)} style={{ color: "#fbf8f1", padding: 6, opacity: 0.6 }}>
              <I.close size={16} />
            </button>
          ))}
        <button onClick={onClose} style={{ color: "#fbf8f1", padding: 6 }}>
          <I.close size={16} />
        </button>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onPrev();
        }}
        style={{ position: "absolute", left: 24, top: "50%", color: "#fbf8f1", padding: 14 }}
      >
        <I.back size={18} />
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onNext();
        }}
        style={{ position: "absolute", right: 24, top: "50%", color: "#fbf8f1", padding: 14, transform: "rotate(180deg)" }}
      >
        <I.back size={18} />
      </button>
    </div>
  );
}

// ─── helpers ─────────────────────────────────────────────────────────────────

const SPANS = [
  ["c5 r3", "c3 r2", "c4 r2", "c3 r1", "c4 r1", "c5 r2", "c3 r2"],
  ["c4 r2", "c4 r2", "c4 r2", "c3 r1", "c5 r1", "c3 r2"],
];

function spanFor(idx, total) {
  return SPANS[0][idx % SPANS[0].length];
}

function fmtTaken(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function groupByEra(items) {
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - 7);

  const week = [];
  const earlier = {};
  for (const m of items) {
    const d = new Date(m.created_at);
    if (d > startOfWeek) {
      week.push(m);
    } else {
      const label = d.toLocaleString([], { month: "long" }).toLowerCase();
      if (!earlier[label]) earlier[label] = [];
      earlier[label].push(m);
    }
  }

  const groups = [];
  if (week.length) groups.push({ label: "this week", items: week, first: true });
  let first = !groups.length;
  for (const [label, list] of Object.entries(earlier)) {
    groups.push({ label, items: list, first });
    first = false;
  }
  return groups;
}

export { BeautyView };
