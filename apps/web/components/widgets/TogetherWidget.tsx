"use client";

import { useEffect, useState } from "react";
import { api, API_URL } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import type { TogetherPhoto } from "@/lib/types";

const GRADIENTS = [
  "linear-gradient(135deg,#e8d5c4 0%,#c8dce8 100%)",
  "linear-gradient(135deg,#c8cee8 0%,#e8c4d4 100%)",
  "linear-gradient(135deg,#d4e8c6 0%,#e8e0c4 100%)",
  "linear-gradient(135deg,#dcd0e8 0%,#c8e0d8 100%)",
];

export function TogetherWidget() {
  const [photos, setPhotos] = useState<TogetherPhoto[]>([]);
  const [expanded, setExpanded] = useState<TogetherPhoto | null>(null);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    api
      .get<TogetherPhoto[]>("/api/v1/together/photos?limit=50")
      .then(setPhotos)
      .catch(() => {});
  }, []);

  useEffect(() => {
    const s = getSocket();
    if (!s) return;
    const onReady = (p: { photo_id: string }) => {
      api
        .get<TogetherPhoto>(`/api/v1/together/photos/${p.photo_id}`)
        .then((photo) => {
          setPhotos((prev) =>
            prev.some((x) => x.id === photo.id)
              ? prev.map((x) => (x.id === photo.id ? photo : x))
              : [photo, ...prev]
          );
        })
        .catch(() => {});
    };
    s.on("composite:ready", onReady);
    return () => {
      s.off("composite:ready", onReady);
    };
  }, []);

  // resolve signed URLs for ready photos with a composite_file_id
  useEffect(() => {
    photos.forEach((p) => {
      if (p.composite_file_id && !signedUrls[p.composite_file_id]) {
        api
          .post<{ signed_url: string }>(
            `/api/v1/files/${p.composite_file_id}/url`
          )
          .then((res) =>
            setSignedUrls((prev) => ({
              ...prev,
              [p.composite_file_id as string]: res.signed_url,
            }))
          )
          .catch(() => {});
      }
    });
  }, [photos, signedUrls]);

  return (
    <div style={tS.container}>
      <div style={tS.header}>
        <h2 style={tS.title}>Together</h2>
        <p style={tS.sub}>just the two of you</p>
      </div>

      <div style={tS.gallery}>
        {photos.length === 0 && (
          <div style={tS.empty}>
            <p style={tS.emptyText}>
              the first photo will land here when one of you accepts a moment
            </p>
          </div>
        )}
        {photos.map((photo, i) => {
          const url = photo.composite_file_id
            ? signedUrls[photo.composite_file_id]
            : null;
          const grad = GRADIENTS[i % GRADIENTS.length];
          return (
            <button
              key={photo.id}
              style={tS.card}
              onClick={() => setExpanded(photo)}
            >
              <div
                style={{
                  ...tS.img,
                  background: url ? `url(${url}) center/cover` : grad,
                }}
              >
                {!url && <AvatarPair />}
                {photo.status === "composing" && (
                  <span style={tS.statusPill}>composing…</span>
                )}
              </div>
              <div style={tS.meta}>
                <p style={tS.caption}>
                  {photo.scene_prompt || "a small moment"}
                </p>
                <p style={tS.date}>
                  {new Date(photo.created_at).toLocaleDateString(undefined, {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {expanded && (
        <div style={tS.overlay} onClick={() => setExpanded(null)}>
          <div
            style={tS.modal}
            onClick={(e) => e.stopPropagation()}
            className="anim-fade-up"
          >
            <div
              style={{
                ...tS.modalImg,
                background: expanded.composite_file_id &&
                  signedUrls[expanded.composite_file_id]
                  ? `url(${signedUrls[expanded.composite_file_id]}) center/cover`
                  : GRADIENTS[0],
              }}
            >
              {!(
                expanded.composite_file_id &&
                signedUrls[expanded.composite_file_id]
              ) && <AvatarPair large />}
            </div>
            <div style={tS.modalMeta}>
              <p style={tS.modalCaption}>
                {expanded.scene_prompt || "a small moment"}
              </p>
              <p style={tS.modalDate}>
                {new Date(expanded.created_at).toLocaleDateString(undefined, {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
              <button style={tS.closeBtn} onClick={() => setExpanded(null)}>
                close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const AvatarPair = ({ large }: { large?: boolean }) => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: large ? 16 : 10,
    }}
  >
    {(["E", "B"] as const).map((l, i) => (
      <div
        key={l}
        style={{
          width: large ? 44 : 28,
          height: large ? 44 : 28,
          borderRadius: "50%",
          background: i === 0 ? "rgba(255,255,255,.35)" : "rgba(255,255,255,.25)",
          border: "1.5px solid rgba(255,255,255,.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span
          style={{
            fontSize: large ? 18 : 11,
            fontFamily: "var(--serif)",
            color: "rgba(255,255,255,.85)",
          }}
        >
          {l}
        </span>
      </div>
    ))}
  </div>
);

const tS: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    overflow: "hidden",
  },
  header: {
    padding: "18px 28px 14px",
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
  sub: {
    fontSize: 12,
    color: "var(--navy-35)",
    fontStyle: "italic",
    fontFamily: "var(--serif)",
    marginTop: 2,
  },
  gallery: {
    flex: 1,
    overflowY: "auto",
    padding: "24px 28px",
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill,minmax(230px,1fr))",
    gap: 14,
    alignContent: "start",
  },
  card: {
    textAlign: "left",
    borderRadius: "var(--rs)",
    overflow: "hidden",
    border: "1px solid var(--vanilla-border)",
    background: "var(--white)",
    cursor: "pointer",
    display: "block",
    transition: "transform .15s",
  },
  img: { width: "100%", paddingBottom: "72%", position: "relative" },
  meta: { padding: "11px 13px" },
  caption: {
    fontSize: 12.5,
    fontFamily: "var(--serif)",
    fontStyle: "italic",
    color: "var(--navy)",
    lineHeight: 1.45,
    marginBottom: 4,
  },
  date: { fontSize: 11, color: "var(--navy-35)" },
  empty: {
    borderRadius: "var(--rs)",
    border: "1.5px dashed var(--vanilla-border)",
    padding: "40px 20px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "var(--vanilla)",
    minHeight: 180,
    gridColumn: "1 / -1",
  },
  emptyText: {
    fontSize: 13,
    fontFamily: "var(--serif)",
    fontStyle: "italic",
    color: "var(--navy-35)",
    textAlign: "center",
    lineHeight: 1.6,
  },
  statusPill: {
    position: "absolute",
    bottom: 10,
    left: 10,
    fontSize: 11,
    background: "rgba(255,255,255,.9)",
    padding: "3px 8px",
    borderRadius: 12,
    color: "var(--navy-60)",
    fontStyle: "italic",
  },
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(28,31,46,.55)",
    backdropFilter: "blur(6px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
  },
  modal: {
    background: "var(--white)",
    borderRadius: "var(--rs)",
    overflow: "hidden",
    maxWidth: 600,
    width: "90%",
  },
  modalImg: { width: "100%", paddingBottom: "62%", position: "relative" },
  modalMeta: {
    padding: "16px 20px",
    display: "flex",
    flexDirection: "column",
    gap: 5,
  },
  modalCaption: {
    fontSize: 14,
    fontFamily: "var(--serif)",
    fontStyle: "italic",
    color: "var(--navy)",
    lineHeight: 1.5,
  },
  modalDate: { fontSize: 12, color: "var(--navy-35)" },
  closeBtn: {
    alignSelf: "flex-end",
    fontSize: 12,
    color: "var(--navy-60)",
    cursor: "pointer",
    marginTop: 4,
  },
};
