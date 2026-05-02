"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Empty, ModePill, Skel } from "./atoms";
import { I } from "./icons";
import { tasksApi, useTasks } from "@/lib/v3-hooks";

// Calendar — week / month / day views, AI planner. Wired to /api/v1/tasks.

function CalendarView({ mode }) {
  const [view, setView] = useState("week");
  const [planning, setPlanning] = useState(false);
  const [anchor, setAnchor] = useState(() => startOfWeek(new Date()));

  const range = rangeFor(view, anchor);
  const { tasks, reload } = useTasks({
    range_from: range.from.toISOString(),
    range_to: range.to.toISOString(),
  });

  const title = useMemo(() => titleFor(view, anchor), [view, anchor]);

  return (
    <div style={{ height: "100%", display: "grid", gridTemplateRows: "auto 1fr", overflow: "hidden" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "22px 32px",
          borderBottom: "1px solid var(--rule-soft)",
        }}
      >
        <div>
          <div
            style={{
              fontFamily: "var(--mono)",
              fontSize: 11,
              letterSpacing: ".18em",
              textTransform: "uppercase",
              color: "var(--ink-35)",
            }}
          >
            calendar
          </div>
          <div style={{ fontFamily: "var(--serif)", fontSize: 28, marginTop: 4 }}>
            {title}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <button
            onClick={() => setAnchor(stepAnchor(anchor, view, -1))}
            className="qbtn"
            style={{ padding: "6px 10px" }}
          >
            <I.back size={14} />
          </button>
          <button
            onClick={() => setAnchor(stepAnchor(anchor, view, 1))}
            className="qbtn"
            style={{ padding: "6px 10px", transform: "rotate(180deg)" }}
          >
            <I.back size={14} />
          </button>
          <button
            onClick={() => setAnchor(startOfWeek(new Date()))}
            className="qbtn"
            style={{ padding: "6px 12px", border: "1px solid var(--rule)", borderRadius: 100 }}
          >
            today
          </button>
          <div style={{ display: "flex", padding: 3, background: "var(--ink-06)", borderRadius: 100, gap: 2 }}>
            {["month", "week", "day"].map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                style={{
                  padding: "5px 14px",
                  borderRadius: 100,
                  fontSize: 12.5,
                  background: v === view ? "var(--surface)" : "transparent",
                  color: v === view ? "var(--ink)" : "var(--ink-50)",
                  boxShadow: v === view ? "0 1px 2px rgba(26,29,44,.08)" : "none",
                }}
              >
                {v}
              </button>
            ))}
          </div>
          <button
            onClick={() => setPlanning(true)}
            style={{
              padding: "8px 14px",
              background: "var(--ink)",
              color: "var(--paper)",
              borderRadius: 100,
              fontSize: 13,
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <I.sparkle size={13} /> ask for suggestions
          </button>
        </div>
      </div>
      <div style={{ position: "relative", overflow: "hidden" }}>
        <div
          style={{
            height: "100%",
            paddingRight: planning ? "min(420px, 50vw)" : 0,
            transition: "padding-right .25s cubic-bezier(.16,1,.3,1)",
            overflow: "hidden",
          }}
        >
          {view === "week" && <WeekGrid tasks={tasks} anchor={anchor} reload={reload} />}
          {view === "month" && <MonthGrid tasks={tasks} anchor={anchor} />}
          {view === "day" && <DayGrid tasks={tasks} anchor={anchor} reload={reload} />}
        </div>
        {planning && (
          <SuggestionsPanel
            mode={mode}
            anchor={anchor}
            onClose={() => setPlanning(false)}
            onAdded={() => reload()}
          />
        )}
      </div>
    </div>
  );
}

// ─── Week ────────────────────────────────────────────────────────────────────

