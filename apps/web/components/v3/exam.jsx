"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Empty, Skel } from "./atoms";
import { I } from "./icons";
import { api } from "@/lib/api";
import { examApi } from "@/lib/exam-api";
import { getSocket } from "@/lib/socket";

// Exam — drop-to-files / auto-summary / flip-card flashcards.
//
// Flow:
//   1. Drop a file or paste text into the drop zone.
//   2. The server runs Sonnet twice in parallel (summary + flashcards).
//   3. Both artifacts appear inline as soon as they're ready.
//   4. Flashcards use the same RNN-inspired scheduler as TOK card.html
//      (server-side, so progress survives reload).
//   5. Cheatsheet / practice / concept map are still available as
//      secondary actions for when she wants more depth.

function ExamView({ mode }) {
  const [workspaces, setWorkspaces] = useState(null);
  const [activeId, setActiveId] = useState(null);
  const [artifacts, setArtifacts] = useState([]);
  const [loadingArt, setLoadingArt] = useState(false);

  const reloadWorkspaces = useCallback(() => {
    examApi.workspaces()
      .then((ws) => {
        setWorkspaces(ws);
        if (ws.length > 0 && !activeId) setActiveId(ws[0].id);
      })
      .catch(() => setWorkspaces([]));
  }, [activeId]);

  useEffect(() => { reloadWorkspaces(); }, []); // initial only

  const reloadArtifacts = useCallback(() => {
    if (!activeId) {
      setArtifacts([]);
      return;
    }
    setLoadingArt(true);
    examApi.artifacts(activeId)
      .then(setArtifacts)
      .catch(() => setArtifacts([]))
      .finally(() => setLoadingArt(false));
  }, [activeId]);

  useEffect(reloadArtifacts, [reloadArtifacts]);

  // Refresh on Socket.io artifact:complete / artifact:error. The polling
  // fallback only kicks in if the socket isn't connected (e.g. dev session
  // before login flushes through).
  useEffect(() => {
    const sock = getSocket();
    if (sock) {
      const onComplete = () => reloadArtifacts();
      const onError = () => reloadArtifacts();
      sock.on("artifact:complete", onComplete);
      sock.on("artifact:error", onError);
      return () => {
        sock.off("artifact:complete", onComplete);
        sock.off("artifact:error", onError);
      };
    }
    // No socket → fall back to polling while anything is generating.
    const inflight = artifacts.some((a) => a.status === "generating");
    if (!inflight) return;
    const id = setInterval(reloadArtifacts, 2500);
    return () => clearInterval(id);
  }, [artifacts, reloadArtifacts]);

  const onCreateWorkspace = async () => {
    const title = window.prompt("Workspace title?");
    if (!title) return;
    try {
      const ws = await examApi.createWorkspace({ title });
      setWorkspaces([ws, ...(workspaces || [])]);
      setActiveId(ws.id);
    } catch {}
  };

  const activeWS = (workspaces || []).find((w) => w.id === activeId);

  const summary = artifacts.find((a) => a.kind === "summary");
  const deck = artifacts.find((a) => a.kind === "flashcard_deck");
  const cheatsheet = artifacts.find((a) => a.kind === "cheatsheet");
  const practice = artifacts.find((a) => a.kind === "practice_set");
  const graph = artifacts.find((a) => a.kind === "knowledge_graph");

  return (
    <div style={{ height: "100%", display: "grid", gridTemplateColumns: "260px 1fr", overflow: "hidden" }}>
      {/* Sidebar */}
      <div style={{ borderRight: "1px solid var(--rule)", padding: "22px 18px", overflow: "auto" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <div className="mono" style={{ fontSize: 11, letterSpacing: ".18em", textTransform: "uppercase", color: "var(--ink-35)" }}>
            workspaces
          </div>
          <button onClick={onCreateWorkspace} className="qbtn" title="new workspace">
            <I.plus size={14} />
          </button>
        </div>
        <div style={{ marginTop: 14 }}>
          {workspaces === null ? (
            <Skel w="80%" />
          ) : workspaces.length === 0 ? (
            <div style={{ color: "var(--ink-35)", fontSize: 12, fontStyle: "italic", fontFamily: "var(--serif)", padding: "12px" }}>
              create a workspace, drop in your notes.
            </div>
          ) : (
            workspaces.map((w) => (
              <div
                key={w.id}
                onClick={() => setActiveId(w.id)}
                style={{
                  padding: "12px 12px",
                  borderRadius: 8,
                  background: w.id === activeId ? "var(--ink-06)" : "transparent",
                  marginBottom: 4,
                  cursor: "pointer",
                }}
              >
                <div
                  style={{
                    fontFamily: "var(--serif)",
                    fontSize: 15,
                    color: w.id === activeId ? "var(--ink)" : "var(--ink-70)",
                  }}
                >
                  {w.title}
                </div>
                <div className="mono" style={{ fontSize: 10.5, color: "var(--ink-35)", marginTop: 4 }}>
                  {w.subject || "—"}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main */}
      <div style={{ overflow: "auto" }}>
        {!activeWS ? (
          <Empty>create a workspace on the left to begin.</Empty>
        ) : (
          <>
            {/* Header */}
            <div style={{ padding: "22px 32px 14px", borderBottom: "1px solid var(--rule-soft)" }}>
              <div className="mono" style={{ fontSize: 11, letterSpacing: ".18em", textTransform: "uppercase", color: "var(--ink-35)" }}>
                {activeWS.subject || "exam workspace"}
              </div>
              <div style={{ fontFamily: "var(--serif)", fontSize: 28, marginTop: 4 }}>
                <em>{activeWS.title}</em>
              </div>
            </div>

            {/* Drop zone — always visible at top */}
            <div style={{ padding: "24px 32px 0" }}>
              <DropZone
                workspaceId={activeWS.id}
                mode={mode}
                onIngested={reloadArtifacts}
              />
            </div>

            {/* Summary */}
            <div style={{ padding: "32px 32px 0" }}>
              <SectionHeader>Summary</SectionHeader>
              {loadingArt && !summary ? (
                <Skel w="60%" />
              ) : !summary ? (
                <EmptyMicro line="drop something above — a summary appears here." />
              ) : summary.status === "generating" ? (
                <Generating mode={mode} label="reading the material…" />
              ) : summary.status === "error" ? (
                <ErrorLine error={summary.error} />
              ) : (
                <SummaryRender artifact={summary} mode={mode} />
              )}
            </div>

            {/* Flashcards */}
            <div style={{ padding: "32px 32px 0" }}>
              <SectionHeader
                right={deck && deck.status === "ready" ? `${(deck.payload?.cards || []).length} cards` : ""}
              >
                Flashcards
              </SectionHeader>
              {loadingArt && !deck ? (
                <Skel w="60%" />
              ) : !deck ? (
                <EmptyMicro line="flip-card deck appears here once the material is processed." />
              ) : deck.status === "generating" ? (
                <Generating mode={mode} label="building flashcards…" />
              ) : deck.status === "error" ? (
                <ErrorLine error={deck.error} />
              ) : (
                <FlashcardSession deck={deck} onUpdate={reloadArtifacts} />
              )}
            </div>

            {/* Secondary actions */}
            <div style={{ padding: "32px 32px 64px" }}>
              <SectionHeader>More options</SectionHeader>
              <SecondaryActions
                workspace={activeWS}
                mode={mode}
                cheatsheet={cheatsheet}
                practice={practice}
                graph={graph}
                onGenerate={reloadArtifacts}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Drop zone ──────────────────────────────────────────────────────────────

function DropZone({ workspaceId, mode, onIngested }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [hover, setHover] = useState(false);
  const depth = useRef(0);
  const inputRef = useRef(null);

  const startIngest = useCallback(async (payload) => {
    setBusy(true);
    setError(null);
    try {
      await examApi.ingest(workspaceId, { ...payload, mode });
      setText("");
      onIngested();
    } catch (e) {
      setError(e?.message || "ingest failed");
    } finally {
      setBusy(false);
    }
  }, [workspaceId, mode, onIngested]);

  const handleFiles = useCallback(async (files) => {
    if (!files || files.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      // Split: text-like → read client-side; binary → upload via /files.
      const textPieces = [];
      const fileIds = [];
      for (const f of files) {
        const isTextLike = /^text\//.test(f.type) || /\.(md|txt|markdown)$/i.test(f.name);
        if (isTextLike) {
          textPieces.push(`# ${f.name}\n\n${await f.text()}`);
        } else {
          // binary upload
          const uploaded = await api.upload("/api/v1/files", f, { kind: "exam_source" });
          fileIds.push(uploaded.id);
        }
      }
      const combinedText = [text.trim(), ...textPieces].filter(Boolean).join("\n\n---\n\n");
      await examApi.ingest(workspaceId, {
        text: combinedText || undefined,
        file_ids: fileIds.length ? fileIds : undefined,
        mode,
      });
      setText("");
      onIngested();
    } catch (e) {
      setError(e?.message || "upload failed");
    } finally {
      setBusy(false);
    }
  }, [workspaceId, text, mode, onIngested]);

  const onDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    depth.current = 0;
    setHover(false);
    handleFiles([...(e.dataTransfer?.files || [])]);
  };
  const onDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    depth.current += 1;
    setHover(true);
  };
  const onDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    depth.current = Math.max(0, depth.current - 1);
    if (depth.current === 0) setHover(false);
  };
  const onDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <div
      onDrop={onDrop}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      style={{
        border: hover ? "2px dashed var(--ink)" : "2px dashed var(--rule)",
        background: hover ? "var(--ink-06)" : "var(--surface)",
        borderRadius: "var(--r-lg)",
        padding: "28px 28px 22px",
        transition: "background .15s, border-color .15s",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
        <I.upload size={18} />
        <div>
          <div style={{ fontFamily: "var(--serif)", fontSize: 19, color: "var(--ink)" }}>
            <em>Drop notes, exercises, or topics</em>
          </div>
          <div style={{ fontSize: 12.5, color: "var(--ink-50)", marginTop: 3 }}>
            text & markdown read in place · PDFs and images upload first · or paste below
          </div>
        </div>
        <button
          onClick={() => inputRef.current?.click()}
          className="qbtn"
          style={{
            marginLeft: "auto",
            padding: "6px 12px",
            border: "1px solid var(--rule)",
            borderRadius: 100,
            fontSize: 12.5,
          }}
        >
          choose files
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          style={{ display: "none" }}
          onChange={(e) => handleFiles([...(e.target.files || [])])}
        />
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        placeholder="…or paste a passage, an outline, a problem set."
        style={{
          width: "100%",
          padding: "14px 16px",
          border: "1px solid var(--rule)",
          borderRadius: "var(--r-md)",
          fontFamily: "var(--serif)",
          fontSize: 15,
          lineHeight: 1.5,
          background: "var(--paper)",
          resize: "vertical",
        }}
      />

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 14 }}>
        <div style={{ fontSize: 12, color: "var(--ink-35)", fontStyle: "italic", fontFamily: "var(--serif)" }}>
          {busy ? "thinking…" : error ? <span style={{ color: "var(--rose)" }}>{error}</span> : "Sonnet runs summary + flashcards in parallel"}
        </div>
        <button
          onClick={() => startIngest({ text: text.trim() })}
          disabled={busy || !text.trim()}
          style={{
            padding: "8px 16px",
            background: text.trim() ? "var(--ink)" : "var(--ink-20)",
            color: "var(--paper)",
            borderRadius: 100,
            fontSize: 13,
            opacity: busy ? 0.7 : 1,
            cursor: busy || !text.trim() ? "default" : "pointer",
          }}
        >
          {busy ? "running…" : "summarize & build flashcards"}
        </button>
      </div>
    </div>
  );
}

// ─── Summary render ─────────────────────────────────────────────────────────

function SummaryRender({ artifact, mode }) {
  const p = artifact.payload || {};
  const accent = mode === "ulzii" ? "var(--sky)" : "var(--forest)";
  return (
    <div style={{ maxWidth: 820 }}>
      {p.headline && (
        <div style={{ fontFamily: "var(--serif)", fontSize: 22, color: "var(--ink)", lineHeight: 1.4, fontStyle: "italic", marginBottom: 22 }}>
          {p.headline}
        </div>
      )}
      {(p.sections || []).map((s, i) => (
        <div key={i} style={{ borderTop: "1px solid var(--rule-soft)", padding: "18px 0" }}>
          <div className="mono" style={{ fontSize: 11, letterSpacing: ".14em", textTransform: "uppercase", color: accent }}>
            {s.title}
          </div>
          <div style={{ fontFamily: "var(--serif)", fontSize: 16, lineHeight: 1.65, marginTop: 8, color: "var(--ink-70)", whiteSpace: "pre-wrap" }}>
            {s.body_md}
          </div>
        </div>
      ))}
      {p.key_terms && p.key_terms.length > 0 && (
        <div style={{ borderTop: "1px solid var(--rule)", marginTop: 18, paddingTop: 18 }}>
          <div className="mono" style={{ fontSize: 11, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--ink-50)", marginBottom: 12 }}>
            key terms
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 10 }}>
            {p.key_terms.map((t, i) => (
              <div key={i} style={{ padding: "10px 12px", border: "1px solid var(--rule-soft)", borderRadius: "var(--r-sm)" }}>
                <div style={{ fontFamily: "var(--serif)", fontStyle: "italic", color: "var(--ink)" }}>{t.term}</div>
                <div style={{ fontSize: 13, color: "var(--ink-50)", marginTop: 4, lineHeight: 1.4 }}>{t.gloss}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      {p.open_questions && p.open_questions.length > 0 && (
        <div style={{ marginTop: 22 }}>
          <div className="mono" style={{ fontSize: 11, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--ink-50)", marginBottom: 10 }}>
            open questions
          </div>
          {p.open_questions.map((q, i) => (
            <div key={i} style={{ padding: "10px 14px", background: "#f5e9c8", borderRadius: 8, fontFamily: "var(--serif)", fontStyle: "italic", color: "var(--ink-70)", fontSize: 14, marginBottom: 8 }}>
              {q}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Flashcards (TOK card.html-inspired) ────────────────────────────────────

function FlashcardSession({ deck, onUpdate }) {
  // Local copy of cards + review_state. We update optimistically on rate(),
  // then call /review which returns canonical state for the rated card.
  const cards = deck.payload?.cards || [];
  const [state, setState] = useState(() => deck.payload?.review_state || {});
  const [queue, setQueue] = useState(() => buildQueue(cards, deck.payload?.review_state || {}));
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [reviewedCount, setReviewedCount] = useState(0);

  // If the deck artifact reloads (e.g. after a generate), reset state from server.
  useEffect(() => {
    setState(deck.payload?.review_state || {});
    setQueue(buildQueue(cards, deck.payload?.review_state || {}));
    setIdx(0);
    setFlipped(false);
    setReviewedCount(0);
  }, [deck.id, cards.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const stats = useMemo(() => computeStats(cards, state), [cards, state]);

  const flip = () => setFlipped((f) => !f);

  const rate = useCallback(async (signal) => {
    if (idx >= queue.length) return;
    const cardIdx = queue[idx];

    // Optimistic local update — server returns canonical state on response.
    setState((prev) => ({
      ...prev,
      [cardIdx]: localRnnUpdate(prev[cardIdx] || { h: 0.1, last_review: null, reviews: 0, streak: 0 }, signal),
    }));

    let nextQueue = queue;
    if (signal < 0.33) {
      // Re-insert this card 3-5 positions ahead (matches TOK card.html).
      const insertAt = Math.min(idx + 3 + Math.floor(Math.random() * 3), queue.length);
      nextQueue = [...queue.slice(0, insertAt), cardIdx, ...queue.slice(insertAt)];
      setQueue(nextQueue);
    }

    setIdx((i) => i + 1);
    setFlipped(false);
    setReviewedCount((c) => c + 1);

    // Persist to server (fire-and-forget; we already updated locally).
    try {
      const resp = await examApi.reviewFlashcard(deck.id, { card_idx: cardIdx, signal });
      setState((prev) => ({
        ...prev,
        [cardIdx]: {
          h: resp.h,
          last_review: resp.last_review,
          reviews: resp.reviews,
          streak: resp.streak,
        },
      }));
    } catch {
      // Roll back the optimistic update on failure (rare; let it slide for now).
    }
  }, [idx, queue, deck.id]);

  // Keyboard shortcuts: Space/Enter = flip, 1-4 = rate when flipped.
  // Skip when focus is in an input/textarea so typing in DropZone or workspace
  // forms doesn't accidentally flip cards.
  useEffect(() => {
    const onKey = (e) => {
      const tag = (e.target && e.target.tagName) || "";
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target && e.target.isContentEditable)) return;
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        flip();
      }
      if (flipped) {
        if (e.key === "1") rate(0);
        else if (e.key === "2") rate(0.33);
        else if (e.key === "3") rate(0.66);
        else if (e.key === "4") rate(1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [flipped, rate]);

  if (cards.length === 0) {
    return <EmptyMicro line="flashcard deck is empty." />;
  }

  if (idx >= queue.length) {
    return (
      <div style={{ padding: "40px 0", textAlign: "center" }}>
        <div style={{ fontFamily: "var(--serif)", fontSize: 22, color: "var(--ink)", marginBottom: 6 }}>
          <em>Session complete</em>
        </div>
        <div style={{ fontSize: 13, color: "var(--ink-50)", marginBottom: 20 }}>
          {reviewedCount} card{reviewedCount === 1 ? "" : "s"} reviewed.
        </div>
        <button
          onClick={() => {
            const newState = state;
            setQueue(buildQueue(cards, newState));
            setIdx(0);
            setFlipped(false);
            setReviewedCount(0);
            onUpdate?.();
          }}
          className="qbtn"
          style={{ padding: "8px 16px", border: "1px solid var(--rule)", borderRadius: 100 }}
        >
          start another pass
        </button>
      </div>
    );
  }

  const cardIdx = queue[idx];
  const card = cards[cardIdx];
  const cardState = state[cardIdx] || { h: 0.1, reviews: 0 };
  const dots = Math.round((cardState.h ?? 0.1) * 5);
  const total = queue.length;
  const pct = Math.round((idx / total) * 100);

  return (
    <div style={{ maxWidth: 600, margin: "0 auto" }}>
      {/* Stats bar */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", borderTop: "1px solid var(--rule-soft)", borderBottom: "1px solid var(--rule-soft)", marginBottom: 22 }}>
        <Stat label="due" value={stats.due} color="var(--rose)" />
        <Stat label="learning" value={stats.learning} color="var(--gold)" />
        <Stat label="mastered" value={stats.mastered} color="var(--forest)" />
        <Stat label="reviewed" value={reviewedCount} />
      </div>

      {/* Card */}
      <div
        onClick={flip}
        style={{
          perspective: "1200px",
          width: "100%",
          height: 320,
          cursor: "pointer",
          marginBottom: 20,
        }}
      >
        <div
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            transition: "transform 0.55s cubic-bezier(0.16, 1, 0.3, 1)",
            transformStyle: "preserve-3d",
            transform: flipped ? "rotateY(180deg)" : "none",
          }}
        >
          <CardFace
            number={`Card ${idx + 1} / ${total}`}
            badge={card.topic}
            body={card.front}
            hint="click to reveal answer"
            flipped={false}
            isQuestion
          />
          <CardFace
            number="Answer"
            badge={card.topic}
            body={card.back}
            hint="rate your recall below"
            flipped
          />
        </div>
      </div>

      {/* Confidence buttons */}
      <div
        style={{
          display: "flex",
          gap: 10,
          marginBottom: 20,
          opacity: flipped ? 1 : 0.35,
          pointerEvents: flipped ? "auto" : "none",
          transition: "opacity 0.25s",
        }}
      >
        <ConfBtn label="Again" k="1" accent="var(--rose)"   onClick={() => rate(0)}    />
        <ConfBtn label="Hard"  k="2" accent="var(--gold)"   onClick={() => rate(0.33)} />
        <ConfBtn label="Good"  k="3" accent="var(--forest)" onClick={() => rate(0.66)} />
        <ConfBtn label="Easy"  k="4" accent="var(--ink)"    onClick={() => rate(1)}    />
      </div>

      {/* Progress + memory */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 10 }}>
        <div style={{ flex: 1, height: 2, background: "var(--rule)", position: "relative", overflow: "hidden" }}>
          <div
            style={{
              position: "absolute",
              left: 0, top: 0, bottom: 0,
              width: `${pct}%`,
              background: "var(--ink)",
              transition: "width 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          />
        </div>
        <div className="mono tnum" style={{ fontSize: 10, color: "var(--ink-35)" }}>{pct}%</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span className="mono" style={{ fontSize: 9, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--ink-35)" }}>
          memory strength
        </span>
        <div style={{ display: "flex", gap: 4 }}>
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              style={{
                width: 8,
                height: 8,
                background: i <= dots ? "var(--ink)" : "transparent",
                border: `1px solid ${i <= dots ? "var(--ink)" : "var(--rule)"}`,
                transition: "all 0.3s",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function CardFace({ number, badge, body, hint, flipped, isQuestion }) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        backfaceVisibility: "hidden",
        WebkitBackfaceVisibility: "hidden",
        border: "1.5px solid var(--ink)",
        background: "var(--paper)",
        display: "flex",
        flexDirection: "column",
        padding: "30px 32px",
        overflowY: "auto",
        borderRadius: "var(--r-md)",
        transform: flipped ? "rotateY(180deg)" : "none",
      }}
    >
      <div className="mono" style={{ fontSize: 9, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--ink-35)", marginBottom: 6 }}>
        {number}
      </div>
      <div
        style={{
          fontSize: 10,
          letterSpacing: ".1em",
          textTransform: "uppercase",
          color: "var(--rose)",
          fontWeight: 600,
          marginBottom: 18,
          alignSelf: "flex-start",
          borderBottom: "1px solid var(--rose)",
          paddingBottom: 2,
        }}
      >
        {badge}
      </div>
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          fontFamily: isQuestion ? "var(--serif)" : "var(--serif)",
          fontSize: isQuestion ? 22 : 16,
          lineHeight: isQuestion ? 1.4 : 1.65,
          color: isQuestion ? "var(--ink)" : "var(--ink-70)",
          letterSpacing: isQuestion ? "-0.005em" : 0,
          fontStyle: isQuestion ? "italic" : "normal",
        }}
      >
        {body}
      </div>
      <div
        style={{
          fontSize: 11,
          color: "var(--ink-35)",
          textAlign: "center",
          marginTop: "auto",
          paddingTop: 12,
          borderTop: "1px solid var(--rule-soft)",
        }}
      >
        {hint}
      </div>
    </div>
  );
}

function ConfBtn({ label, k, accent, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        padding: "12px 10px",
        border: "1.5px solid var(--ink)",
        background: "var(--paper)",
        fontSize: 11,
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: ".1em",
        cursor: "pointer",
        position: "relative",
        overflow: "hidden",
        transition: "transform .15s, box-shadow .15s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,.08)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "none";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      {label}
      <span
        style={{
          display: "block",
          fontSize: 9,
          color: "var(--ink-35)",
          fontWeight: 400,
          marginTop: 3,
        }}
      >
        {k}
      </span>
      <span
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 3,
          background: accent,
        }}
      />
    </button>
  );
}

function Stat({ label, value, color }) {
  return (
    <div style={{ padding: "12px 18px", borderRight: "1px solid var(--rule-soft)" }}>
      <div className="mono" style={{ fontSize: 9, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--ink-35)", marginBottom: 4 }}>
        {label}
      </div>
      <div className="tnum" style={{ fontFamily: "var(--serif)", fontSize: 24, letterSpacing: "-.03em", color: color || "var(--ink)" }}>
        {value}
      </div>
    </div>
  );
}

// ─── secondary actions ──────────────────────────────────────────────────────

function SecondaryActions({ workspace, mode, cheatsheet, practice, graph, onGenerate }) {
  const [busy, setBusy] = useState(null);
  const [open, setOpen] = useState(null); // kind currently expanded

  const generate = async (kind) => {
    setBusy(kind);
    try {
      await examApi.generate(workspace.id, { kind, mode });
      onGenerate();
    } catch {} finally {
      setBusy(null);
    }
  };

  const items = [
    { kind: "cheatsheet",      label: "cheatsheet",         existing: cheatsheet, blurb: "compressed for the day before." },
    { kind: "practice_set",    label: "practice set",       existing: practice,   blurb: "10 calibrated questions." },
    { kind: "knowledge_graph", label: "knowledge graph",    existing: graph,      blurb: "voronoi map of the territory." },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
        {items.map((it) => {
          const isOpen = open === it.kind && it.existing?.status === "ready";
          return (
            <div
              key={it.kind}
              style={{
                padding: "14px 16px",
                border: isOpen ? "1px solid var(--ink)" : "1px solid var(--rule)",
                borderRadius: "var(--r-md)",
                display: "flex",
                flexDirection: "column",
                gap: 6,
                background: isOpen ? "var(--surface)" : "transparent",
                transition: "border-color .15s, background .15s",
              }}
            >
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                <span style={{ fontFamily: "var(--serif)", fontSize: 16, color: "var(--ink)" }}>
                  <em>{it.label}</em>
                </span>
                {it.existing && it.existing.status === "ready" && (
                  <span className="mono" style={{ fontSize: 10, color: "var(--forest)", letterSpacing: ".06em", textTransform: "uppercase" }}>
                    ready
                  </span>
                )}
                {it.existing && it.existing.status === "generating" && (
                  <span className="mono" style={{ fontSize: 10, color: "var(--gold)", letterSpacing: ".06em", textTransform: "uppercase" }}>
                    generating
                  </span>
                )}
                {it.existing && it.existing.status === "error" && (
                  <span className="mono" style={{ fontSize: 10, color: "var(--rose)", letterSpacing: ".06em", textTransform: "uppercase" }}>
                    error
                  </span>
                )}
              </div>
              <div style={{ fontSize: 12.5, color: "var(--ink-50)", lineHeight: 1.5, fontFamily: "var(--serif)", fontStyle: "italic" }}>
                {it.blurb}
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                <button
                  onClick={() => generate(it.kind)}
                  disabled={busy === it.kind || it.existing?.status === "generating"}
                  className="qbtn"
                  style={{
                    padding: "5px 10px",
                    border: "1px solid var(--rule)",
                    borderRadius: 100,
                    fontSize: 12,
                    opacity: busy === it.kind ? 0.6 : 1,
                  }}
                >
                  {busy === it.kind ? "starting…" : it.existing ? "regenerate" : "generate"}
                </button>
                {it.existing?.status === "ready" && (
                  <button
                    onClick={() => setOpen(isOpen ? null : it.kind)}
                    className="qbtn"
                    style={{
                      padding: "5px 10px",
                      border: "1px solid var(--rule)",
                      borderRadius: 100,
                      fontSize: 12,
                      color: "var(--ink)",
                    }}
                  >
                    {isOpen ? "hide" : "open"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Expanded artifact body */}
      {open === "cheatsheet" && cheatsheet?.status === "ready" && (
        <div style={{ marginTop: 8, padding: "20px 24px", border: "1px solid var(--rule-soft)", borderRadius: "var(--r-md)", background: "var(--paper-2)" }}>
          <CheatsheetRender artifact={cheatsheet} mode={mode} />
        </div>
      )}
      {open === "practice_set" && practice?.status === "ready" && (
        <div style={{ marginTop: 8, padding: "20px 24px", border: "1px solid var(--rule-soft)", borderRadius: "var(--r-md)", background: "var(--paper-2)" }}>
          <PracticeRender artifact={practice} />
        </div>
      )}
      {open === "knowledge_graph" && graph?.status === "ready" && (
        <div style={{ marginTop: 8, padding: "20px 24px", border: "1px solid var(--rule-soft)", borderRadius: "var(--r-md)", background: "var(--paper-2)" }}>
          <KnowledgeGraphRender artifact={graph} />
        </div>
      )}
    </div>
  );
}

function CheatsheetRender({ artifact, mode }) {
  const sections = artifact.payload?.sections || [];
  const accent = mode === "ulzii" ? "var(--sky)" : "var(--forest)";
  if (sections.length === 0) {
    return <EmptyMicro line="cheatsheet payload was empty — try regenerating." />;
  }
  return (
    <div style={{ maxWidth: 820 }}>
      {sections.map((s, i) => (
        <div key={i} style={{ borderTop: i === 0 ? "none" : "1px solid var(--rule-soft)", padding: i === 0 ? 0 : "18px 0 0", marginTop: i === 0 ? 0 : 14 }}>
          <div className="mono" style={{ fontSize: 11, letterSpacing: ".14em", textTransform: "uppercase", color: accent }}>
            {s.title}
          </div>
          <div style={{ marginTop: 10 }}>
            {(s.items || []).map((it, j) => (
              <div key={j} style={{ marginTop: j === 0 ? 0 : 14 }}>
                <div style={{ fontFamily: "var(--serif)", fontSize: 16, color: "var(--ink)" }}>
                  <strong>{it.name}</strong>
                </div>
                <div style={{ color: "var(--ink-70)", marginTop: 4, whiteSpace: "pre-wrap", fontSize: 14, lineHeight: 1.6 }}>
                  {it.body_md}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function PracticeRender({ artifact }) {
  const questions = artifact.payload?.questions || [];
  const [revealed, setRevealed] = useState(() => new Set());
  const toggle = (id) => {
    setRevealed((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  if (questions.length === 0) {
    return <EmptyMicro line="no questions yet — try regenerating." />;
  }
  return (
    <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 14 }}>
      {questions.map((q, i) => {
        const open = revealed.has(q.id);
        return (
          <li key={q.id || i} style={{ paddingBottom: 14, borderBottom: "1px solid var(--rule-soft)" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
              <span className="mono tnum" style={{ fontSize: 11, color: "var(--ink-35)", width: 24 }}>
                {String(i + 1).padStart(2, "0")}
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: "var(--serif)", fontSize: 16, color: "var(--ink)", lineHeight: 1.5 }}>
                  {q.prompt}
                </div>
                {q.choices && q.choices.length > 0 && (
                  <ul style={{ margin: "8px 0 0", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 4 }}>
                    {q.choices.map((c, j) => (
                      <li key={j} style={{ fontSize: 14, color: open && j === q.correct_index ? "var(--forest)" : "var(--ink-70)", paddingLeft: 18, position: "relative" }}>
                        <span style={{ position: "absolute", left: 0, color: "var(--ink-35)", fontFamily: "var(--mono)", fontSize: 11 }}>
                          {String.fromCharCode(65 + j)}.
                        </span>
                        {c}
                      </li>
                    ))}
                  </ul>
                )}
                <div style={{ marginTop: 6, display: "flex", gap: 10, alignItems: "center" }}>
                  <span className="mono" style={{ fontSize: 10, color: "var(--ink-35)", letterSpacing: ".08em", textTransform: "uppercase" }}>
                    {q.topic}
                  </span>
                  {typeof q.difficulty === "number" && (
                    <span className="mono" style={{ fontSize: 10, color: "var(--ink-35)" }}>
                      difficulty {Math.round(q.difficulty * 10) / 10}
                    </span>
                  )}
                  <button onClick={() => toggle(q.id)} className="qbtn" style={{ marginLeft: "auto", padding: "3px 8px", fontSize: 11 }}>
                    {open ? "hide answer" : "reveal"}
                  </button>
                </div>
                {open && (q.expected || q.rubric) && (
                  <div style={{ marginTop: 8, padding: "10px 12px", background: "var(--ink-06)", borderRadius: 6, fontSize: 13.5, color: "var(--ink-70)", lineHeight: 1.55 }}>
                    {q.expected && <div><strong style={{ color: "var(--ink)" }}>Expected:</strong> {q.expected}</div>}
                    {q.rubric && <div style={{ marginTop: q.expected ? 6 : 0 }}><strong style={{ color: "var(--ink)" }}>Rubric:</strong> {q.rubric}</div>}
                  </div>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function KnowledgeGraphRender({ artifact }) {
  const data = artifact.payload || {};
  const regions = data.regions || [];
  const nodes = data.nodes || [];
  const edges = data.edges || [];
  if (nodes.length === 0) {
    return <EmptyMicro line="graph is empty." />;
  }
  // Region-grouped 2D layout. The full 3D constellation lands later.
  const byRegion = new Map();
  regions.forEach((r) => byRegion.set(r.id, []));
  nodes.forEach((n) => {
    if (!byRegion.has(n.region)) byRegion.set(n.region, []);
    byRegion.get(n.region).push(n);
  });
  return (
    <div>
      <div className="mono" style={{ fontSize: 10, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--ink-35)", marginBottom: 14 }}>
        {nodes.length} concepts · {regions.length || byRegion.size} regions · {edges.length} edges
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
        {[...byRegion.entries()].map(([rid, ns]) => {
          const region = regions.find((r) => r.id === rid);
          return (
            <div key={rid} style={{ padding: "12px 14px", border: "1px solid var(--rule-soft)", borderRadius: "var(--r-md)", background: "var(--surface)" }}>
              <div style={{ fontFamily: "var(--serif)", fontStyle: "italic", color: "var(--ink)", fontSize: 16, marginBottom: 8 }}>
                {region?.label || rid}
              </div>
              <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 4 }}>
                {ns
                  .slice()
                  .sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0))
                  .map((n) => (
                    <li key={n.id} style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                      <span style={{
                        width: Math.max(6, Math.round((n.weight || 0.4) * 14)),
                        height: Math.max(6, Math.round((n.weight || 0.4) * 14)),
                        borderRadius: 100,
                        background: region?.color || "var(--ink-50)",
                        flexShrink: 0,
                      }} />
                      <span style={{ fontSize: 14, color: "var(--ink)" }}>{n.label}</span>
                    </li>
                  ))}
              </ul>
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: 12, color: "var(--ink-35)", fontStyle: "italic", fontFamily: "var(--serif)", marginTop: 14 }}>
        full 3D constellation lands with the next pass.
      </div>
    </div>
  );
}

// ─── small primitives ───────────────────────────────────────────────────────

function SectionHeader({ children, right }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
      <div className="mono" style={{ fontSize: 12, letterSpacing: ".18em", textTransform: "uppercase", color: "var(--ink)", fontWeight: 700 }}>
        {children}
      </div>
      {right && (
        <div className="mono" style={{ fontSize: 11, color: "var(--ink-35)" }}>{right}</div>
      )}
    </div>
  );
}

function EmptyMicro({ line }) {
  return (
    <div style={{ fontFamily: "var(--serif)", fontStyle: "italic", color: "var(--ink-50)", fontSize: 14, padding: "8px 0 24px" }}>
      {line}
    </div>
  );
}

function Generating({ mode, label }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 0" }}>
      <div
        style={{
          width: 22,
          height: 22,
          borderRadius: 11,
          border: `1.5px solid ${mode === "ulzii" ? "var(--sky)" : "var(--forest)"}`,
          animation: "pulse 2.2s ease-in-out infinite",
        }}
      />
      <div style={{ fontFamily: "var(--serif)", fontSize: 15, fontStyle: "italic", color: "var(--ink-50)" }}>
        {label}
      </div>
    </div>
  );
}

function ErrorLine({ error }) {
  return (
    <div style={{ padding: "10px 14px", background: "rgba(193,52,71,.08)", borderRadius: 6, color: "var(--rose)", fontSize: 13.5 }}>
      {error || "something went wrong — try again."}
    </div>
  );
}

// ─── client-side scheduler (mirror of server) ───────────────────────────────

function buildQueue(cards, state) {
  const ids = cards.map((_, i) => i);
  // Higher priority (1 - h) first; ties broken by index.
  return ids
    .map((i) => [i, getPriority(state[i])])
    .sort((a, b) => b[1] - a[1])
    .map(([i]) => i);
}

function getPriority(s) {
  if (!s) return 0.9;
  return 1 - clamp01(currentMemoryStrength(s));
}

function currentMemoryStrength(s) {
  if (!s.last_review) return s.h ?? 0.1;
  const dtH = Math.max(0, (Date.now() - new Date(s.last_review).getTime()) / 3_600_000);
  const decay = Math.exp(-0.03 * dtH);
  return sigmoid(((0.85 * (s.h ?? 0.1)) * decay) * 6 - 3);
}

function localRnnUpdate(s, signal) {
  const currentH = currentMemoryStrength(s);
  const recurrence = 0.85 * currentH;
  const inp = 0.4 * signal;
  let h = sigmoid((recurrence + inp) * 5 - 2);
  const streak = signal >= 0.5 ? (s.streak || 0) + 1 : 0;
  if (streak > 2) h = Math.min(1, h + 0.05);
  return {
    h,
    last_review: new Date().toISOString(),
    reviews: (s.reviews || 0) + 1,
    streak,
  };
}

function computeStats(cards, state) {
  let mastered = 0, learning = 0, n = 0, due = 0;
  cards.forEach((_, i) => {
    const s = state[i];
    const h = currentMemoryStrength(s || { h: 0.1 });
    if (!s || (s.reviews || 0) === 0) n++;
    else if (h > 0.8) mastered++;
    else learning++;
    if (h < 0.6 || !s || (s.reviews || 0) === 0) due++;
  });
  return { mastered, learning, new: n, due };
}

const sigmoid = (x) => 1 / (1 + Math.exp(-x));
const clamp01 = (x) => Math.max(0, Math.min(1, x));

export { ExamView };
