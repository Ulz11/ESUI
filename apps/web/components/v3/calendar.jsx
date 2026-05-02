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
            <I.sparkle size={13} /> plan with ai
          </button>
        </div>
      </div>
      {view === "week" && <WeekGrid tasks={tasks} anchor={anchor} reload={reload} />}
      {view === "month" && <MonthGrid tasks={tasks} anchor={anchor} />}
      {view === "day" && <DayGrid tasks={tasks} anchor={anchor} reload={reload} />}
      {planning && (
        <PlannerModal
          mode={mode}
          anchor={anchor}
          onClose={() => setPlanning(false)}
          onAccepted={() => {
            setPlanning(false);
            reload();
          }}
        />
      )}
    </div>
  );
}

// ─── Week ────────────────────────────────────────────────────────────────────

function WeekGrid({ tasks, anchor }) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(anchor, i));
  const hours = Array.from({ length: 14 }, (_, i) => i + 8); // 8..21
  const today = new Date();

  return (
    <div style={{ overflow: "auto", padding: "0 32px 32px" }}>
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
          const dayTasks = tasks.filter((t) => t.kind === "event" && t.starts_at && sameDay(new Date(t.starts_at), d));
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

function PlannerModal({ mode, anchor, onClose, onAccepted }) {
  const [stage, setStage] = useState("input"); // input -> loading -> review
  const [intent, setIntent] = useState(
    "a deep work day. carve real time for the proof writeup, finish the planner UX, and leave room for reading.",
  );
  const [plan, setPlan] = useState(null);
  const [error, setError] = useState(null);
  const [items, setItems] = useState([]);

  const onPlan = async () => {
    setStage("loading");
    setError(null);
    const dayStart = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate(), 8, 0, 0);
    const dayEnd = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate(), 22, 0, 0);
    try {
      const resp = await tasksApi.plan({
        intent,
        date_from: dayStart.toISOString(),
        date_to: dayEnd.toISOString(),
        mode,
      });
      setPlan(resp);
      setItems(resp.items || []);
      setStage("review");
    } catch (e) {
      setError(e?.message || "failed to plan");
      setStage("input");
    }
  };

  const onAccept = async () => {
    if (items.length === 0) {
      onAccepted();
      return;
    }
    try {
      await tasksApi.bulk(
        items.map((p) => ({
          kind: p.kind,
          title: p.title,
          description: p.description ?? null,
          starts_at: p.starts_at ?? null,
          ends_at: p.ends_at ?? null,
          all_day: p.all_day ?? false,
          color: p.color ?? null,
        })),
      );
      onAccepted();
    } catch {
      setError("could not save — try again");
    }
  };

  return (
    <div
      className="fi"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(13,15,23,.32)",
        backdropFilter: "blur(2px)",
        zIndex: 50,
        display: "grid",
        placeItems: "center",
        padding: 32,
      }}
    >
      <div
        className="fu"
        style={{
          width: "min(820px, 100%)",
          maxHeight: "90vh",
          background: "var(--surface)",
          borderRadius: "var(--r-lg)",
          border: "1px solid var(--rule)",
          boxShadow: "0 30px 80px -20px rgba(13,15,23,.35)",
          overflow: "hidden",
          display: "grid",
          gridTemplateRows: "auto 1fr auto",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "18px 22px",
            borderBottom: "1px solid var(--rule-soft)",
          }}
        >
          <div style={{ fontFamily: "var(--serif)", fontSize: 19 }}>
            <em>plan with ai</em>
          </div>
          <button onClick={onClose} className="qbtn">
            <I.close size={14} />
          </button>
        </div>

        {stage === "input" && (
          <div style={{ padding: "24px 28px", overflow: "auto" }}>
            <div
              style={{
                fontSize: 11,
                letterSpacing: ".14em",
                textTransform: "uppercase",
                color: "var(--ink-50)",
                marginBottom: 8,
              }}
            >
              what would you like to plan?
            </div>
            <textarea
              value={intent}
              onChange={(e) => setIntent(e.target.value)}
              rows={4}
              autoFocus
              style={{
                width: "100%",
                padding: "14px 16px",
                border: "1px solid var(--rule)",
                borderRadius: "var(--r-md)",
                fontFamily: "var(--serif)",
                fontSize: 16,
                lineHeight: 1.5,
              }}
            />
            <div style={{ display: "flex", gap: 24, marginTop: 18, alignItems: "center" }}>
              <div>
                <div
                  className="mono"
                  style={{
                    fontSize: 10,
                    letterSpacing: ".14em",
                    textTransform: "uppercase",
                    color: "var(--ink-50)",
                    marginBottom: 6,
                  }}
                >
                  range
                </div>
                <div style={{ fontFamily: "var(--serif)", fontSize: 15 }}>
                  <em>{prettyDate(anchor)}</em>
                </div>
              </div>
              <div style={{ flex: 1 }} />
              <div>
                <div
                  className="mono"
                  style={{
                    fontSize: 10,
                    letterSpacing: ".14em",
                    textTransform: "uppercase",
                    color: "var(--ink-50)",
                    marginBottom: 6,
                  }}
                >
                  posture
                </div>
                <ModePill mode={mode} />
              </div>
            </div>
            {error && (
              <div style={{ marginTop: 14, color: "var(--rose)", fontSize: 13, fontStyle: "italic" }}>
                {error}
              </div>
            )}
          </div>
        )}

        {stage === "loading" && (
          <div style={{ padding: "60px 28px", textAlign: "center", display: "grid", gap: 18, justifyItems: "center" }}>
            <div
              style={{
                width: 46,
                height: 46,
                borderRadius: 23,
                border: `1.5px solid ${mode === "ulzii" ? "var(--sky)" : "var(--forest)"}`,
                animation: "pulse 2.2s ease-in-out infinite",
              }}
            />
            <div
              style={{
                fontFamily: "var(--serif)",
                fontSize: 18,
                fontStyle: "italic",
                color: "var(--ink-70)",
                maxWidth: 460,
              }}
            >
              opus is reading your vault, calendar, and recent memory…
            </div>
          </div>
        )}

        {stage === "review" && plan && (
          <div style={{ padding: "22px 28px", overflow: "auto" }}>
            {plan.summary && (
              <div
                style={{
                  fontFamily: "var(--serif)",
                  fontSize: 17,
                  lineHeight: 1.55,
                  color: "var(--ink-70)",
                  borderLeft: "2px solid var(--rule)",
                  paddingLeft: 14,
                  fontStyle: "italic",
                }}
              >
                {plan.summary}
              </div>
            )}

            {plan.open_questions?.length > 0 && (
              <>
                <div
                  className="mono"
                  style={{
                    fontSize: 10,
                    letterSpacing: ".14em",
                    textTransform: "uppercase",
                    color: "var(--ink-50)",
                    marginTop: 24,
                    marginBottom: 10,
                  }}
                >
                  open question{plan.open_questions.length > 1 ? "s" : ""}
                </div>
                {plan.open_questions.map((q, i) => (
                  <div
                    key={i}
                    style={{
                      padding: "12px 14px",
                      background: "#f5e9c8",
                      borderRadius: 8,
                      fontFamily: "var(--serif)",
                      fontStyle: "italic",
                      color: "var(--ink-70)",
                      fontSize: 14,
                      marginBottom: 8,
                    }}
                  >
                    {q}
                  </div>
                ))}
              </>
            )}

            <div
              className="mono"
              style={{
                fontSize: 10,
                letterSpacing: ".14em",
                textTransform: "uppercase",
                color: "var(--ink-50)",
                marginTop: 24,
                marginBottom: 10,
              }}
            >
              proposed · {items.length} items
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {items.map((p, i) => (
                <div
                  key={i}
                  style={{
                    padding: "12px 14px",
                    border: "1px solid var(--rule)",
                    borderRadius: "var(--r-md)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 4,
                        background: p.color || "var(--ink-50)",
                      }}
                    />
                    <span style={{ fontFamily: "var(--serif)", fontSize: 15.5 }}>{p.title}</span>
                    <span
                      className="tnum mono"
                      style={{ fontSize: 11, color: "var(--ink-50)", marginLeft: "auto" }}
                    >
                      {fmtRange(p.starts_at, p.ends_at)}
                    </span>
                    <button
                      className="qbtn"
                      title="remove"
                      onClick={() => setItems(items.filter((_, j) => j !== i))}
                    >
                      <I.close size={12} />
                    </button>
                  </div>
                  {p.rationale && (
                    <div
                      style={{
                        marginLeft: 18,
                        fontFamily: "var(--serif)",
                        fontStyle: "italic",
                        color: "var(--ink-50)",
                        fontSize: 13.5,
                        marginTop: 4,
                      }}
                    >
                      {p.rationale}
                    </div>
                  )}
                </div>
              ))}
            </div>
            {error && (
              <div style={{ marginTop: 14, color: "var(--rose)", fontSize: 13, fontStyle: "italic" }}>
                {error}
              </div>
            )}
          </div>
        )}

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
            padding: "14px 22px",
            borderTop: "1px solid var(--rule-soft)",
          }}
        >
          {stage === "input" && (
            <>
              <button onClick={onClose} className="qbtn">
                not now
              </button>
              <button
                onClick={onPlan}
                disabled={!intent.trim()}
                style={{
                  padding: "8px 16px",
                  background: "var(--ink)",
                  color: "var(--paper)",
                  borderRadius: 100,
                  fontSize: 13,
                  opacity: intent.trim() ? 1 : 0.5,
                }}
              >
                think it through
              </button>
            </>
          )}
          {stage === "review" && (
            <>
              <button onClick={onClose} className="qbtn">
                discard
              </button>
              <button onClick={() => setStage("input")} className="qbtn">
                edit
              </button>
              <button
                onClick={onAccept}
                style={{
                  padding: "8px 16px",
                  background: "var(--ink)",
                  color: "var(--paper)",
                  borderRadius: 100,
                  fontSize: 13,
                }}
              >
                accept all
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
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