function WeekGrid({ tasks, anchor, reload }) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(anchor, i));
  const hours = Array.from({ length: 14 }, (_, i) => i + 8); // 8..21
  const today = new Date();

  return (
    <div style={{ overflow: "auto", padding: "0 32px 32px" }}>
      {/* Header */}
      <div style={{ display: "grid", gridTemplateColumns: "56px repeat(7, 1fr)", borderBottom: "1px solid var(--rule)" }}>
        <div />
        {days.map((d) => {
          const isToday = sameDay(d, today);
          return (
            <div
              key={d.toISOString()}
              style={{
                padding: "14px 12px",
                borderLeft: "1px solid var(--rule-soft)",
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
              }}
            >
              <span
                className="mono"
                style={{
                  fontSize: 11,
                  letterSpacing: ".1em",
                  textTransform: "uppercase",
                  color: "var(--ink-50)",
                }}
              >
                {dayShort(d)}
              </span>
              <span
                className="tnum"
                style={{
                  fontFamily: "var(--serif)",
                  fontSize: 22,
                  color: isToday ? "var(--ink)" : "var(--ink-50)",
                  fontStyle: isToday ? "italic" : "normal",
                }}
              >
                {d.getDate()}
              </span>
            </div>
          );
        })}
      </div>

      {/* All-day strip — events with all_day OR with no time slot. */}
      <AllDayStrip days={days} tasks={tasks} reload={reload} />

      {/* Hour grid + timed events */}
      <div style={{ display: "grid", gridTemplateColumns: "56px repeat(7, 1fr)", position: "relative" }}>
        <div>
          {hours.map((h) => (
            <div key={h} style={{ height: 64, position: "relative", color: "var(--ink-35)" }}>
              <span className="tnum mono" style={{ position: "absolute", top: -7, right: 8, fontSize: 10.5 }}>
                {String(h).padStart(2, "0")}:00
              </span>
            </div>
          ))}
        </div>
        {days.map((d) => {
          const dayTasks = tasks.filter(
            (t) =>
              t.kind === "event" &&
              !t.all_day &&
              t.starts_at &&
              sameDay(new Date(t.starts_at), d),
          );
          return (
            <div key={d.toISOString()} style={{ borderLeft: "1px solid var(--rule-soft)", position: "relative" }}>
              {hours.map((h) => (
                <div key={h} style={{ height: 64, borderTop: "1px solid var(--rule-soft)" }} />
              ))}
              {dayTasks.map((t) => {
                const start = new Date(t.starts_at);
                const end = t.ends_at ? new Date(t.ends_at) : new Date(start.getTime() + 3600000);
                const startH = start.getHours() + start.getMinutes() / 60;
                const dur = Math.max(0.5, (end - start) / 3600000);
                const top = (startH - 8) * 64 + 2;
                if (top < 0) return null;
                const accent = colorOf(t);
                return (
                  <div
                    key={t.id}
                    style={{
                      position: "absolute",
                      left: 6,
                      right: 6,
                      top,
                      height: dur * 64 - 4,
                      background: tintOf(t),
                      borderRadius: 8,
                      padding: "8px 10px",
                      fontSize: 12,
                      color: "var(--ink)",
                      borderLeft: `3px solid ${accent}`,
                      overflow: "hidden",
                    }}
                  >
                    <div style={{ fontWeight: 500 }}>{t.title}</div>
                    <div className="tnum" style={{ fontSize: 11, color: "var(--ink-50)", marginTop: 2 }}>
                      {fmtHM(start)}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AllDayStrip({ days, tasks, reload }) {
  // Buckets of all-day events keyed by ISO day.
  const byDay = useMemo(() => {
    const m = new Map();
    days.forEach((d) => m.set(d.toDateString(), []));
    for (const t of tasks) {
      if (t.kind !== "event") continue;
      if (!t.all_day) continue;
      const d = t.starts_at ? new Date(t.starts_at) : null;
      if (!d) continue;
      const key = d.toDateString();
      if (m.has(key)) m.get(key).push(t);
    }
    return m;
  }, [days, tasks]);

  const anyAllDay = [...byDay.values()].some((arr) => arr.length > 0);
  if (!anyAllDay) return null;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "56px repeat(7, 1fr)",
        borderBottom: "1px solid var(--rule-soft)",
        background: "var(--paper-2)",
      }}
    >
      <div className="mono" style={{ padding: "8px 0 8px 8px", fontSize: 9, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--ink-35)", display: "flex", alignItems: "center" }}>
        all day
      </div>
      {days.map((d) => {
        const items = byDay.get(d.toDateString()) || [];
        return (
          <div key={d.toISOString()} style={{ borderLeft: "1px solid var(--rule-soft)", padding: "6px 6px", minHeight: 28, display: "flex", flexDirection: "column", gap: 2 }}>
            {items.map((t) => {
              const accent = colorOf(t);
              return (
                <div
                  key={t.id}
                  title={t.title}
                  style={{
                    fontSize: 11,
                    padding: "3px 6px",
                    borderRadius: 4,
                    background: tintOf(t),
                    borderLeft: `3px solid ${accent}`,
                    color: "var(--ink)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {t.title}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

// ─── Month ──────────────────────────────────────────────────────────────────

function MonthGrid({ tasks, anchor }) {
  const monthStart = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const monthEnd = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
  const startWeekday = (monthStart.getDay() + 6) % 7; // mon=0
  const today = new Date();

  return (
    <div style={{ padding: "0 32px 32px", overflow: "auto" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          borderTop: "1px solid var(--rule)",
          borderLeft: "1px solid var(--rule)",
        }}
      >
        {["mon", "tue", "wed", "thu", "fri", "sat", "sun"].map((d) => (
          <div
            key={d}
            className="mono"
            style={{
              padding: "10px 12px",
              fontSize: 11,
              letterSpacing: ".1em",
              textTransform: "uppercase",
              color: "var(--ink-50)",
              borderRight: "1px solid var(--rule)",
              borderBottom: "1px solid var(--rule)",
            }}
          >
            {d}
          </div>
        ))}
        {Array.from({ length: 42 }, (_, i) => {
          const dayNum = i - startWeekday + 1;
          const inMonth = dayNum >= 1 && dayNum <= monthEnd.getDate();
          const cellDate = new Date(anchor.getFullYear(), anchor.getMonth(), dayNum);
          const isToday = inMonth && sameDay(cellDate, today);
          const cellTasks = inMonth
            ? tasks.filter((t) => t.starts_at && sameDay(new Date(t.starts_at), cellDate))
            : [];
          return (
            <div
              key={i}
              style={{
                minHeight: 96,
                padding: "8px 10px",
                borderRight: "1px solid var(--rule)",
                borderBottom: "1px solid var(--rule)",
                background: inMonth ? "transparent" : "var(--paper-2)",
              }}
            >
              <div
                className="tnum"
                style={{
                  fontFamily: "var(--serif)",
                  fontSize: 15,
                  color: !inMonth ? "var(--ink-35)" : isToday ? "var(--ink)" : "var(--ink-70)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  border: isToday ? "1px solid var(--sky)" : "none",
                  fontStyle: isToday ? "italic" : "normal",
                }}
              >
                {inMonth ? dayNum : ""}
              </div>
              {cellTasks.length > 0 && (
                <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 3 }}>
                  {cellTasks.slice(0, 3).map((t) => (
                    <div
                      key={t.id}
                      style={{
                        fontSize: 11,
                        padding: "2px 6px",
                        borderRadius: 4,
                        background: tintOf(t),
                        color: colorOf(t),
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {t.title}
                    </div>
                  ))}
                  {cellTasks.length > 3 && (
                    <div className="mono" style={{ fontSize: 10, color: "var(--ink-50)", padding: "0 6px" }}>
                      +{cellTasks.length - 3}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Day ────────────────────────────────────────────────────────────────────

function DayGrid({ tasks, anchor, reload }) {
  const dayStart = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());
  const dayEvents = tasks.filter(
    (t) => t.kind === "event" && t.starts_at && sameDay(new Date(t.starts_at), dayStart),
  );
  const undated = tasks.filter((t) => t.kind === "task" && !t.starts_at && t.status !== "done");

  const onComplete = async (t) => {
    try {
      await tasksApi.complete(t.id);
      reload();
    } catch {}
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", overflow: "hidden" }}>
      <div style={{ overflow: "auto", padding: "0 32px 32px" }}>
        <div style={{ position: "relative" }}>
          {Array.from({ length: 14 }, (_, i) => i + 8).map((h) => {
            const ev = dayEvents.find((t) => new Date(t.starts_at).getHours() === h);
            return (
              <div key={h} style={{ display: "flex", borderTop: "1px solid var(--rule-soft)", height: 80 }}>
                <div className="tnum mono" style={{ width: 60, fontSize: 11, color: "var(--ink-35)", paddingTop: 6 }}>
                  {String(h).padStart(2, "0")}:00
                </div>
                <div style={{ flex: 1, position: "relative" }}>
                  {ev && (
                    <div
                      style={{
                        position: "absolute",
                        inset: "4px 12px",
                        background: tintOf(ev),
                        borderLeft: `3px solid ${colorOf(ev)}`,
                        borderRadius: 8,
                        padding: "10px 14px",
                      }}
                    >
                      <div style={{ fontFamily: "var(--serif)", fontSize: 15 }}>{ev.title}</div>
                      <div className="mono" style={{ fontSize: 11, color: "var(--ink-50)", marginTop: 3 }}>
                        {fmtHM(new Date(ev.starts_at))}
                        {ev.ends_at ? ` — ${fmtHM(new Date(ev.ends_at))}` : ""}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div style={{ borderLeft: "1px solid var(--rule)", padding: "22px 22px", overflow: "auto" }}>
        <div style={{ fontSize: 11, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--ink-50)", marginBottom: 14 }}>
          undated
        </div>
        {undated.length === 0 && (
          <div style={{ color: "var(--ink-35)", fontStyle: "italic", fontFamily: "var(--serif)", fontSize: 13 }}>
            no open todos
          </div>
        )}
        {undated.map((t) => (
          <div
            key={t.id}
            style={{
              padding: "10px 12px",
              border: "1px solid var(--rule)",
              borderRadius: 8,
              marginBottom: 8,
              fontSize: 13,
              color: "var(--ink-70)",
              cursor: "grab",
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <button
              onClick={() => onComplete(t)}
              title="complete"
              style={{
                width: 16,
                height: 16,
                border: "1px solid var(--rule)",
                borderRadius: 8,
                display: "grid",
                placeItems: "center",
                color: "var(--ink-35)",
              }}
            >
              <I.check size={10} />
            </button>
            <span>{t.title}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── AI planner ─────────────────────────────────────────────────────────────

// ─── Suggestions panel — semi-suggestion mode ───────────────────────────────
//
// Calendar stays visible underneath; the panel is a docked drawer on the
// right. Each suggestion is its own card with [Add] / [Edit] / [Skip] —
// Esui chooses what to add. Nothing lands on her calendar without an
// explicit per-item click.

function SuggestionsPanel({ mode, anchor, onClose, onAdded }) {
  const [stage, setStage] = useState("input"); // input -> loading -> review
  const [intent, setIntent] = useState("");
  const [plan, setPlan] = useState(null);
  const [items, setItems] = useState([]);
  const [error, setError] = useState(null);
  const [addedIdx, setAddedIdx] = useState(() => new Set());
  const [skippedIdx, setSkippedIdx] = useState(() => new Set());
  const [editingIdx, setEditingIdx] = useState(null);

  // Esc closes the drawer.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const onAsk = async () => {
    setStage("loading");
    setError(null);
    // Plan against the current week's working hours by default.
    const wkStart = startOfWeek(anchor);
    const dayStart = new Date(wkStart.getFullYear(), wkStart.getMonth(), wkStart.getDate(), 8, 0, 0);
    const dayEnd = addDays(dayStart, 7);
    dayEnd.setHours(22, 0, 0, 0);
    try {
      const resp = await tasksApi.plan({
        intent: intent.trim() || "Look at my upcoming tasks and suggest a balanced week.",
        date_from: dayStart.toISOString(),
        date_to: dayEnd.toISOString(),
        mode,
      });
      setPlan(resp);
      setItems(resp.items || []);
      setAddedIdx(new Set());
      setSkippedIdx(new Set());
      setStage("review");
    } catch (e) {
      setError(e?.message || "failed to think it through");
      setStage("input");
    }
  };

  const addOne = async (i) => {
    const p = items[i];
    try {
      await tasksApi.create({
        kind: p.kind,
        title: p.title,
        description: p.description ?? null,
        starts_at: p.starts_at ?? null,
        ends_at: p.ends_at ?? null,
        all_day: p.all_day ?? false,
        color: p.color ?? null,
      });
      setAddedIdx((prev) => new Set(prev).add(i));
      onAdded?.();
    } catch {
      setError("couldn't add — try again");
    }
  };

  const skipOne = (i) => setSkippedIdx((prev) => new Set(prev).add(i));

  const editTimes = (i, patch) => {
    setItems((arr) => arr.map((it, j) => (j === i ? { ...it, ...patch } : it)));
  };

  const visibleItems = items
    .map((it, i) => ({ it, i }))
    .filter(({ i }) => !skippedIdx.has(i) && !addedIdx.has(i));
  const totalToReview = items.length;
  const reviewedCount = addedIdx.size + skippedIdx.size;

  return (
    <div
      className="fi"
      role="dialog"
      aria-modal="false"
      aria-label="AI suggestions"
      style={{
        position: "absolute",
        top: 0,
        right: 0,
        bottom: 0,
        width: "min(420px, 100%)",
        background: "var(--surface)",
        borderLeft: "1px solid var(--rule)",
        boxShadow: "-12px 0 32px -20px rgba(13,15,23,.18)",
        display: "grid",
        gridTemplateRows: "auto 1fr auto",
        zIndex: 30,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 20px",
          borderBottom: "1px solid var(--rule-soft)",
        }}
      >
        <div>
          <div
            className="mono"
            style={{
              fontSize: 10.5,
              letterSpacing: ".18em",
              textTransform: "uppercase",
              color: "var(--ink-35)",
            }}
          >
            ai · suggestions
          </div>
          <div style={{ fontFamily: "var(--serif)", fontSize: 17, marginTop: 2 }}>
            <em>{stage === "review" ? "review one at a time" : "what's the week shape?"}</em>
          </div>
        </div>
        <button onClick={onClose} className="qbtn">
          <I.close size={14} />
        </button>
      </div>

      <div style={{ overflow: "auto", padding: "16px 20px" }}>
        {stage === "input" && (
          <>
            <textarea
              value={intent}
              onChange={(e) => setIntent(e.target.value)}
              rows={5}
              autoFocus
              placeholder="e.g. need real time for proof writeup, two reading blocks, climbing twice."
              style={{
                width: "100%",
                padding: "12px 14px",
                border: "1px solid var(--rule)",
                borderRadius: "var(--r-md)",
                fontFamily: "var(--serif)",
                fontSize: 15,
                lineHeight: 1.5,
                background: "var(--paper)",
                resize: "vertical",
              }}
            />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12 }}>
              <div className="mono" style={{ fontSize: 11, letterSpacing: ".06em", color: "var(--ink-50)" }}>
                {prettyDate(startOfWeek(anchor))} — week
              </div>
              <ModePill mode={mode} size="xs" />
            </div>
            <div style={{ marginTop: 16, fontFamily: "var(--serif)", fontStyle: "italic", color: "var(--ink-50)", fontSize: 13.5, lineHeight: 1.55 }}>
              I'll suggest items one at a time. Add the ones you want, skip the rest. Nothing lands on your calendar without your tap.
            </div>
            {error && (
              <div style={{ marginTop: 12, color: "var(--rose)", fontSize: 13, fontStyle: "italic" }}>
                {error}
              </div>
            )}
          </>
        )}

        {stage === "loading" && (
          <div style={{ padding: "40px 0", textAlign: "center", display: "grid", gap: 16, justifyItems: "center" }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                border: `1.5px solid ${mode === "ulzii" ? "var(--sky)" : "var(--forest)"}`,
                animation: "pulse 2.2s ease-in-out infinite",
              }}
            />
            <div style={{ fontFamily: "var(--serif)", fontStyle: "italic", color: "var(--ink-70)", fontSize: 14, maxWidth: 320 }}>
              reading your calendar, vault, and recent memory…
            </div>
          </div>
        )}

        {stage === "review" && plan && (
          <>
            {plan.summary && (
              <div
                style={{
                  fontFamily: "var(--serif)",
                  fontSize: 14.5,
                  lineHeight: 1.55,
                  color: "var(--ink-70)",
                  borderLeft: "2px solid var(--rule)",
                  paddingLeft: 12,
                  fontStyle: "italic",
                  marginBottom: 18,
                }}
              >
                {plan.summary}
              </div>
            )}
            {plan.open_questions?.length > 0 && (
              <div style={{ marginBottom: 18 }}>
                <div className="mono" style={{ fontSize: 10, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--ink-50)", marginBottom: 8 }}>
                  open question{plan.open_questions.length > 1 ? "s" : ""}
                </div>
                {plan.open_questions.map((q, i) => (
                  <div
                    key={i}
                    style={{
                      padding: "10px 12px",
                      background: "#f5e9c8",
                      borderRadius: 6,
                      fontFamily: "var(--serif)",
                      fontStyle: "italic",
                      color: "var(--ink-70)",
                      fontSize: 13,
                      marginBottom: 6,
                    }}
                  >
                    {q}
                  </div>
                ))}
              </div>
            )}

            <div
              className="mono"
              style={{ fontSize: 10, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--ink-50)", marginBottom: 10 }}
            >
              {visibleItems.length === 0
                ? totalToReview === 0
                  ? "no items"
                  : `done · ${addedIdx.size} added · ${skippedIdx.size} skipped`
                : `${reviewedCount} of ${totalToReview} reviewed`}
            </div>

            {visibleItems.length === 0 && totalToReview > 0 && (
              <div style={{ fontFamily: "var(--serif)", fontStyle: "italic", color: "var(--ink-50)", fontSize: 14 }}>
                nothing more to review. close this panel or ask for a fresh take.
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {visibleItems.map(({ it: p, i }) => (
                <SuggestionCard
                  key={i}
                  item={p}
                  editing={editingIdx === i}
                  onEdit={() => setEditingIdx(editingIdx === i ? null : i)}
                  onPatch={(patch) => editTimes(i, patch)}
                  onAdd={() => addOne(i)}
                  onSkip={() => skipOne(i)}
                />
              ))}
            </div>
            {error && (
              <div style={{ marginTop: 12, color: "var(--rose)", fontSize: 13, fontStyle: "italic" }}>
                {error}
              </div>
            )}
          </>
        )}
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: 8,
          padding: "12px 20px",
          borderTop: "1px solid var(--rule-soft)",
          background: "var(--surface)",
        }}
      >
        {stage === "input" && (
          <button
            onClick={onAsk}
            disabled={false}
            style={{
              padding: "8px 16px",
              background: "var(--ink)",
              color: "var(--paper)",
              borderRadius: 100,
              fontSize: 13,
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <I.sparkle size={12} /> think it through
          </button>
        )}
        {stage === "review" && (
          <>
            <button onClick={() => setStage("input")} className="qbtn">
              ask again
            </button>
            <button onClick={onClose} className="qbtn">
              done
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function SuggestionCard({ item: p, editing, onEdit, onPatch, onAdd, onSkip }) {
  const [hmStart, setHmStart] = useState(() => isoToHM(p.starts_at));
  const [hmEnd, setHmEnd] = useState(() => isoToHM(p.ends_at));
  const [day, setDay] = useState(() => isoToDate(p.starts_at) || "");

  useEffect(() => {
    setHmStart(isoToHM(p.starts_at));
    setHmEnd(isoToHM(p.ends_at));
    setDay(isoToDate(p.starts_at) || "");
  }, [p.starts_at, p.ends_at]);

  const apply = () => {
    const next = patchItemTimes(p, day, hmStart, hmEnd);
    onPatch(next);
    onEdit();
  };

  return (
    <div
      style={{
        padding: "12px 14px",
        border: "1px solid var(--rule)",
        borderRadius: "var(--r-md)",
        background: "var(--paper)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ width: 8, height: 8, borderRadius: 4, background: p.color || "var(--ink-50)" }} />
        <span style={{ fontFamily: "var(--serif)", fontSize: 15 }}>{p.title}</span>
        <span className="tnum mono" style={{ fontSize: 11, color: "var(--ink-50)", marginLeft: "auto" }}>
          {fmtRange(p.starts_at, p.ends_at)}
        </span>
      </div>
      {p.rationale && (
        <div
          style={{
            marginLeft: 18,
            fontFamily: "var(--serif)",
            fontStyle: "italic",
            color: "var(--ink-50)",
            fontSize: 13,
            marginTop: 4,
            lineHeight: 1.45,
          }}
        >
          {p.rationale}
        </div>
      )}
      {editing && (
        <div style={{ marginTop: 10, padding: "10px 12px", background: "var(--ink-06)", borderRadius: 6, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          <label style={{ fontSize: 11, color: "var(--ink-50)" }}>
            day
            <input type="date" value={day} onChange={(e) => setDay(e.target.value)} style={inputStyle} />
          </label>
          <label style={{ fontSize: 11, color: "var(--ink-50)" }}>
            start
            <input type="time" value={hmStart} onChange={(e) => setHmStart(e.target.value)} style={inputStyle} />
          </label>
          <label style={{ fontSize: 11, color: "var(--ink-50)" }}>
            end
            <input type="time" value={hmEnd} onChange={(e) => setHmEnd(e.target.value)} style={inputStyle} />
          </label>
        </div>
      )}
      <div style={{ display: "flex", gap: 6, marginTop: 10, justifyContent: "flex-end" }}>
        <button onClick={onSkip} className="qbtn" style={miniBtn("var(--ink-50)")}>
          skip
        </button>
        {editing ? (
          <button onClick={apply} className="qbtn" style={miniBtn("var(--ink)")}>
            apply
          </button>
        ) : (
          <button onClick={onEdit} className="qbtn" style={miniBtn("var(--ink)")}>
            edit
          </button>
        )}
        <button
          onClick={onAdd}
          style={{
            padding: "5px 12px",
            background: "var(--ink)",
            color: "var(--paper)",
            borderRadius: 100,
            fontSize: 12,
          }}
        >
          add
        </button>
      </div>
    </div>
  );
}

const inputStyle = {
  display: "block",
  marginTop: 4,
  width: "100%",
  padding: "5px 8px",
  border: "1px solid var(--rule)",
  borderRadius: 4,
  fontSize: 12.5,
  fontFamily: "var(--mono)",
  background: "var(--paper)",
};
const miniBtn = (color) => ({
  padding: "5px 10px",
  border: "1px solid var(--rule)",
  borderRadius: 100,
  fontSize: 12,
  color,
});

function isoToHM(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function isoToDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function patchItemTimes(p, dayStr, startHM, endHM) {
  if (!dayStr || !startHM) return p;
  const [y, mo, d] = dayStr.split("-").map(Number);
  const [sh, sm] = startHM.split(":").map(Number);
  const start = new Date(y, (mo || 1) - 1, d || 1, sh || 0, sm || 0, 0);
  let end = p.ends_at ? new Date(p.ends_at) : null;
  if (endHM) {
    const [eh, em] = endHM.split(":").map(Number);
    end = new Date(y, (mo || 1) - 1, d || 1, eh || 0, em || 0, 0);
    if (end <= start) end.setDate(end.getDate() + 1);
  }
  return {
    ...p,
    starts_at: start.toISOString(),
    ends_at: end ? end.toISOString() : p.ends_at,
  };
}

// ─── helpers ────────────────────────────────────────────────────────────────

function startOfWeek(d) {
  const x = new Date(d);
  const dow = (x.getDay() + 6) % 7; // mon=0
  x.setDate(x.getDate() - dow);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function rangeFor(view, anchor) {
  if (view === "day") {
    const s = new Date(anchor);
    s.setHours(0, 0, 0, 0);
    const e = addDays(s, 1);
    return { from: s, to: e };
  }
  if (view === "month") {
    const s = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const e = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1);
    return { from: s, to: e };
  }
  // week
  const s = startOfWeek(anchor);
  return { from: s, to: addDays(s, 7) };
}

function stepAnchor(anchor, view, dir) {
  if (view === "day") return addDays(anchor, dir);
  if (view === "month") {
    return new Date(anchor.getFullYear(), anchor.getMonth() + dir, 1);
  }
  return addDays(anchor, dir * 7);
}

function titleFor(view, anchor) {
  if (view === "day")
    return (
      <>
        <em>{anchor.toLocaleDateString([], { weekday: "long" })}</em> ·{" "}
        <span className="tnum">
          {anchor.toLocaleDateString([], { month: "short", day: "numeric" })}
        </span>
      </>
    );
  if (view === "month")
    return (
      <>
        <em>{anchor.toLocaleDateString([], { month: "long" })}</em> ·{" "}
        <span className="tnum">{anchor.getFullYear()}</span>
      </>
    );
  const s = startOfWeek(anchor);
  const e = addDays(s, 6);
  const sm = s.toLocaleDateString([], { month: "short" });
  const em = e.toLocaleDateString([], { month: "short" });
  return (
    <>
      <em>this week</em>{" "}
      <span className="tnum">
        ·{" "}
        {sm === em
          ? `${sm} ${s.getDate()} — ${e.getDate()}`
          : `${sm} ${s.getDate()} — ${em} ${e.getDate()}`}
      </span>
    </>
  );
}

function prettyDate(d) {
  return d.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
}

function dayShort(d) {
  return d.toLocaleDateString([], { weekday: "short" }).toLowerCase();
}

function sameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function fmtHM(d) {
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
}

function fmtRange(startISO, endISO) {
  if (!startISO) return "";
  const s = new Date(startISO);
  if (!endISO) return fmtHM(s);
  return `${fmtHM(s)} — ${fmtHM(new Date(endISO))}`;
}

// Pick a colour token from the task's color string or fall back to mode.
function colorOf(t) {
  const c = (t.color || "").toLowerCase();
  if (c.includes("sky")) return "var(--sky)";
  if (c.includes("forest")) return "var(--forest)";
  if (c.includes("rose")) return "var(--rose)";
  if (c.includes("gold") || c.includes("amber") || c.includes("ochre")) return "var(--gold)";
  return "var(--ink-50)";
}

function tintOf(t) {
  const c = (t.color || "").toLowerCase();
  if (c.includes("sky")) return "var(--sky-soft)";
  if (c.includes("forest")) return "var(--forest-soft)";
  if (c.includes("rose")) return "rgba(166,79,99,.10)";
  if (c.includes("gold") || c.includes("amber") || c.includes("ochre")) return "#f4ead9";
  return "var(--ink-06)";
}

export { CalendarView };
