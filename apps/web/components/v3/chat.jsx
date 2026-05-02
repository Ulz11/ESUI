"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Cursor, ModePill, ProviderChip, Surface, Tag } from "./atoms";
import { I } from "./icons";
import { api } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import {
  useConversations,
  useMessages,
  archiveToVault,
  createConversation,
  saveArtifact,
  createVaultDoc,
} from "@/lib/v3-hooks";

// — Chat surface — Eden-calm conversation w/ mode toggle, tool cards, citations
//   wired to live backend (Socket.io streaming + REST history + tool-use cards)

function ChatView({ mode, setMode }) {
  const isU = mode === "ulzii";
  const accent = isU ? "var(--sky)" : "var(--forest)";

  const [draft, setDraft] = useState("");
  const [activeConvId, setActiveConvId] = useState(null);
  const [streaming, setStreaming] = useState(null); // { messageId, mode, model_id, intent, provider, text, blocks }

  const { convs, loading: convsLoading, reload: reloadConvs } = useConversations(50);
  const { msgs, setMsgs, loading: msgsLoading } = useMessages(activeConvId);
  const composerRef = useRef(null);
  const timelineRef = useRef(null);

  // Auto-pick the most recent conversation when convs load
  useEffect(() => {
    if (!activeConvId && convs.length > 0) setActiveConvId(convs[0].id);
  }, [activeConvId, convs]);

  // Subscribe to socket events for the active conversation
  useEffect(() => {
    if (!activeConvId) return;
    const s = getSocket();
    if (!s) return;
    s.emit("conversation:join", { conversation_id: activeConvId });

    const onCreated = (msg) => {
      // Avoid duplicate (we may have appended optimistically)
      setMsgs((prev) =>
        prev.some((m) => m.id === msg.id) ? prev : [...prev, msg],
      );
    };
    const onAiStart = (evt) => {
      setStreaming({
        messageId: evt.message_id,
        mode: evt.mode,
        model_id: evt.model_id,
        intent: evt.intent,
        provider: evt.provider,
        text: "",
        blocks: [],
      });
    };
    const onAiDelta = (evt) => {
      setStreaming((prev) =>
        prev && prev.messageId === evt.message_id
          ? { ...prev, text: prev.text + evt.delta_text }
          : prev,
      );
    };
    const onToolUse = (evt) => {
      setStreaming((prev) =>
        prev && prev.messageId === evt.message_id
          ? { ...prev, blocks: [...prev.blocks, { tool: evt.tool, args: evt.args }] }
          : prev,
      );
    };
    const onAiComplete = () => {
      setStreaming(null);
      // Refresh messages so the persisted record (with tool blocks) replaces the live stream
      api
        .get(`/api/v1/conversations/${activeConvId}/messages?limit=200`)
        .then(setMsgs)
        .catch(() => {});
    };
    const onAiError = () => setStreaming(null);

    s.on("message:created", onCreated);
    s.on("message:ai:start", onAiStart);
    s.on("message:ai:delta", onAiDelta);
    s.on("message:ai:tool_use", onToolUse);
    s.on("message:ai:complete", onAiComplete);
    s.on("message:ai:error", onAiError);

    return () => {
      s.emit("conversation:leave", { conversation_id: activeConvId });
      s.off("message:created", onCreated);
      s.off("message:ai:start", onAiStart);
      s.off("message:ai:delta", onAiDelta);
      s.off("message:ai:tool_use", onToolUse);
      s.off("message:ai:complete", onAiComplete);
      s.off("message:ai:error", onAiError);
    };
  }, [activeConvId, setMsgs]);

  // Auto-scroll on new content
  useEffect(() => {
    const el = timelineRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs.length, streaming?.text]);

  // ⌘/ to swap mode, ⌘⏎ to send
  useEffect(() => {
    const onKey = (e) => {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key === "/") {
        e.preventDefault();
        setMode(isU ? "obama" : "ulzii");
      }
      if (meta && e.key === "Enter") {
        e.preventDefault();
        send();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isU, draft, activeConvId, mode]);

  const send = useCallback(async () => {
    const text = draft.trim();
    if (!text || streaming) return;
    let convId = activeConvId;
    if (!convId) {
      const created = await createConversation(undefined);
      convId = created.id;
      setActiveConvId(convId);
      reloadConvs();
    }
    const s = getSocket();
    if (!s) return;
    s.emit("message:send", {
      conversation_id: convId,
      content_blocks: [{ type: "text", text }],
      mode,
    });
    setDraft("");
  }, [draft, mode, activeConvId, streaming, reloadConvs]);

  const onArchive = async () => {
    if (!activeConvId) return;
    try {
      await archiveToVault(activeConvId);
    } catch {}
  };

  const composerHint = isU
    ? "what would you like to understand?"
    : "what are we shipping or deciding?";
  const affordances = isU
    ? ["sketch the territory", "open a knowledge question", "bridge to another field"]
    : ["run 3-scenario sim", "propose tech stack", "market research"];

  // Pull header from active conversation
  const activeConv = useMemo(
    () => convs.find((c) => c.id === activeConvId),
    [convs, activeConvId],
  );

  return (
    <div style={{ height: "100%", display: "grid", gridTemplateColumns: "260px 1fr", overflow: "hidden" }}>
      {/* Conversation rail */}
      <div style={{ borderRight: "1px solid var(--rule)", overflow: "auto", padding: "22px 14px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 8px 14px" }}>
          <div style={{ fontSize: 11, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--ink-50)" }}>
            conversations
          </div>
          <button
            className="qbtn"
            title="new"
            onClick={async () => {
              const c = await createConversation();
              setActiveConvId(c.id);
              reloadConvs();
              composerRef.current?.focus();
            }}
          >
            <I.plus size={14} />
          </button>
        </div>
        {convsLoading ? (
          <div style={{ padding: "0 10px", color: "var(--ink-35)", fontSize: 12 }}>—</div>
        ) : convs.length === 0 ? (
          <div style={{ padding: "0 10px", color: "var(--ink-35)", fontSize: 12, fontStyle: "italic", fontFamily: "var(--serif)" }}>
            no conversations yet — say something to ulzii or obama.
          </div>
        ) : (
          convs.map((c) => {
            const active = c.id === activeConvId;
            return (
              <div
                key={c.id}
                onClick={() => setActiveConvId(c.id)}
                style={{
                  padding: "10px 10px",
                  borderRadius: 8,
                  marginBottom: 2,
                  cursor: "pointer",
                  background: active ? "var(--ink-06)" : "transparent",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span className="mono" style={{ fontSize: 10.5, color: "var(--ink-35)", marginLeft: "auto" }}>
                    {timeAgo(c.updated_at)}
                  </span>
                </div>
                <div style={{ fontSize: 13, color: active ? "var(--ink)" : "var(--ink-70)", lineHeight: 1.35 }}>
                  {c.title || "untitled"}
                </div>
                <div
                  style={{
                    fontSize: 11.5,
                    color: "var(--ink-35)",
                    marginTop: 3,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {c.pinned_context || ""}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Conversation */}
      <div
        style={{
          display: "grid",
          gridTemplateRows: "auto 1fr auto",
          overflow: "hidden",
          background: "var(--surface)",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "18px 32px",
            borderBottom: "1px solid var(--rule-soft)",
          }}
        >
          <div>
            <div style={{ fontFamily: "var(--serif)", fontSize: 19, color: "var(--ink)" }}>
              <em>{activeConv?.title || "untitled"}</em>
            </div>
            <div
              style={{
                fontSize: 11.5,
                color: "var(--ink-35)",
                marginTop: 2,
                fontFamily: "var(--mono)",
                letterSpacing: ".04em",
              }}
            >
              {activeConv ? `${msgs.length} messages` : "no conversation"}
            </div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button className="qbtn" onClick={onArchive} disabled={!activeConvId}>
              <I.archive size={13} /> archive thread
            </button>
            <button className="qbtn">
              <I.dots size={14} />
            </button>
          </div>
        </div>

        {/* Timeline */}
        <div ref={timelineRef} style={{ overflow: "auto", padding: "32px 0" }}>
          <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 32px", display: "flex", flexDirection: "column", gap: 36 }}>
            {msgsLoading && msgs.length === 0 ? (
              <div style={{ color: "var(--ink-35)", textAlign: "center", fontFamily: "var(--serif)", fontStyle: "italic" }}>—</div>
            ) : msgs.length === 0 && !streaming ? (
              <div
                style={{
                  color: "var(--ink-50)",
                  textAlign: "center",
                  fontFamily: "var(--serif)",
                  fontStyle: "italic",
                  fontSize: 16,
                  padding: "40px 0",
                }}
              >
                start a thread — {isU ? "what would you like to understand?" : "what are we shipping or deciding?"}
              </div>
            ) : (
              msgs.map((m) => <MessageRow key={m.id} msg={m} accent={accent} />)
            )}

            {streaming && (
              <div className="fu">
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <ModePill mode={streaming.mode || mode} />
                  <ProviderChip
                    provider={streaming.provider || "anthropic"}
                    intent={streaming.intent}
                    model={streaming.model_id}
                  />
                </div>
                <div
                  className="serif"
                  style={{ fontSize: 17, lineHeight: 1.62, color: "var(--ink)", letterSpacing: "-.005em", whiteSpace: "pre-wrap" }}
                >
                  {streaming.text}
                  <Cursor />
                </div>
                {streaming.blocks.map((b, i) =>
                  b.tool === "pin_to_vault" ? (
                    <PinSuggestionCard key={i} args={b.args} />
                  ) : b.tool === "save_artifact" ? (
                    <ArtifactSuggestionCard key={i} args={b.args} />
                  ) : null,
                )}
                <button
                  onClick={() => {
                    const s = getSocket();
                    s?.emit("message:cancel", { message_id: streaming.messageId });
                  }}
                  style={{
                    alignSelf: "center",
                    padding: "6px 14px",
                    fontSize: 12,
                    color: "var(--ink-50)",
                    border: "1px solid var(--rule)",
                    borderRadius: 100,
                    marginTop: 14,
                  }}
                >
                  stop
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Composer */}
        <div
          style={{
            padding: "16px 32px 24px",
            borderTop: "1px solid var(--rule-soft)",
            background: "var(--paper)",
          }}
        >
          <div style={{ maxWidth: 720, margin: "0 auto" }}>
            {!draft && !streaming && (
              <div className="fu" style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                {affordances.map((a) => (
                  <button
                    key={a}
                    className="qbtn"
                    style={{
                      border: "1px solid var(--rule)",
                      color: "var(--ink-50)",
                      fontStyle: "italic",
                      fontFamily: "var(--serif)",
                      fontSize: 13,
                    }}
                    onClick={() => {
                      setDraft(a + " — ");
                      composerRef.current?.focus();
                    }}
                  >
                    {a}
                  </button>
                ))}
              </div>
            )}
            <Surface style={{ padding: "14px 16px", borderColor: draft ? accent : "var(--rule)" }}>
              <textarea
                ref={composerRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={2}
                placeholder={composerHint}
                style={{
                  width: "100%",
                  resize: "none",
                  fontFamily: "var(--serif)",
                  fontSize: 16,
                  lineHeight: 1.5,
                  color: "var(--ink)",
                  fontStyle: draft ? "normal" : "italic",
                }}
              />
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
                <button
                  onClick={() => setMode(isU ? "obama" : "ulzii")}
                  title="cmd / to swap"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "5px 11px 5px 8px",
                    borderRadius: 100,
                    border: `1px solid ${isU ? "var(--sky)" : "var(--forest)"}`,
                    background: isU ? "var(--sky-soft)" : "var(--forest-soft)",
                    fontSize: 13,
                    color: isU ? "var(--sky-deep)" : "var(--forest-deep)",
                  }}
                >
                  <span style={{ width: 7, height: 7, borderRadius: 4, background: accent }} />
                  {isU ? "Ulzii" : "Obama"}
                  <span className="mono" style={{ fontSize: 10, opacity: 0.6 }}>⌘/</span>
                </button>
                <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-35)", marginLeft: 8 }}>
                  {isU ? "TOK · teacher · growth" : "tech · business · founder"}
                </span>
                <div style={{ flex: 1 }} />
                <span className="mono" style={{ fontSize: 11, color: "var(--ink-35)" }}>⌘⏎</span>
                <button
                  onClick={send}
                  disabled={!draft.trim() || streaming}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    background: accent,
                    color: "white",
                    display: "grid",
                    placeItems: "center",
                    opacity: !draft.trim() || streaming ? 0.4 : 1,
                  }}
                >
                  <I.send size={14} sw={2} />
                </button>
              </div>
            </Surface>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Renderers ───────────────────────────────────────────────────────────────

function MessageRow({ msg, accent }) {
  if (msg.sender_type === "user") {
    const text = (msg.content_blocks || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n");
    return (
      <div className="fu" style={{ alignSelf: "flex-end", maxWidth: 540 }}>
        <div
          style={{
            fontSize: 14.5,
            color: "var(--ink-70)",
            lineHeight: 1.55,
            padding: "10px 14px",
            background: "var(--ink-06)",
            borderRadius: "14px 14px 4px 14px",
            whiteSpace: "pre-wrap",
          }}
        >
          {text}
        </div>
        <div
          style={{
            fontSize: 11,
            color: "var(--ink-35)",
            textAlign: "right",
            marginTop: 4,
            fontFamily: "var(--mono)",
          }}
        >
          {fmtTime(msg.created_at)}
        </div>
      </div>
    );
  }

  // AI message
  const text = (msg.content_blocks || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");
  const pinBlocks = (msg.content_blocks || []).filter((b) => b.type === "vault_pin_suggestion");
  const artBlocks = (msg.content_blocks || []).filter((b) => b.type === "vault_artifact_suggestion");
  const citations = (msg.content_blocks || []).filter((b) => b.type === "citation");

  return (
    <div className="fu">
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <ModePill mode={msg.mode || "ulzii"} />
        <ProviderChip provider="anthropic" intent="" model={msg.model_id || ""} />
      </div>
      <div
        className="serif"
        style={{
          fontSize: 17,
          lineHeight: 1.62,
          color: "var(--ink)",
          letterSpacing: "-.005em",
          whiteSpace: "pre-wrap",
        }}
      >
        {text}
      </div>
      {pinBlocks.map((b, i) => (
        <PinSuggestionCard key={`p${i}`} args={b} />
      ))}
      {artBlocks.map((b, i) => (
        <ArtifactSuggestionCard key={`a${i}`} args={b} />
      ))}
      {citations.length > 0 && (
        <div
          style={{
            marginTop: 18,
            display: "flex",
            flexWrap: "wrap",
            gap: 14,
            fontSize: 12,
            color: "var(--ink-50)",
            fontFamily: "var(--mono)",
          }}
        >
          {citations.map((c, i) => (
            <a key={i} href={c.source_id} target="_blank" rel="noopener noreferrer">
              <sup style={{ color: accent, marginRight: 3 }}>[{i + 1}]</sup>
              {prettyHost(c.source_id)}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function PinSuggestionCard({ args }) {
  const [saved, setSaved] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  const onSave = async () => {
    try {
      await createVaultDoc({
        title: args.title,
        content_md: args.content_md,
        content_type: "note",
      });
      setSaved(true);
    } catch {}
  };
  return (
    <div
      className="fu"
      style={{
        marginTop: 18,
        padding: "14px 16px",
        borderRadius: "var(--r-md)",
        borderLeft: "2px solid var(--sky)",
        background: "var(--sky-soft)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <I.pin size={12} style={{ color: "var(--sky-deep)" }} />
        <span
          className="mono"
          style={{
            fontSize: 10,
            letterSpacing: ".14em",
            textTransform: "uppercase",
            color: "var(--sky-deep)",
          }}
        >
          vault · suggested
        </span>
      </div>
      <div style={{ fontFamily: "var(--serif)", fontSize: 16, marginTop: 6, color: "var(--ink)" }}>
        {args.title}
      </div>
      <div
        style={{
          fontFamily: "var(--serif)",
          fontSize: 14,
          lineHeight: 1.5,
          color: "var(--ink-70)",
          marginTop: 6,
          fontStyle: "italic",
          whiteSpace: "pre-wrap",
        }}
      >
        {args.content_md}
      </div>
      <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 6 }}>
        {(args.tags || []).map((t) => (
          <Tag key={t}>{t}</Tag>
        ))}
        <div style={{ flex: 1 }} />
        <button
          className="qbtn"
          style={{ color: "var(--sky-deep)", fontWeight: 500 }}
          onClick={onSave}
          disabled={saved}
        >
          {saved ? "✓ saved" : "save to vault"}
        </button>
        <button className="qbtn" onClick={() => setDismissed(true)}>
          dismiss
        </button>
      </div>
    </div>
  );
}

function ArtifactSuggestionCard({ args }) {
  const [saved, setSaved] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  const onSave = async () => {
    try {
      await saveArtifact({
        title: args.title,
        content_md: args.content_md,
        kind: args.kind,
        tags: args.tags,
      });
      setSaved(true);
    } catch {}
  };
  return (
    <div
      className="fu"
      style={{
        marginTop: 18,
        padding: "16px 18px",
        borderRadius: "var(--r-md)",
        borderLeft: "2px solid var(--forest)",
        background: "var(--forest-soft)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <I.sparkle size={12} style={{ color: "var(--forest-deep)" }} />
        <span
          className="mono"
          style={{
            fontSize: 10,
            letterSpacing: ".14em",
            textTransform: "uppercase",
            color: "var(--forest-deep)",
          }}
        >
          artifact · {String(args.kind).replace(/_/g, " ")}
        </span>
      </div>
      <div style={{ fontFamily: "var(--serif)", fontSize: 17, marginTop: 6, color: "var(--ink)" }}>
        {args.title}
      </div>
      <div
        style={{
          fontFamily: "var(--serif)",
          fontSize: 14,
          lineHeight: 1.55,
          color: "var(--ink-70)",
          marginTop: 8,
          fontStyle: "italic",
          whiteSpace: "pre-wrap",
        }}
      >
        {args.content_md?.slice(0, 280)}
        {args.content_md?.length > 280 ? "…" : ""}
      </div>
      <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 6 }}>
        {(args.tags || []).map((t) => (
          <Tag key={t}>{t}</Tag>
        ))}
        <div style={{ flex: 1 }} />
        <button
          className="qbtn"
          style={{ color: "var(--forest-deep)", fontWeight: 500 }}
          onClick={onSave}
          disabled={saved}
        >
          {saved ? "✓ saved" : "save to vault"}
        </button>
        <button className="qbtn" onClick={() => setDismissed(true)}>
          dismiss
        </button>
      </div>
    </div>
  );
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function fmtTime(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

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

function prettyHost(url) {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export { ChatView };
