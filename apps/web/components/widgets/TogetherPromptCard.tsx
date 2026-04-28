"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { TogetherPrompt } from "@/lib/types";

export function TogetherPromptCard({ onDismiss }: { onDismiss: () => void }) {
  const [prompt, setPrompt] = useState<TogetherPrompt | null>(null);
  const [skipMsg, setSkipMsg] = useState<string | null>(null);
  const [gone, setGone] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // fetch the current prompt once on mount
  useEffect(() => {
    let cancelled = false;
    api
      .get<TogetherPrompt | null>("/api/v1/together/prompts/current")
      .then((p) => {
        if (cancelled) return;
        setPrompt(p);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // fade out skip message
  useEffect(() => {
    if (!skipMsg) return;
    const t = setTimeout(() => {
      setGone(true);
      onDismiss();
    }, 2600);
    return () => clearTimeout(t);
  }, [skipMsg, onDismiss]);

  if (gone || !prompt) return null;

  const handleSkip = async () => {
    if (!prompt) return;
    try {
      const res = await api.post<{ message: string }>(
        `/api/v1/together/prompts/${prompt.id}/skip`
      );
      setSkipMsg(res.message);
    } catch {
      setSkipMsg("the moment will wait for you");
    }
  };

  const handleUpload = () => fileInputRef.current?.click();

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !prompt) return;
    setUploading(true);
    try {
      const f = await api.upload<{ id: string }>("/api/v1/files", file, {
        kind: "image",
      });
      await api.post(`/api/v1/together/prompts/${prompt.id}/accept`, {
        esui_photo_file_id: f.id,
      });
      setSkipMsg("composing — give it a moment");
    } catch {
      setSkipMsg("we couldn't quite get that — try again?");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={tS.promptWrap} className="anim-corner">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={onFile}
      />
      {skipMsg ? (
        <p style={tS.skipMsg}>{skipMsg}</p>
      ) : (
        <>
          <p style={tS.promptText}>
            Badrushk wants to take a photo with you today.
          </p>
          <div
            style={{
              display: "flex",
              gap: 14,
              alignItems: "center",
              marginTop: 10,
            }}
          >
            <button
              style={tS.promptAccept}
              onClick={handleUpload}
              disabled={uploading}
            >
              {uploading ? "uploading…" : "upload one of yours"}
            </button>
            <button style={tS.promptSkip} onClick={handleSkip}>
              not now
            </button>
          </div>
        </>
      )}
    </div>
  );
}

const tS: Record<string, React.CSSProperties> = {
  promptWrap: {
    position: "fixed",
    bottom: 24,
    right: 24,
    background: "var(--white)",
    border: "1px solid var(--vanilla-border)",
    borderRadius: "var(--rs)",
    padding: "16px 18px",
    width: 280,
    zIndex: 50,
    boxShadow: "0 4px 28px rgba(28,31,46,.09)",
  },
  promptText: {
    fontSize: 13,
    fontFamily: "var(--serif)",
    color: "var(--navy)",
    lineHeight: 1.6,
  },
  promptAccept: {
    fontSize: 12.5,
    fontWeight: 500,
    color: "var(--sky)",
    cursor: "pointer",
    background: "none",
    border: "none",
    padding: 0,
    textDecoration: "underline",
    textDecorationColor: "var(--sky-border)",
  },
  promptSkip: {
    fontSize: 12.5,
    color: "var(--navy-35)",
    cursor: "pointer",
    background: "none",
    border: "none",
    padding: 0,
    fontStyle: "italic",
    fontFamily: "var(--serif)",
  },
  skipMsg: {
    fontSize: 13,
    color: "var(--navy-60)",
    fontFamily: "var(--serif)",
    fontStyle: "italic",
    lineHeight: 1.55,
  },
};
