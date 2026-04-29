"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, API_URL } from "@/lib/api";
import { getAuthToken } from "@/lib/auth-store";
import type { TogetherMedia } from "@/lib/types";

const ACCEPT = "image/*,video/*";

export function TogetherWidget() {
  const [items, setItems] = useState<TogetherMedia[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(0);
  const [drag, setDrag] = useState(false);
  const [expanded, setExpanded] = useState<TogetherMedia | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);
  // Depth counter prevents the drop overlay from flickering when the cursor
  // crosses child boundaries (dragenter/dragleave fire on every child).
  const dragDepth = useRef(0);

  const load = async () => {
    setLoading(true);
    try {
      const rows = await api.get<TogetherMedia[]>("/api/v1/together/media?limit=200");
      setItems(rows);
    } catch {
      // soft failure
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const upload = useCallback(async (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    const token = getAuthToken();
    setUploading((n) => n + 1);
    try {
      const res = await fetch(`${API_URL}/api/v1/together/media`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: fd,
      });
      if (!res.ok) throw new Error(String(res.status));
      const created = (await res.json()) as TogetherMedia;
      setItems((prev) => [created, ...prev]);
    } catch {
      // silent fail; user can retry
    } finally {
      setUploading((n) => n - 1);
    }
  }, []);

  const onFiles = useCallback(
    (list: FileList | File[]) => {
      const files = Array.from(list);
      for (const f of files) {
        if (!f.type.startsWith("image/") && !f.type.startsWith("video/")) continue;
        void upload(f);
      }
    },
    [upload],
  );

  const onDelete = async (id: string) => {
    setItems((p) => p.filter((m) => m.id !== id));
    setExpanded(null);
    api.delete(`/api/v1/together/media/${id}`).catch(() => load());
  };

  return (
    <div
      style={sS.container}
      onDragEnter={(e) => {
        e.preventDefault();
        dragDepth.current += 1;
        if (dragDepth.current === 1) setDrag(true);
      }}
      onDragOver={(e) => {
        e.preventDefault();
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        dragDepth.current = Math.max(0, dragDepth.current - 1);
        if (dragDepth.current === 0) setDrag(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        dragDepth.current = 0;
        setDrag(false);
        if (e.dataTransfer.files?.length) onFiles(e.dataTransfer.files);
      }}
    >
      <header style={sS.header}>
        <div>
          <h2 style={sS.title}>Together</h2>
          <p style={sS.sub}>
            {items.length} {items.length === 1 ? "item" : "items"}
            {uploading > 0 && <span style={sS.uploading}> · uploading {uploading}…</span>}
          </p>
        </div>
        <button style={sS.uploadBtn} onClick={() => fileInput.current?.click()}>
          add media
        </button>
        <input
          ref={fileInput}
          type="file"
          accept={ACCEPT}
          multiple
          style={{ display: "none" }}
          onChange={(e) => {
            if (e.target.files) onFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </header>

      {drag && (
        <div style={sS.dropOverlay}>
          <div style={sS.dropInner}>drop to add</div>
        </div>
      )}

      {loading && items.length === 0 ? (
        <div style={sS.grid}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} style={sS.skeleton} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div style={sS.empty}>
          <p style={sS.emptyTitle}>nothing here yet</p>
          <p style={sS.emptyHint}>drag images or videos in, or use add media</p>
        </div>
      ) : (
        <div style={sS.grid}>
          {items.map((m) => (
            <MediaCard key={m.id} media={m} onClick={() => setExpanded(m)} />
          ))}
        </div>
      )}

      {expanded && (
        <Lightbox
          media={expanded}
          onClose={() => setExpanded(null)}
          onDelete={onDelete}
        />
      )}
    </div>
  );
}

// ---------- card ----------

function MediaCard({
  media,
  onClick,
}: {
  media: TogetherMedia;
  onClick: () => void;
}) {
  // URL is pre-signed by the backend at list/upload time — no per-card
  // round-trip. Falls back to a one-shot fetch only if missing.
  const [url, setUrl] = useState<string | null>(media.url || null);

  useEffect(() => {
    if (media.url) {
      setUrl(media.url);
      return;
    }
    let cancelled = false;
    api
      .post<{ url: string }>(`/api/v1/together/media/${media.id}/url`)
      .then((r) => {
        if (!cancelled) setUrl(r.url);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [media.id, media.url]);

  return (
    <button style={sS.card} onClick={onClick}>
      {url ? (
        media.kind === "image" ? (
          <img
            src={url}
            alt={media.caption || ""}
            loading="lazy"
            decoding="async"
            style={sS.media}
          />
        ) : (
          <video
            src={url}
            preload="metadata"
            muted
            playsInline
            style={sS.media}
          />
        )
      ) : (
        <div style={sS.mediaSkeleton} />
      )}
      {media.kind === "video" && <span style={sS.videoChip}>video</span>}
    </button>
  );
}

// ---------- lightbox ----------

function Lightbox({
  media,
  onClose,
  onDelete,
}: {
  media: TogetherMedia;
  onClose: () => void;
  onDelete: (id: string) => void;
}) {
  // Reuse the URL from the card; only re-sign if the list shipped without one.
  const [url, setUrl] = useState<string | null>(media.url || null);
  const [confirmDel, setConfirmDel] = useState(false);

  useEffect(() => {
    if (media.url) return;
    let cancelled = false;
    api
      .post<{ url: string }>(`/api/v1/together/media/${media.id}/url`)
      .then((r) => {
        if (!cancelled) setUrl(r.url);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [media.id, media.url]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div style={sS.lbBackdrop} onClick={onClose}>
      <div style={sS.lbBody} onClick={(e) => e.stopPropagation()}>
        <button style={sS.lbClose} onClick={onClose} aria-label="Close">
          ×
        </button>
        {url ? (
          media.kind === "image" ? (
            <img src={url} alt={media.caption || ""} style={sS.lbMedia} />
          ) : (
            <video src={url} controls autoPlay style={sS.lbMedia} />
          )
        ) : null}
        <footer style={sS.lbFooter}>
          <p style={sS.lbCaption}>{media.caption || media.filename}</p>
          {confirmDel ? (
            <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button style={sS.delBtn} onClick={() => onDelete(media.id)}>
                remove
              </button>
              <button style={sS.ghostBtn} onClick={() => setConfirmDel(false)}>
                cancel
              </button>
            </span>
          ) : (
            <button style={sS.ghostBtn} onClick={() => setConfirmDel(true)}>
              remove
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}

// ---------- styles ----------

const sS: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    overflow: "hidden",
    position: "relative",
    background: "var(--page)",
  },
  header: {
    padding: "20px 24px 14px",
    borderBottom: "1px solid var(--border)",
    background: "var(--white)",
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: 300,
    fontFamily: "var(--serif)",
    color: "var(--navy)",
    margin: 0,
    letterSpacing: -0.2,
  },
  sub: { fontSize: 12, color: "var(--navy-45)", margin: "4px 0 0" },
  uploading: { color: "var(--navy-60)" },
  uploadBtn: {
    fontSize: 12.5,
    background: "var(--navy)",
    color: "var(--white)",
    border: "none",
    padding: "8px 16px",
    borderRadius: 6,
    cursor: "pointer",
    fontWeight: 500,
    letterSpacing: 0.2,
  },

  dropOverlay: {
    position: "absolute",
    inset: 0,
    background: "rgba(0,0,0,0.04)",
    pointerEvents: "none",
    zIndex: 5,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  dropInner: {
    border: "2px dashed var(--navy-35)",
    color: "var(--navy-60)",
    fontSize: 14,
    padding: "24px 32px",
    borderRadius: 10,
    background: "var(--white)",
  },

  grid: {
    flex: 1,
    overflow: "auto",
    padding: "20px 24px 32px",
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
    gap: 12,
    alignContent: "start",
  },
  card: {
    aspectRatio: "1 / 1",
    overflow: "hidden",
    borderRadius: 8,
    border: "1px solid var(--border)",
    background: "var(--surface, var(--white))",
    cursor: "pointer",
    padding: 0,
    position: "relative",
    display: "block",
  },
  media: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
  },
  mediaSkeleton: {
    width: "100%",
    height: "100%",
    background:
      "linear-gradient(110deg, var(--surface) 8%, var(--vanilla) 18%, var(--surface) 33%)",
    backgroundSize: "200% 100%",
    animation: "shimmer 1.6s infinite linear",
  },
  skeleton: {
    aspectRatio: "1 / 1",
    borderRadius: 8,
    background:
      "linear-gradient(110deg, var(--surface) 8%, var(--vanilla) 18%, var(--surface) 33%)",
    backgroundSize: "200% 100%",
    animation: "shimmer 1.6s infinite linear",
  },
  videoChip: {
    position: "absolute",
    bottom: 8,
    left: 8,
    fontSize: 10.5,
    letterSpacing: 0.4,
    background: "rgba(0,0,0,0.55)",
    color: "#fff",
    padding: "2px 7px",
    borderRadius: 4,
    textTransform: "uppercase",
  },

  empty: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: 6,
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: "var(--serif)",
    color: "var(--navy-60)",
    margin: 0,
  },
  emptyHint: { fontSize: 12, color: "var(--navy-45)", margin: 0 },

  // lightbox
  lbBackdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.78)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 50,
    padding: 24,
  },
  lbBody: {
    background: "var(--white)",
    borderRadius: 10,
    overflow: "hidden",
    maxWidth: "min(92vw, 1100px)",
    maxHeight: "92vh",
    display: "flex",
    flexDirection: "column",
    boxShadow: "0 30px 80px rgba(0,0,0,0.4)",
    position: "relative",
  },
  lbClose: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    background: "rgba(255,255,255,0.92)",
    border: "none",
    color: "var(--navy)",
    fontSize: 20,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 51,
  },
  lbMedia: {
    maxWidth: "100%",
    maxHeight: "calc(92vh - 80px)",
    objectFit: "contain",
    display: "block",
    background: "#000",
  },
  lbFooter: {
    padding: "14px 18px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderTop: "1px solid var(--border)",
  },
  lbCaption: {
    fontSize: 13,
    color: "var(--navy-70)",
    margin: 0,
    fontFamily: "var(--serif)",
    fontStyle: "italic",
    flex: 1,
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  ghostBtn: {
    fontSize: 12,
    background: "transparent",
    color: "var(--navy-60)",
    border: "1px solid var(--border)",
    padding: "5px 12px",
    borderRadius: 6,
    cursor: "pointer",
  },
  delBtn: {
    fontSize: 12,
    background: "#c0534d",
    color: "#fff",
    border: "none",
    padding: "6px 14px",
    borderRadius: 6,
    cursor: "pointer",
    fontWeight: 500,
  },
};
