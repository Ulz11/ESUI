"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { VaultDocument, VaultSearchHit } from "@/lib/types";

const TYPE_COL: Record<string, string> = {
  note: "#5b9ab8",
  research: "#3e6f54",
  draft: "#b5893a",
  journal: "#8b6fba",
  reference: "#888",
};

type View = "list" | "graph" | "doc";

export function VaultWidget() {
  const [view, setView] = useState<View>("list");
  const [query, setQuery] = useState("");
  const [docs, setDocs] = useState<VaultDocument[]>([]);
  const [hits, setHits] = useState<VaultSearchHit[] | null>(null);
  const [activeDoc, setActiveDoc] = useState<VaultDocument | null>(null);
  const [docMd, setDocMd] = useState("");
  const [docTitle, setDocTitle] = useState("");
  const [saveStatus, setSaveStatus] = useState<
    "saved" | "saving…" | "indexing…"
  >("saved");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // load docs
  useEffect(() => {
    let cancelled = false;
    api
      .get<VaultDocument[]>("/api/v1/vault/documents?limit=200")
      .then((rows) => {
        if (cancelled) return;
        setDocs(rows);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // debounced semantic search
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!query.trim()) {
      setHits(null);
      return;
    }
    searchTimer.current = setTimeout(() => {
      api
        .post<VaultSearchHit[]>("/api/v1/vault/search", {
          query: query.trim(),
          limit: 20,
          mode: "hybrid",
        })
        .then(setHits)
        .catch(() => setHits([]));
    }, 200);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [query]);

  const openDoc = async (id: string) => {
    try {
      const doc = await api.get<VaultDocument>(`/api/v1/vault/documents/${id}`);
      setActiveDoc(doc);
      setDocTitle(doc.title);
      setDocMd(doc.content_md);
      setView("doc");
      setSaveStatus("saved");
    } catch {}
  };

  const newDoc = async () => {
    try {
      const doc = await api.post<VaultDocument>("/api/v1/vault/documents", {
        title: "Untitled",
        content_md: "",
        content_type: "note",
      });
      setDocs((p) => [doc, ...p]);
      setActiveDoc(doc);
      setDocTitle(doc.title);
      setDocMd(doc.content_md);
      setView("doc");
    } catch {}
  };

  const onChange = (md: string, title?: string) => {
    if (title !== undefined) setDocTitle(title);
    else setDocMd(md);
    if (!activeDoc) return;
    setSaveStatus("saving…");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        const updated = await api.patch<VaultDocument>(
          `/api/v1/vault/documents/${activeDoc.id}`,
          {
            title: title !== undefined ? title : activeDoc.title,
            content_md: title !== undefined ? activeDoc.content_md : md,
          }
        );
        setActiveDoc(updated);
        setDocs((prev) =>
          prev.map((d) => (d.id === updated.id ? updated : d))
        );
        setSaveStatus("indexing…");
        setTimeout(() => setSaveStatus("saved"), 800);
      } catch {
        setSaveStatus("saved");
      }
    }, 900);
  };

  const filteredList: VaultDocument[] =
    hits === null
      ? docs
      : (hits
          .map((h) => docs.find((d) => d.id === h.document_id))
          .filter(Boolean) as VaultDocument[]);

  return (
    <div style={vS.container}>
      <div style={vS.header}>
        <div style={vS.searchRow}>
          <SearchIcon />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="search your vault"
            style={vS.searchInput}
            autoFocus={view === "list"}
            aria-label="search vault"
          />
        </div>
        <div style={vS.tabs}>
          {(
            [
              ["list", "List"],
              ["graph", "Graph"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              style={{
                ...vS.tab,
                ...(view === id || (view === "doc" && id === "list")
                  ? vS.tabActive
                  : {}),
              }}
              onClick={() => {
                setView(id);
                setActiveDoc(null);
              }}
            >
              {label}
            </button>
          ))}
          <button style={vS.newBtn} onClick={newDoc}>
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
              <path
                d="M5.5 1v9M1 5.5h9"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
            new
          </button>
        </div>
      </div>

      {view === "list" && (
        <div style={vS.list}>
          {filteredList.length === 0 ? (
            <div style={vS.empty}>
              <p
                style={{
                  fontFamily: "var(--serif)",
                  fontStyle: "italic",
                  color: "var(--navy-60)",
                }}
              >
                nothing in your vault yet — write the first thing on your mind
              </p>
            </div>
          ) : (
            filteredList.map((doc) => {
              const hit = hits?.find((h) => h.document_id === doc.id);
              return (
                <button
                  key={doc.id}
                  style={vS.docRow}
                  onClick={() => openDoc(doc.id)}
                >
                  <span
                    style={{
                      ...vS.typePill,
                      background:
                        (TYPE_COL[doc.content_type] || "#888") + "18",
                      color: TYPE_COL[doc.content_type] || "#888",
                    }}
                  >
                    {doc.content_type}
                  </span>
                  <div
                    style={{
                      flex: 1,
                      minWidth: 0,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-start",
                    }}
                  >
                    <span
                      style={{
                        fontSize: 13.5,
                        fontFamily: "var(--serif)",
                        color: "var(--navy)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        textAlign: "left",
                        maxWidth: "100%",
                      }}
                    >
                      {doc.title}
                    </span>
                    {hit?.snippet && (
                      <span
                        style={{
                          fontSize: 11.5,
                          color: "var(--navy-45)",
                          fontFamily: "var(--serif)",
                          fontStyle: "italic",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          maxWidth: "100%",
                          marginTop: 2,
                        }}
                      >
                        {hit.snippet}
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 7,
                      flexShrink: 0,
                    }}
                  >
                    {doc.shared && (
                      <span
                        style={{ fontSize: 11, color: "var(--navy-35)" }}
                        title="shared"
                      >
                        ↗
                      </span>
                    )}
                    <span style={{ fontSize: 11.5, color: "var(--navy-35)" }}>
                      {formatRelative(doc.updated_at)}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      )}

      {view === "graph" && <VaultGraph />}

      {view === "doc" && activeDoc && (
        <div style={vS.docEditor}>
          <div style={vS.docBar}>
            <button style={vS.backBtn} onClick={() => setView("list")}>
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <path
                  d="M8 3L4 6.5l4 3.5"
                  stroke="currentColor"
                  strokeWidth="1.3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Vault
            </button>
            <input
              value={docTitle}
              onChange={(e) => onChange(docMd, e.target.value)}
              style={vS.docTitleInput}
              aria-label="document title"
            />
            <span
              style={{
                ...vS.saveStatus,
                color:
                  saveStatus === "saved" ? "var(--navy-35)" : "var(--sky)",
              }}
            >
              {saveStatus}
            </span>
          </div>
          <textarea
            value={docMd}
            onChange={(e) => onChange(e.target.value)}
            style={vS.editor}
            autoFocus
            placeholder="…"
          />
        </div>
      )}
    </div>
  );
}

function VaultGraph() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const frameRef = useRef(0);
  const dataRef = useRef<{
    nodes: Array<{
      id: string;
      label: string;
      content_type: string;
      px: number;
      py: number;
      vx: number;
      vy: number;
      w: number;
    }>;
    edges: Array<[string, string]>;
  }>({ nodes: [], edges: [] });
  const [empty, setEmpty] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .get<{
        nodes: Array<{
          id: string;
          label: string;
          content_type?: string;
          centrality?: number;
          x?: number;
          y?: number;
        }>;
        edges: Array<{ source: string; target: string }>;
      }>("/api/v1/vault/graph?depth=2&max_nodes=80")
      .then((g) => {
        if (cancelled) return;
        if (!g.nodes.length) {
          setEmpty(true);
          return;
        }
        const canvas = canvasRef.current;
        const W = canvas?.offsetWidth || 800;
        const H = canvas?.offsetHeight || 500;
        dataRef.current = {
          nodes: g.nodes.map((n) => ({
            id: n.id,
            label: n.label,
            content_type: n.content_type || "note",
            px: (n.x ?? Math.random()) * W,
            py: (n.y ?? Math.random()) * H,
            vx: 0,
            vy: 0,
            w: n.centrality ?? 0.5,
          })),
          edges: g.edges.map((e) => [e.source, e.target] as [string, string]),
        };
        startSim();
      })
      .catch(() => setEmpty(true));
    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function startSim() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.offsetWidth;
    const H = canvas.offsetHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    const draw = () => {
      frameRef.current++;
      const { nodes, edges } = dataRef.current;
      const cooling = Math.max(0.05, 1 - frameRef.current * 0.004);

      if (frameRef.current < 220) {
        for (let i = 0; i < nodes.length; i++) {
          nodes[i].vx *= 0.82;
          nodes[i].vy *= 0.82;
          for (let j = 0; j < nodes.length; j++) {
            if (i === j) continue;
            const dx = nodes[i].px - nodes[j].px;
            const dy = nodes[i].py - nodes[j].py;
            const d = Math.sqrt(dx * dx + dy * dy) || 1;
            const f = (1800 / (d * d)) * cooling;
            nodes[i].vx += (dx / d) * f;
            nodes[i].vy += (dy / d) * f;
          }
          nodes[i].vx += (W / 2 - nodes[i].px) * 0.004;
          nodes[i].vy += (H / 2 - nodes[i].py) * 0.004;
        }
        edges.forEach(([aid, bid]) => {
          const a = nodes.find((n) => n.id === aid);
          const b = nodes.find((n) => n.id === bid);
          if (!a || !b) return;
          const dx = b.px - a.px,
            dy = b.py - a.py;
          const d = Math.sqrt(dx * dx + dy * dy) || 1;
          const f = (d - 90) * 0.035 * cooling;
          a.vx += (dx / d) * f;
          a.vy += (dy / d) * f;
          b.vx -= (dx / d) * f;
          b.vy -= (dy / d) * f;
        });
        nodes.forEach((n) => {
          n.px = Math.max(50, Math.min(W - 50, n.px + n.vx));
          n.py = Math.max(40, Math.min(H - 40, n.py + n.vy));
        });
      }

      ctx.clearRect(0, 0, W, H);
      edges.forEach(([aid, bid]) => {
        const a = nodes.find((n) => n.id === aid);
        const b = nodes.find((n) => n.id === bid);
        if (!a || !b) return;
        ctx.beginPath();
        ctx.moveTo(a.px, a.py);
        ctx.lineTo(b.px, b.py);
        ctx.strokeStyle = "rgba(28,31,46,.08)";
        ctx.lineWidth = 1;
        ctx.stroke();
      });
      nodes.forEach((n) => {
        const r = 5 + n.w * 9;
        const col = TYPE_COL[n.content_type] || "#888";
        ctx.beginPath();
        ctx.arc(n.px, n.py, r, 0, Math.PI * 2);
        ctx.fillStyle = col + "30";
        ctx.fill();
        ctx.strokeStyle = col + "aa";
        ctx.lineWidth = 1.2;
        ctx.stroke();
        if (n.w > 0.55) {
          ctx.font = "11px Inter, sans-serif";
          ctx.fillStyle = "rgba(28,31,46,.55)";
          ctx.textAlign = "center";
          ctx.fillText(n.label, n.px, n.py + r + 14);
        }
      });
      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);
  }

  if (empty) {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 40,
        }}
      >
        <p
          style={{
            fontFamily: "var(--serif)",
            fontStyle: "italic",
            color: "var(--navy-35)",
            textAlign: "center",
            lineHeight: 1.7,
          }}
        >
          your constellation is still forming
          <br />— write a few notes and links will emerge
        </p>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: "100%", display: "block" }}
      />
      <div
        style={{
          position: "absolute",
          bottom: 16,
          left: 20,
          display: "flex",
          gap: 14,
          flexWrap: "wrap",
        }}
      >
        {Object.entries(TYPE_COL).map(([type, color]) => (
          <span
            key={type}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              fontSize: 11,
              color: "var(--navy-60)",
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: color,
                display: "inline-block",
              }}
            />
            {type}
          </span>
        ))}
      </div>
      <div
        style={{
          position: "absolute",
          top: 16,
          right: 20,
          fontSize: 12,
          color: "var(--navy-35)",
          fontFamily: "var(--serif)",
          fontStyle: "italic",
        }}
      >
        her thinking as a constellation
      </div>
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

