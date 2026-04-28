"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { getSocket } from "@/lib/socket";
import type {
  Conversation,
  ContentBlock,
  Message,
  Mode,
} from "@/lib/types";

type StreamState = {
  messageId: string | null;
  text: string;
  mode: Mode;
  modelId: string | null;
  vaultSuggestion: Extract<ContentBlock, { type: "vault_pin_suggestion" }> | null;
  thinking: string;
} | null;

export function ChatWidget({
  mode,
  setMode,
}: {
  mode: Mode;
  setMode: (m: Mode) => void;
}) {
  const me = useAuthStore((s) => s.user);
  const [convs, setConvs] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Message[]>([]);
  const [stream, setStream] = useState<StreamState>(null);
  const [input, setInput] = useState("");
  const [pinned, setPinned] = useState(false);
  const [savedSuggestion, setSavedSuggestion] = useState<Record<string, boolean>>({});
  const [presenceOnline, setPresenceOnline] = useState(false);
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const endRef = useRef<HTMLDivElement | null>(null);

  const activeConv = useMemo(
    () => convs.find((c) => c.id === activeId) || null,
    [convs, activeId]
  );

  // ── load conversations ──
  useEffect(() => {
    let cancelled = false;
    api
      .get<Conversation[]>("/api/v1/conversations?limit=50")
      .then((rows) => {
        if (cancelled) return;
        setConvs(rows);
        if (rows.length && !activeId) setActiveId(rows[0].id);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(
          err instanceof ApiError
            ? "we couldn't load your conversations"
            : "offline?"
        );
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── load messages when active conv changes ──
  useEffect(() => {
    if (!activeId) {
      setMsgs([]);
      return;
    }
    let cancelled = false;
    setStream(null);
    api
      .get<Message[]>(`/api/v1/conversations/${activeId}/messages?limit=100`)
      .then((rows) => {
        if (cancelled) return;
        setMsgs(rows);
      })
      .catch(() => {
        if (cancelled) return;
        setError("we couldn't quite get that — try again?");
      });
    return () => {
      cancelled = true;
    };
  }, [activeId]);

  // ── socket: room join + AI streaming events ──
  useEffect(() => {
    if (!activeId) return;
    const s = getSocket();
    if (!s) return;

    s.emit("conversation:join", { conversation_id: activeId });

    const onCreated = (m: Message) => {
      if (m.conversation_id !== activeId) return;
      setMsgs((prev) => {
        if (prev.some((x) => x.id === m.id)) return prev;
        return [...prev, m];
      });
    };
    const onPresence = (p: { conversation_id: string; user_id: string; online: boolean }) => {
      if (p.conversation_id !== activeId) return;
      if (p.user_id === me?.id) return;
      setPresenceOnline(p.online);
    };
    const onTyping = (p: { conversation_id: string; user_id: string; typing: boolean }) => {
      if (p.conversation_id !== activeId) return;
      if (p.user_id === me?.id) return;
      setPartnerTyping(p.typing);
    };
    const onAiStart = (p: {
      message_id: string;
      mode: Mode;
      model_id: string;
    }) => {
      setStream({
        messageId: p.message_id,
        text: "",
        mode: p.mode,
        modelId: p.model_id,
        vaultSuggestion: null,
        thinking: "",
      });
    };
    const onAiDelta = (p: { message_id: string; delta_text: string }) => {
      setStream((prev) =>
        prev && prev.messageId === p.message_id
          ? { ...prev, text: prev.text + p.delta_text }
          : prev
      );
    };
    const onAiThinking = (p: { message_id: string; delta_text: string }) => {
      setStream((prev) =>
        prev && prev.messageId === p.message_id
          ? { ...prev, thinking: prev.thinking + p.delta_text }
          : prev
      );
    };
    const onAiToolUse = (p: {
      message_id: string;
      tool: string;
      args: Record<string, unknown>;
    }) => {
      if (p.tool !== "vault_pin_suggestion") return;
      const args = p.args as {
        title?: string;
        content_md?: string;
        tags?: string[];
      };
      setStream((prev) =>
        prev && prev.messageId === p.message_id
          ? {
              ...prev,
              vaultSuggestion: {
                type: "vault_pin_suggestion",
                title: args.title || "Untitled",
                content_md: args.content_md || "",
                tags: args.tags || [],
              },
            }
          : prev
      );
    };
    const onAiComplete = (p: { message_id: string }) => {
      setStream((prev) => {
        if (!prev || prev.messageId !== p.message_id) return prev;
        // Refetch the message list to pick up the persisted message + blocks.
        api
          .get<Message[]>(`/api/v1/conversations/${activeId}/messages?limit=100`)
          .then(setMsgs)
          .catch(() => {});
        return null;
      });
    };
    const onAiError = (p: { message_id: string; error: string }) => {
      setError(p.error || "we couldn't quite get that — try again?");
      setStream(null);
    };

    s.on("message:created", onCreated);
    s.on("presence:update", onPresence);
    s.on("typing:update", onTyping);
    s.on("message:ai:start", onAiStart);
    s.on("message:ai:delta", onAiDelta);
    s.on("message:ai:thinking", onAiThinking);
    s.on("message:ai:tool_use", onAiToolUse);
    s.on("message:ai:complete", onAiComplete);
    s.on("message:ai:error", onAiError);

    return () => {
      s.emit("conversation:leave", { conversation_id: activeId });
      s.off("message:created", onCreated);
      s.off("presence:update", onPresence);
      s.off("typing:update", onTyping);
      s.off("message:ai:start", onAiStart);
      s.off("message:ai:delta", onAiDelta);
      s.off("message:ai:thinking", onAiThinking);
      s.off("message:ai:tool_use", onAiToolUse);
      s.off("message:ai:complete", onAiComplete);
      s.off("message:ai:error", onAiError);
    };
  }, [activeId, me?.id]);

  // ── autoscroll ──
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, stream?.text]);

  const newConversation = async () => {
    try {
      const conv = await api.post<Conversation>("/api/v1/conversations", {});
      setConvs((prev) => [conv, ...prev]);
      setActiveId(conv.id);
    } catch {
      setError("couldn't start a new conversation");
    }
  };

  const send = useCallback(async () => {
    if (!input.trim() || stream || !activeId) return;
    const text = input.trim();
    setInput("");
    setError(null);
    try {
      await api.post(`/api/v1/conversations/${activeId}/messages`, {
        content_blocks: [{ type: "text", text }],
        mode,
      });
    } catch {
      setError("we couldn't quite get that — try again?");
    }
  }, [input, stream, activeId, mode]);

  const stopStream = () => {
    const s = getSocket();
    if (s && stream?.messageId) {
      s.emit("message:cancel", { message_id: stream.messageId });
    }
    setStream(null);
  };

  const saveSuggestionToVault = async (
    suggestion: Extract<ContentBlock, { type: "vault_pin_suggestion" }>,
    keyId: string
  ) => {
    try {
      await api.post("/api/v1/vault/documents", {
        title: suggestion.title,
        content_md: suggestion.content_md,
        content_type: "note",
      });
      setSavedSuggestion((p) => ({ ...p, [keyId]: true }));
    } catch {
      setError("couldn't save to vault");
    }
  };

  const modeColor = mode === "ulzii" ? "var(--sky)" : "var(--forest)";
  const modeBorder = mode === "ulzii" ? "var(--sky-border)" : "var(--forest-border)";

  const renderMessage = (m: Message) => {
    const isUser = m.sender_type === "user";
    if (isUser) return <UserBubble key={m.id} msg={m} isMine={m.sender_user_id === me?.id} />;
    return (
      <AIBubble
        key={m.id}
        msg={m}
        savedSuggestion={savedSuggestion[m.id]}
        onSaveSuggestion={(s) => saveSuggestionToVault(s, m.id)}
      />
    );
  };

  return (
    <div style={cS.container}>
      <div style={cS.sidebar}>
        <div style={cS.sidebarHead}>
          <span style={cS.sidebarLabel}>conversations</span>
          <button
            style={cS.iconBtn}
            title="New conversation"
            onClick={newConversation}
          >
            <PlusIcon />
          </button>
        </div>
        <div style={cS.convList}>
          {convs.length === 0 ? (
            <p style={cS.emptyConv}>start a conversation — Ulzii or Obama</p>
          ) : (
            convs.map((c) => {
              const active = activeId === c.id;
              return (
                <button
                  key={c.id}
                  style={{ ...cS.convRow, ...(active ? cS.convRowActive : {}) }}
                  onClick={() => setActiveId(c.id)}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      marginBottom: 3,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: active ? 500 : 400,
                        color: "var(--navy)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        flex: 1,
                      }}
                    >
                      {c.title || "Untitled"}
                    </span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 8,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 11.5,
                        color: "var(--navy-35)",
                        fontFamily: "var(--serif)",
                        fontStyle: "italic",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        flex: 1,
                      }}
                    >
                      {c.pinned_context || ""}
                    </span>
                    <span
                      style={{ fontSize: 11, color: "var(--navy-35)", flexShrink: 0 }}
                    >
                      {formatRelative(c.updated_at)}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      <div style={cS.main}>
        {activeConv?.pinned_context && (
          <div style={cS.pinnedBar}>
            <button style={cS.pinnedBtn} onClick={() => setPinned(!pinned)}>
              <PinIcon active={pinned} />
              <span style={{ flex: 1, textAlign: "left" }}>
                {pinned ? activeConv.pinned_context : "pinned context"}
              </span>
              <ChevronIcon up={pinned} />
            </button>
          </div>
        )}

        <div style={cS.presenceBar}>
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: presenceOnline ? "#4ade80" : "var(--navy-35)",
              flexShrink: 0,
              boxShadow: presenceOnline
                ? "0 0 0 2px rgba(74,222,128,.2)"
                : "none",
            }}
          />
          <span style={{ fontSize: 11.5, color: "var(--navy-35)" }}>
            {partnerTyping ? "Badrushk is typing…" : presenceOnline ? "Badrushk is here" : "Badrushk is away"}
          </span>
        </div>

        <div style={cS.messages}>
          {msgs.length === 0 && !stream && (
            <p style={cS.emptyState}>
              start a conversation — Ulzii or Obama
            </p>
          )}
          {msgs.map(renderMessage)}

          {stream && (
            <div style={{ ...cS.aiMsg, animation: "fadeUp .15s ease" }}>
              <span style={{ ...cS.aiLabel, color: stream.mode === "ulzii" ? "var(--sky)" : "var(--forest)" }}>
                {stream.mode === "ulzii" ? "Ulzii" : "Obama"}
              </span>
              {stream.thinking && (
                <p style={cS.thinking}>
                  <em>{stream.thinking}</em>
                </p>
              )}
              <p style={cS.aiText}>
                {paragraphs(stream.text)}
                <span
                  style={{
                    display: "inline-block",
                    width: 1.5,
                    height: "1em",
                    background: stream.mode === "ulzii" ? "var(--sky)" : "var(--forest)",
                    verticalAlign: "text-bottom",
                    marginLeft: 1,
                    animation: "blink 1s ease infinite",
                  }}
                />
              </p>
              {stream.vaultSuggestion && (
                <VaultSuggestionCard
                  suggestion={stream.vaultSuggestion}
                  saved={!!savedSuggestion["__streaming__"]}
                  onSave={() =>
                    saveSuggestionToVault(stream.vaultSuggestion!, "__streaming__")
                  }
                />
              )}
            </div>
          )}
          <div ref={endRef} />
        </div>

        {error && (
          <div style={cS.errorBar}>
            <span>{error}</span>
            <button style={cS.errorClose} onClick={() => setError(null)}>
              dismiss
            </button>
          </div>
        )}

        <div style={cS.composer}>
          <div style={cS.composerTop}>
            <div style={{ ...cS.modePill, borderColor: modeBorder }}>
              <button
                style={{
                  ...cS.modeBtn,
                  ...(mode === "ulzii"
                    ? { background: "var(--sky-bg)", color: "var(--sky)" }
                    : {}),
                }}
                onClick={() => setMode("ulzii")}
              >
                Ulzii
              </button>
              <button
                style={{
                  ...cS.modeBtn,
                  ...(mode === "obama"
                    ? { background: "var(--forest-bg)", color: "var(--forest)" }
                    : {}),
                }}
                onClick={() => setMode("obama")}
              >
                Obama
              </button>
            </div>
            <span
              style={{
                fontSize: 11,
                color: "var(--navy-35)",
                fontFamily: "var(--serif)",
                fontStyle: "italic",
              }}
            >
              {mode === "ulzii"
                ? "contemplative · first principles"
                : "decisive · founder's lens"}
            </span>
          </div>
          <div style={cS.inputRow}>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder={
                activeId
                  ? "ask anything — Ulzii or Obama will respond"
                  : "start a conversation first"
              }
              style={{ ...cS.textarea, fontFamily: "var(--serif)" }}
              rows={1}
              disabled={!!stream || !activeId}
              aria-label="message input"
            />
            {stream ? (
              <button
                style={{ ...cS.sendBtn, background: "var(--navy-15)" }}
                onClick={stopStream}
                title="Stop"
              >
                <StopIcon />
              </button>
            ) : (
              <button
                style={{
                  ...cS.sendBtn,
                  background: input.trim() ? modeColor : "var(--vanilla-border)",
                  cursor: input.trim() ? "pointer" : "default",
                }}
                onClick={send}
                disabled={!input.trim()}
                title="Send"
              >
                <SendIcon />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function paragraphs(text: string) {
  return text.split("\n\n").map((p, i, arr) => (
    <span key={i}>
      {p}
      {i < arr.length - 1 && (
        <>
          <br />
          <br />
        </>
      )}
    </span>
  ));
}

function formatRelative(iso: string): string {
  const t = new Date(iso).getTime();
  if (!t) return "";
  const diff = Date.now() - t;
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString();
}

function UserBubble({ msg, isMine }: { msg: Message; isMine: boolean }) {
  const text = msg.content_blocks
    .filter((b) => b.type === "text")
    .map((b) => (b as Extract<ContentBlock, { type: "text" }>).text)
    .join("\n\n");
  return (
    <div style={{ ...cS.userMsg, alignSelf: isMine ? "flex-end" : "flex-start" }}>
      <p style={cS.userText}>{text}</p>
      <span style={cS.ts}>{formatTime(msg.created_at)}</span>
    </div>
  );
}

function AIBubble({
  msg,
  savedSuggestion,
  onSaveSuggestion,
}: {
  msg: Message;
  savedSuggestion: boolean;
  onSaveSuggestion: (s: Extract<ContentBlock, { type: "vault_pin_suggestion" }>) => void;
}) {
  const modeColor =
    msg.mode === "ulzii"
      ? "var(--sky)"
      : msg.mode === "obama"
        ? "var(--forest)"
        : "var(--navy-60)";
  const label = msg.mode === "ulzii" ? "Ulzii" : msg.mode === "obama" ? "Obama" : "AI";

  const text = msg.content_blocks
    .filter((b) => b.type === "text")
    .map((b) => (b as Extract<ContentBlock, { type: "text" }>).text)
    .join("\n\n");

  const suggestion = msg.content_blocks.find(
    (b) => b.type === "vault_pin_suggestion"
  ) as Extract<ContentBlock, { type: "vault_pin_suggestion" }> | undefined;

  const thinking = msg.content_blocks.find((b) => b.type === "thinking") as
    | Extract<ContentBlock, { type: "thinking" }>
    | undefined;

  return (
    <div style={cS.aiMsg} className="anim-fade-up">
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ ...cS.aiLabel, color: modeColor }}>{label}</span>
        <span style={cS.ts}>{formatTime(msg.created_at)}</span>
      </div>
      {thinking && (
        <p style={cS.thinking}>
          <em>{thinking.text}</em>
        </p>
      )}
      <p style={cS.aiText}>{paragraphs(text)}</p>
      {suggestion && (
        <VaultSuggestionCard
          suggestion={suggestion}
          saved={savedSuggestion}
          onSave={() => onSaveSuggestion(suggestion)}
        />
      )}
    </div>
  );
}

function VaultSuggestionCard({
  suggestion,
  saved,
  onSave,
}: {
  suggestion: Extract<ContentBlock, { type: "vault_pin_suggestion" }>;
  saved: boolean;
  onSave: () => void;
}) {
  return (
    <div style={cS.vaultCard} className="anim-fade-up">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 6,
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: ".06em",
            textTransform: "uppercase",
            color: "var(--sky)",
          }}
        >
          vault suggestion
        </span>
        {saved && <span style={{ fontSize: 11, color: "var(--forest)" }}>✓ saved</span>}
      </div>
      <p
        style={{
          fontSize: 13,
          fontWeight: 500,
          fontFamily: "var(--serif)",
          color: "var(--navy)",
          marginBottom: 4,
        }}
      >
        {suggestion.title}
      </p>
      <p
        style={{
          fontSize: 12.5,
          fontFamily: "var(--serif)",
          color: "var(--navy-60)",
          lineHeight: 1.6,
          marginBottom: 8,
        }}
      >
        {suggestion.content_md}
      </p>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
        {suggestion.tags.map((t) => (
          <span key={t} style={cS.tag}>
            {t}
          </span>
        ))}
      </div>
      {!saved && (
        <div style={{ display: "flex", gap: 10 }}>
          <button style={cS.vaultSave} onClick={onSave}>
            save to vault
          </button>
        </div>
      )}
    </div>
  );
}

function formatTime(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

const PlusIcon = () => (
  <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
    <path
      d="M6.5 1.5v10M1.5 6.5h10"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);
const PinIcon = ({ active }: { active: boolean }) => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
    <path
      d="M6 1.5L7.5 4.5H10.5L8.25 6.75L9 9.75L6 8.25L3 9.75L3.75 6.75L1.5 4.5H4.5L6 1.5Z"
      stroke="currentColor"
      strokeWidth="1"
      strokeLinejoin="round"
      fill={active ? "currentColor" : "none"}
    />
  </svg>
);
const ChevronIcon = ({ up }: { up: boolean }) => (
  <svg
    width="10"
    height="10"
    viewBox="0 0 10 10"
    fill="none"
    style={{ transform: up ? "rotate(180deg)" : "none", transition: "transform .15s" }}
  >
    <path
      d="M2 4l3 3 3-3"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
const StopIcon = () => (
  <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
    <rect x="1.5" y="1.5" width="8" height="8" rx="1.5" fill="currentColor" />
  </svg>
);
const SendIcon = () => (
  <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
    <path d="M11 6.5L2 2l2.5 4.5L2 11z" fill="white" />
  </svg>
);

const cS: Record<string, React.CSSProperties> = {
  container: { display: "flex", height: "100%", overflow: "hidden" },
  sidebar: {
    width: 260,
    flexShrink: 0,
    borderRight: "1px solid var(--vanilla-border)",
    display: "flex",
    flexDirection: "column",
    background: "var(--vanilla)",
  },
  sidebarHead: {
    padding: "18px 14px 12px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottom: "1px solid var(--vanilla-border)",
  },
  sidebarLabel: {
    fontSize: 10.5,
    fontWeight: 600,
    letterSpacing: ".08em",
    textTransform: "uppercase",
    color: "var(--navy-35)",
  },
  iconBtn: {
    width: 24,
    height: 24,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "var(--navy-60)",
    borderRadius: "var(--rs)",
  },
  convList: { flex: 1, overflowY: "auto", padding: "6px 6px" },
  convRow: {
    width: "100%",
    textAlign: "left",
    padding: "9px 8px",
    borderRadius: "var(--rs)",
    cursor: "pointer",
    display: "block",
    marginBottom: 1,
  },
  convRowActive: { background: "var(--vanilla-2)" },
  emptyConv: {
    padding: "24px 14px",
    fontSize: 12,
    color: "var(--navy-35)",
    fontFamily: "var(--serif)",
    fontStyle: "italic",
    lineHeight: 1.5,
  },
  main: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    background: "var(--white)",
  },
  pinnedBar: { borderBottom: "1px solid var(--vanilla-border)" },
  pinnedBtn: {
    width: "100%",
    textAlign: "left",
    display: "flex",
    alignItems: "center",
    gap: 7,
    padding: "9px 18px",
    color: "var(--navy-60)",
    fontSize: 12,
    cursor: "pointer",
  },
  presenceBar: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 18px",
    borderBottom: "1px solid var(--vanilla-border)",
  },
  messages: {
    flex: 1,
    overflowY: "auto",
    padding: "28px 44px",
    display: "flex",
    flexDirection: "column",
    gap: 26,
  },
  emptyState: {
    margin: "auto",
    color: "var(--navy-35)",
    fontFamily: "var(--serif)",
    fontStyle: "italic",
    fontSize: 14,
  },
  userMsg: {
    alignSelf: "flex-end",
    maxWidth: 540,
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: 4,
  },
  userText: {
    background: "var(--vanilla)",
    border: "1px solid var(--vanilla-border)",
    borderRadius: "var(--rs)",
    padding: "10px 14px",
    fontSize: 14,
    lineHeight: 1.65,
    fontFamily: "var(--serif)",
    color: "var(--navy)",
    whiteSpace: "pre-wrap",
  },
  aiMsg: {
    alignSelf: "flex-start",
    maxWidth: 660,
    display: "flex",
    flexDirection: "column",
    gap: 7,
  },
  aiLabel: {
    fontSize: 12,
    fontWeight: 500,
    fontStyle: "italic",
    fontFamily: "var(--serif)",
  },
  aiText: {
    fontSize: 14.5,
    lineHeight: 1.78,
    fontFamily: "var(--serif)",
    fontWeight: 300,
    color: "var(--navy)",
  },
  thinking: {
    fontSize: 12.5,
    color: "var(--navy-35)",
    fontFamily: "var(--serif)",
    lineHeight: 1.55,
    paddingLeft: 10,
    borderLeft: "1.5px solid var(--vanilla-border)",
  },
  ts: { fontSize: 11, color: "var(--navy-35)" },
  vaultCard: {
    background: "var(--vanilla)",
    border: "1px solid var(--sky-border)",
    borderRadius: "var(--rs)",
    padding: "12px 14px",
    marginTop: 4,
  },
  tag: {
    fontSize: 11,
    color: "var(--navy-35)",
    padding: "2px 7px",
    border: "1px solid var(--vanilla-border)",
    borderRadius: 10,
  },
  vaultSave: {
    fontSize: 12.5,
    color: "var(--sky)",
    cursor: "pointer",
    fontWeight: 500,
    padding: 0,
  },
  errorBar: {
    padding: "8px 18px",
    background: "var(--rose-light)",
    color: "var(--rose)",
    fontSize: 12.5,
    fontFamily: "var(--serif)",
    fontStyle: "italic",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  errorClose: {
    fontSize: 11,
    color: "var(--rose)",
    background: "none",
    border: "none",
    textDecoration: "underline",
  },
  composer: {
    borderTop: "1px solid var(--vanilla-border)",
    padding: "12px 18px 16px",
    background: "var(--white)",
    flexShrink: 0,
  },
  composerTop: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  modePill: {
    display: "flex",
    padding: 2,
    gap: 2,
    borderRadius: 20,
    border: "1px solid",
    background: "var(--vanilla)",
  },
  modeBtn: {
    padding: "3px 11px",
    borderRadius: 16,
    fontSize: 12,
    fontWeight: 500,
    color: "var(--navy-60)",
    cursor: "pointer",
    transition: "all .12s",
  },
  inputRow: {
    display: "flex",
    alignItems: "flex-end",
    gap: 8,
    border: "1px solid var(--vanilla-border)",
    borderRadius: "var(--rs)",
    padding: "7px 8px 7px 10px",
    background: "var(--vanilla)",
  },
  textarea: {
    flex: 1,
    fontSize: 14,
    lineHeight: 1.6,
    resize: "none",
    background: "transparent",
    maxHeight: 120,
    overflow: "auto",
    color: "var(--navy)",
  },
  sendBtn: {
    width: 30,
    height: 30,
    borderRadius: "var(--rs)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    transition: "background .12s",
  },
};