const SearchIcon = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 15 15"
    fill="none"
    style={{ color: "var(--navy-35)", flexShrink: 0 }}
  >
    <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.3" />
    <path
      d="M10 10L12.5 12.5"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
    />
  </svg>
);

const vS: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    overflow: "hidden",
  },
  header: {
    padding: "20px 24px 0",
    display: "flex",
    flexDirection: "column",
    gap: 10,
    borderBottom: "1px solid var(--vanilla-border)",
    background: "var(--white)",
  },
  searchRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "9px 12px",
    background: "var(--vanilla)",
    border: "1px solid var(--vanilla-border)",
    borderRadius: "var(--rs)",
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "var(--navy)",
    fontFamily: "var(--serif)",
  },
  tabs: { display: "flex", alignItems: "center", gap: 2 },
  tab: {
    fontSize: 12,
    fontWeight: 500,
    padding: "7px 12px",
    color: "var(--navy-60)",
    borderRadius: "var(--rs) var(--rs) 0 0",
    cursor: "pointer",
    border: "1px solid transparent",
    borderBottom: "none",
  },
  tabActive: {
    color: "var(--navy)",
    background: "var(--vanilla)",
    border: "1px solid var(--vanilla-border)",
    borderBottom: "1px solid var(--vanilla)",
  },
  newBtn: {
    marginLeft: "auto",
    display: "flex",
    alignItems: "center",
    gap: 5,
    fontSize: 12,
    fontWeight: 500,
    color: "var(--navy-60)",
    padding: "5px 10px",
    borderRadius: "var(--rs)",
    border: "1px solid var(--vanilla-border)",
    background: "var(--vanilla)",
    cursor: "pointer",
  },
  list: { flex: 1, overflowY: "auto", padding: "4px 0" },
  empty: { padding: "60px 24px", textAlign: "center" },
  docRow: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "12px 24px",
    borderBottom: "1px solid var(--vanilla-border)",
    cursor: "pointer",
    background: "none",
    transition: "background .1s",
  },
  typePill: {
    fontSize: 10.5,
    fontWeight: 500,
    letterSpacing: ".04em",
    padding: "2px 7px",
    borderRadius: 10,
    flexShrink: 0,
  },
  docEditor: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  docBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    padding: "10px 24px",
    borderBottom: "1px solid var(--vanilla-border)",
    background: "var(--white)",
    flexShrink: 0,
  },
  docTitleInput: {
    flex: 1,
    fontSize: 18,
    fontFamily: "var(--serif)",
    color: "var(--navy)",
    fontWeight: 400,
    background: "none",
  },
  backBtn: {
    display: "flex",
    alignItems: "center",
    gap: 5,
    fontSize: 12.5,
    color: "var(--navy-60)",
    cursor: "pointer",
    flexShrink: 0,
  },
  saveStatus: {
    fontSize: 12,
    fontStyle: "italic",
    fontFamily: "var(--serif)",
    transition: "color .3s",
    flexShrink: 0,
  },
  editor: {
    flex: 1,
    resize: "none",
    border: "none",
    outline: "none",
    fontFamily: "var(--serif)",
    fontSize: 15.5,
    lineHeight: 1.85,
    color: "var(--navy)",
    background: "var(--vanilla)",
    padding: "40px 20% 80px",
  },
};
