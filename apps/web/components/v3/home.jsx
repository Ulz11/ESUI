"use client";

import React, { useContext, useMemo, useState } from "react";
import { ModePill, useNow } from "./atoms";
import { I } from "./icons";
import {
  useBeauty,
  useConversations,
  useMemories,
  useSignals,
  useToday,
  useVault,
} from "@/lib/v3-hooks";

// — Home: click-to-expand bento, calm, library-feel
//   real data (today, threads, vault, beauty, memories, signal) via React context.

const HomeDataCtx = React.createContext({
  today: [],
  threads: [],
  vault: [],
  beauty: [],
  memories: [],
  signal: null,
});
const useHomeData = () => useContext(HomeDataCtx);

function HomeView({ mode, onNav }) {
  const now = useNow();
  const [open, setOpen] = useState(null);

  const todayQ = useToday();
  const threadsQ = useConversations(20);
  const vaultQ = useVault({});
  const beautyQ = useBeauty();
  const memQ = useMemories();
  const sigQ = useSignals();

  const homeData = useMemo(
    () => ({
      today: todayQ.items.map(adaptTask),
      threads: threadsQ.convs.slice(0, 6).map(adaptConv),
      vault: vaultQ.docs.slice(0, 6).map(adaptVault),
      beauty: beautyQ.items.slice(0, 8),
      memories: memQ.items.slice(0, 8).map(adaptMemory),
      signal: sigQ.items[0] ? adaptSignal(sigQ.items[0]) : null,
    }),
    [todayQ.items, threadsQ.convs, vaultQ.docs, beautyQ.items, memQ.items, sigQ.items],
  );

  return (
    <HomeDataCtx.Provider value={homeData}>
      <HomeBody mode={mode} onNav={onNav} now={now} open={open} setOpen={setOpen} />
    </HomeDataCtx.Provider>
  );
}

function HomeBody({ mode, onNav, now, open, setOpen }) {
  const greeting = useMemo(() => {
    const h = now.getHours();
    if (h < 5) return "still up";
    if (h < 12) return "good morning";
    if (h < 17) return "good afternoon";
    if (h < 21) return "good evening";
    return "late evening";
  }, [Math.floor(now.getHours() / 3)]);

  return (
    <div style={{ height: "100%", overflow: "auto" }}>
      <div className="fu" style={{ padding: "40px 56px 64px", maxWidth: 1320, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 24, alignItems: "end", marginBottom: 36 }}>
          <div style={{ minWidth: 0 }}>
            <div className="mono" style={{ fontSize: 11, letterSpacing: ".18em", textTransform: "uppercase", color: "var(--ink-35)", display: "flex", alignItems: "center", gap: 14 }}>
              <span>{now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</span>
              <span style={{ width: 4, height: 4, borderRadius: 2, background: "var(--ink-20)" }} />
              <span className="tnum">{now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
            </div>
            <h1 style={{
              fontFamily: "var(--serif)", fontSize: "clamp(40px, 5.4vw, 64px)",
              lineHeight: 1.05, letterSpacing: "-.02em", margin: "16px 0 0",
              color: "var(--ink)", fontWeight: 500, textWrap: "balance",
            }}>
              <em>{greeting}</em>, Esui.
            </h1>
            <div style={{ marginTop: 14, color: "var(--ink-50)", fontFamily: "var(--serif)", fontSize: 17, fontStyle: "italic", maxWidth: 520 }}>
              a quiet desk — what would you like to begin with?
            </div>
          </div>
          <button
            onClick={() => onNav("chat")}
            style={{
              display: "flex", alignItems: "center", gap: 10, alignSelf: "end",
              padding: "11px 16px 11px 14px",
              background: "var(--ink)", color: "var(--paper)",
              borderRadius: "100px", fontSize: 13, fontWeight: 500,
              boxShadow: "var(--shadow-2)", whiteSpace: "nowrap",
            }}
          >
            <I.sparkle size={14} /> new conversation
            <span className="mono" style={{ fontSize: 10, opacity: .55, marginLeft: 4, padding: "2px 6px", background: "rgba(255,255,255,.12)", borderRadius: 4, letterSpacing: ".06em" }}>⌘ /</span>
          </button>
        </div>

        {/* Bento grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
          <Widget id="today"   open={open} setOpen={setOpen} label="today"             preview={<TodayPreview />}  expand={<TodayExpanded onNav={onNav} />} />
          <Widget id="signal"  open={open} setOpen={setOpen} label="signal · just in"  preview={<SignalPreview />} expand={<SignalExpanded onNav={onNav} />} />
          <Widget id="threads" open={open} setOpen={setOpen} label="recent threads"    preview={<ThreadsPreview />} expand={<ThreadsExpanded onNav={onNav} />} />
          <Widget id="vault"   open={open} setOpen={setOpen} label="vault"             preview={<VaultPreview />}  expand={<VaultExpanded onNav={onNav} />} />
          <Widget id="beauty"  open={open} setOpen={setOpen} label="beauty"            preview={<BeautyPreview />} expand={<BeautyExpanded onNav={onNav} />} mediaTop />
          <Widget id="memory"  open={open} setOpen={setOpen} label="memory · ambient"  preview={<MemoryPreview />} expand={<MemoryExpanded />} />
          <Widget id="modes"   open={open} setOpen={setOpen} label="think with"        preview={<ModesPreview mode={mode} />} expand={<ModesExpanded onNav={onNav} />} />
          <Widget id="exam"    open={open} setOpen={setOpen} label="exam workspace"    preview={<ExamPreview />}   expand={<ExamExpanded onNav={onNav} />} />
        </div>
      </div>
    </div>
  );
}

// — Generic click-to-expand widget shell ——————————————————————————————————

function Widget({ id, label, preview, expand, open, setOpen, mediaTop }) {
  const isOpen = open === id;
  return (
    <div
      onClick={() => setOpen(isOpen ? null : id)}
      className={"card card-clickable" + (mediaTop ? " card-media" : "")}
      style={{
        gridColumn: isOpen ? "1 / -1" : "auto",
        gridRow: isOpen ? "span 2" : "span 1",
        padding: mediaTop ? 0 : "20px 22px",
        display: "flex", flexDirection: "column",
        position: "relative",
        cursor: "pointer",
        outline: isOpen ? "1px solid var(--ink)" : "none",
      }}
    >
      {!mediaTop && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div className="mono" style={{ fontSize: 13, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--ink)", fontWeight: 700 }}>{label}</div>
          <button onClick={(e) => { e.stopPropagation(); setOpen(isOpen ? null : id); }} className="qbtn"
            style={{ padding: "3px 8px", border: "1px solid var(--rule)", borderRadius: 100, fontSize: 10.5, color: "var(--ink-50)" }}>
            {isOpen ? "close" : "open"}
          </button>
        </div>
      )}
      <div style={{ minHeight: 0 }}>
        {isOpen ? <div className="fi" onClick={(e) => e.stopPropagation()}>{expand}</div> : preview}
      </div>
    </div>
  );
}

// — Today —————————————————————————————————————————————————————————————

function TodayPreview() {
  const { today } = useHomeData();
  if (!today.length) return <EmptyMicro line="no plans yet — open calendar to add one." />;
  const next = today.find((t) => !t.done) || today[today.length - 1];
  const done = today.filter((t) => t.done).length;
  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
        <div className="tnum mono" style={{ fontSize: 34, color: "var(--ink)", fontWeight: 500, letterSpacing: "-.01em" }}>{next.time}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "var(--serif)", fontSize: 18, color: "var(--ink)", fontStyle: "italic" }}>{next.label}</div>
          <div className="mono" style={{ fontSize: 11, color: "var(--ink-35)", marginTop: 3 }}>next · {done} of {today.length} done today</div>
        </div>
      </div>
      <div style={{ marginTop: 16, display: "flex", gap: 6 }}>
        {today.map((t, i) => (
          <span key={i} style={{
            flex: 1, height: 4, borderRadius: 2,
            background: t.done ? "var(--ink-50)" : "var(--ink-10)",
          }} />
        ))}
      </div>
    </div>
  );
}
function TodayExpanded({ onNav }) {
  const { today } = useHomeData();
  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ fontFamily: "var(--serif)", fontSize: 22, color: "var(--ink)" }}><em>today</em></div>
        <button onClick={() => onNav("calendar")} className="qbtn">open calendar →</button>
      </div>
      {today.length === 0 ? (
        <EmptyMicro line="no plans yet — Plan-with-AI is one click away on the calendar." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {today.map((t, i) => (
            <div key={i} className="row-hover" style={{ display: "grid", gridTemplateColumns: "56px 12px 1fr auto", alignItems: "center", padding: "9px 8px", borderRadius: 6 }}>
              <span className="tnum mono" style={{ fontSize: 12, color: "var(--ink-50)" }}>{t.time}</span>
              <span style={{ width: 6, height: 6, borderRadius: 3, background: t.color || "var(--ink-20)" }} />
              <span style={{ fontSize: 14, color: t.done ? "var(--ink-35)" : "var(--ink)", textDecoration: t.done ? "line-through" : "none" }}>{t.label}</span>
              <span className="mono" style={{ fontSize: 10.5, color: "var(--ink-35)" }}>{t.tag}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// — Signal ————————————————————————————————————————————————————————————

function SignalPreview() {
  const { signal } = useHomeData();
  if (!signal) return <EmptyMicro line="signals are quiet just now — check back soon." />;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ fontFamily: "var(--serif)", fontSize: 20, lineHeight: 1.35, color: "var(--ink)", letterSpacing: "-.005em" }}>
        <em>“{signal.text}”</em>
      </div>
      <div style={{ fontSize: 12, color: "var(--ink-50)", fontFamily: "var(--serif)", fontStyle: "italic" }}>
        {signal.attribution}
      </div>
    </div>
  );
}
function SignalExpanded({ onNav }) {
  const { signal } = useHomeData();
  if (!signal) return <EmptyMicro line="no signal in rotation yet — the curator runs hourly." />;
  return (
    <div>
      <div className="mono" style={{ fontSize: 10.5, letterSpacing: ".18em", textTransform: "uppercase", color: "var(--rose)", marginBottom: 12 }}>{signal.categoryLabel}</div>
      <div style={{ fontFamily: "var(--serif)", fontSize: 30, lineHeight: 1.3, color: "var(--ink)", letterSpacing: "-.01em" }}>
        <em>“{signal.text}”</em>
      </div>
      <div style={{ marginTop: 18, fontFamily: "var(--serif)", fontStyle: "italic", color: "var(--ink-50)", fontSize: 15 }}>
        {signal.attribution}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 24 }}>
        <button onClick={() => onNav("signals")} className="qbtn" style={{ padding: "6px 10px", border: "1px solid var(--rule)", borderRadius: 100 }}>open daily signals</button>
      </div>
    </div>
  );
}

// — Recent threads ————————————————————————————————————————————————————

function ThreadsPreview() {
  const { threads } = useHomeData();
  if (!threads.length) return <EmptyMicro line="no threads yet — start a conversation." />;
  const t = threads[0];
  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <ModePill mode={t.mode} size="xs" />
        <span className="mono" style={{ fontSize: 10.5, color: "var(--ink-35)", marginLeft: "auto" }}>{t.ago}</span>
      </div>
      <div style={{ marginTop: 10, fontFamily: "var(--serif)", fontSize: 17, lineHeight: 1.35, color: "var(--ink)" }}>{t.title}</div>
      {threads.length > 1 && (
        <div className="mono" style={{ fontSize: 11, color: "var(--ink-50)", marginTop: 10 }}>{threads.length - 1} more thread{threads.length - 1 === 1 ? "" : "s"}…</div>
      )}
    </div>
  );
}
function ThreadsExpanded({ onNav }) {
  const { threads } = useHomeData();
  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ fontFamily: "var(--serif)", fontSize: 20 }}><em>recent threads</em></div>
        <button onClick={() => onNav("chat")} className="qbtn">open chat →</button>
      </div>
      {threads.length === 0 ? (
        <EmptyMicro line="no threads yet." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {threads.map((t, i) => (
            <div key={t.id || i} className="row-hover" style={{ padding: "10px 6px", borderTop: i === 0 ? "none" : "1px solid var(--rule-soft)", display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 12, alignItems: "baseline", borderRadius: 4 }}>
              <ModePill mode={t.mode} size="xs" />
              <span style={{ fontSize: 13.5, color: "var(--ink)" }}>{t.title}</span>
              <span className="mono" style={{ fontSize: 11, color: "var(--ink-35)" }}>{t.ago}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// — Vault preview ——————————————————————————————————————————————————————

function VaultPreview() {
  const { vault } = useHomeData();
  if (!vault.length) return <EmptyMicro line="vault is empty — capture an idea or save an artifact." />;
  const d = vault[0];
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span className="chip" style={{ background: "transparent", border: "1px solid var(--rule)" }}>{d.type}</span>
        <span className="mono" style={{ fontSize: 10.5, color: "var(--ink-35)", marginLeft: "auto" }}>{d.ago}</span>
      </div>
      <div style={{ fontFamily: "var(--serif)", fontSize: 17, color: "var(--ink)", marginTop: 10, lineHeight: 1.35 }}>{d.title}</div>
      <div className="mono" style={{ fontSize: 11, color: "var(--ink-50)", marginTop: 10 }}>{vault.length} recent · graph available</div>
    </div>
  );
}
function VaultExpanded({ onNav }) {
  const { vault } = useHomeData();
  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ fontFamily: "var(--serif)", fontSize: 20 }}><em>vault</em></div>
        <button onClick={() => onNav("vault")} className="qbtn">open vault →</button>
      </div>
      {vault.length === 0 ? (
        <EmptyMicro line="vault is empty." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {vault.map((d, i) => (
            <div key={d.id || i} className="row-hover" style={{ padding: "10px 6px", borderTop: i === 0 ? "none" : "1px solid var(--rule-soft)", borderRadius: 4 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className="chip" style={{ background: "transparent", border: "1px solid var(--rule)" }}>{d.type}</span>
                <span className="mono" style={{ fontSize: 10.5, color: "var(--ink-35)", marginLeft: "auto" }}>{d.ago}</span>
              </div>
              <div style={{ fontSize: 13.5, color: "var(--ink)", marginTop: 6 }}>{d.title}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// — Beauty (media-top) ————————————————————————————————————————————————

function BeautyPreview() {
  const { beauty } = useHomeData();
  const tiles = beauty.slice(0, 3);
  if (!tiles.length) {
    return (
      <div style={{ position: "relative", height: "100%", minHeight: 160, padding: "20px 22px" }}>
        <div className="mono" style={{ fontSize: 13, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--ink)", fontWeight: 700 }}>beauty</div>
        <EmptyMicro line="drop a photo to begin." />
      </div>
    );
  }
  return (
    <div style={{ position: "relative", height: "100%", minHeight: 160 }}>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gridTemplateRows: "1fr 1fr", height: "100%", gap: 1, background: "var(--rule)" }}>
        {tiles.map((b, i) => (
          <BeautyTile
            key={b.id || i}
            media={b}
            style={{ gridColumn: i === 0 ? "1" : "2", gridRow: i === 0 ? "1 / span 2" : (i === 1 ? "1" : "2") }}
          />
        ))}
      </div>
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,.5), transparent 40%)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", left: 18, bottom: 14, color: "#fbf8f1" }}>
        <div className="mono" style={{ fontSize: 13, letterSpacing: ".14em", textTransform: "uppercase", opacity: .95, fontWeight: 700 }}>beauty</div>
        <div style={{ fontFamily: "var(--serif)", fontSize: 18, marginTop: 2 }}><em>this week</em></div>
      </div>
      <div style={{ position: "absolute", top: 14, right: 14, padding: "4px 9px", borderRadius: 100, background: "rgba(0,0,0,.4)", color: "#fbf8f1", fontFamily: "var(--mono)", fontSize: 10.5, letterSpacing: ".06em" }}>{beauty.length} recent</div>
    </div>
  );
}
function BeautyExpanded({ onNav }) {
  const { beauty } = useHomeData();
  return (
    <div style={{ padding: "20px 22px" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ fontFamily: "var(--serif)", fontSize: 20 }}><em>beauty · this week</em></div>
        <button onClick={() => onNav("beauty")} className="qbtn">open wall →</button>
      </div>
      {beauty.length === 0 ? (
        <EmptyMicro line="no photos yet — drop one onto the beauty wall." />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
          {beauty.map((b, i) => (
            <BeautyTile key={b.id || i} media={b} style={{ aspectRatio: "1", borderRadius: 6 }} />
          ))}
        </div>
      )}
    </div>
  );
}

function BeautyTile({ media, style }) {
  const url = media?.url || "";
  const bg = url ? `center/cover no-repeat url(${JSON.stringify(url)})` : "linear-gradient(135deg,#d3c5a8,#5e553f)";
  return <div style={{ background: bg, ...style }} />;
}

// — Memory ——————————————————————————————————————————————————————————————

function MemoryPreview() {
  const { memories } = useHomeData();
  if (!memories.length) {
    return (
      <div>
        <div style={{ fontFamily: "var(--serif)", fontStyle: "italic", color: "var(--ink-50)", fontSize: 15, lineHeight: 1.5 }}>
          memory will fill in as we talk.
        </div>
      </div>
    );
  }
  const top = memories.slice(0, 1)[0];
  return (
    <div>
      <div style={{ fontFamily: "var(--serif)", fontStyle: "italic", color: "var(--ink-70)", fontSize: 15, lineHeight: 1.5 }}>
        {top.text}
      </div>
      <div style={{ marginTop: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span className="mono" style={{ fontSize: 11, color: "var(--ink-35)" }}>{memories.length} memories</span>
        <span style={{ display: "flex", gap: 5 }}>
          {memories.slice(0, 6).map((_, i) => (
            <span key={i} style={{ width: 6, height: 6, borderRadius: 3, background: "var(--ink-20)", opacity: 1 - i * 0.13 }} />
          ))}
        </span>
      </div>
    </div>
  );
}
function MemoryExpanded() {
  const { memories } = useHomeData();
  return (
    <div>
      <div style={{ fontFamily: "var(--serif)", fontSize: 20, marginBottom: 14 }}><em>memory · ambient</em></div>
      {memories.length === 0 ? (
        <EmptyMicro line="memory is quiet — Esui hasn't shaped one yet." />
      ) : (
        <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 10 }}>
          {memories.map((m, i) => (
            <li key={m.id || i} className="row-hover" style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 14, padding: "6px 4px", borderRadius: 4 }}>
              <span className="mono" style={{ fontSize: 10.5, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--ink-50)" }}>{m.category}</span>
              <span style={{ fontFamily: "var(--serif)", fontSize: 14, color: "var(--ink)", lineHeight: 1.5 }}>{m.text}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// — Modes ——————————————————————————————————————————————————————————————

function ModesPreview({ mode }) {
  return (
    <div>
      <div style={{ display: "flex", gap: 18 }}>
        <ModeMini k="ulzii" active={mode === "ulzii"} />
        <ModeMini k="obama" active={mode === "obama"} />
      </div>
      <div className="mono" style={{ fontSize: 11, color: "var(--ink-50)", marginTop: 14 }}>active · {mode === "ulzii" ? "Ulzii" : "Obama"}</div>
    </div>
  );
}
function ModeMini({ k, active }) {
  const isU = k === "ulzii";
  const c = isU ? "var(--sky)" : "var(--forest)";
  return (
    <div style={{ flex: 1, opacity: active ? 1 : .55 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ width: 8, height: 8, borderRadius: 4, background: c }} />
        <span className="mono" style={{ fontSize: 10.5, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--ink-50)" }}>{isU ? "ulzii" : "obama"}</span>
      </div>
      <div style={{ fontFamily: "var(--serif)", fontStyle: "italic", color: "var(--ink-70)", fontSize: 14, marginTop: 6 }}>
        {isU ? "tok · teacher" : "tech · founder"}
      </div>
    </div>
  );
}
function ModesExpanded({ onNav }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
      {["ulzii", "obama"].map((m) => {
        const isU = m === "ulzii";
        const c = isU ? "var(--sky)" : "var(--forest)";
        const sf = isU ? "var(--sky-soft)" : "var(--forest-soft)";
        return (
          <button key={m} onClick={() => onNav("chat")} style={{
            textAlign: "left", padding: "16px 16px 18px", borderRadius: "var(--r-md)",
            background: "transparent", border: "1px solid var(--rule)",
          }}
            onMouseEnter={(e) => { e.currentTarget.style.background = sf; e.currentTarget.style.borderColor = c; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "var(--rule)"; }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: 4, background: c }} />
              <span className="mono" style={{ fontSize: 10.5, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--ink-50)" }}>
                {isU ? "ulzii · tok / teacher" : "obama · tech / founder"}
              </span>
            </div>
            <div style={{ fontFamily: "var(--serif)", fontSize: 18, marginTop: 10, color: "var(--ink)", lineHeight: 1.3 }}>
              <em>{isU ? "what would you like to understand?" : "what are we shipping?"}</em>
            </div>
          </button>
        );
      })}
    </div>
  );
}

// — Exam preview ——————————————————————————————————————————————————————

function ExamPreview() {
  // No global "progress" exists at this level — exam state is per-workspace.
  // The doorway preview just shows what's available behind it.
  return (
    <div>
      <div style={{ fontFamily: "var(--serif)", fontSize: 17, color: "var(--ink)" }}>open a workspace</div>
      <div style={{ display: "flex", gap: 10, marginTop: 10, alignItems: "baseline" }}>
        <I.exam size={18} />
        <div className="mono" style={{ fontSize: 10.5, color: "var(--ink-50)" }}>
          summary · flashcards · cheatsheet · practice · graph
        </div>
      </div>
      <div style={{ marginTop: 12, fontFamily: "var(--serif)", fontStyle: "italic", color: "var(--ink-50)", fontSize: 13 }}>
        drop notes, get flip-cards.
      </div>
    </div>
  );
}
function ExamExpanded({ onNav }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ fontFamily: "var(--serif)", fontSize: 20 }}><em>exam workspace</em></div>
        <button onClick={() => onNav("exam")} className="qbtn">open workspace →</button>
      </div>
      <div className="mono" style={{ fontSize: 11, color: "var(--ink-50)", marginBottom: 10 }}>create a workspace per subject — generate artifacts on demand</div>
      <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
        {[
          ["summary", "narrative pass through the material"],
          ["cheatsheet", "compressed for the day before"],
          ["graph", "knowledge map · click to expand"],
          ["practice", "problems with worked solutions"],
          ["sim", "ten questions, your timing"],
        ].map(([k, t]) => (
          <li key={k} className="row-hover" style={{ display: "grid", gridTemplateColumns: "100px 1fr", padding: "7px 4px", borderRadius: 4 }}>
            <span className="mono" style={{ fontSize: 11, color: "var(--ink-50)" }}>{k}</span>
            <span style={{ fontSize: 13.5, color: "var(--ink)", fontFamily: "var(--serif)", fontStyle: "italic" }}>{t}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// — Empty micro ————————————————————————————————————————————————————————

function EmptyMicro({ line }) {
  return (
    <div style={{ fontFamily: "var(--serif)", fontStyle: "italic", color: "var(--ink-50)", fontSize: 14, lineHeight: 1.5 }}>
      {line}
    </div>
  );
}

// — Adapters ———————————————————————————————————————————————————————————

const KIND_COLOR = {
  ritual: "var(--amber)",
  focus: "var(--forest)",
  social: "var(--rose)",
  study: "var(--sky)",
  body: "var(--ink-20)",
};

function adaptTask(t) {
  const planned = t.starts_at ? new Date(t.starts_at) : null;
  const time = planned && !t.all_day
    ? planned.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })
    : (t.all_day ? "all day" : "any");
  const tag = t.kind || "task";
  return {
    id: t.id,
    time,
    label: t.title || "untitled",
    done: !!t.completed_at || t.status === "done",
    tag,
    color: t.color || KIND_COLOR[tag] || (t.kind === "event" ? "var(--sky)" : "var(--ink-20)"),
  };
}

function adaptConv(c) {
  const meta = (c.pinned_context || "").toLowerCase();
  const mode = meta.includes("obama") ? "obama" : "ulzii";
  return {
    id: c.id,
    mode,
    title: c.title || "untitled thread",
    ago: humanizeAgo(c.updated_at || c.created_at),
  };
}

function adaptVault(d) {
  const ct = d.content_type || "note";
  const display = ct === "chat_history" ? "chat" : ct === "project_artifact" ? "artifact" : ct;
  return {
    id: d.id,
    type: display,
    title: d.title || "untitled",
    ago: humanizeAgo(d.updated_at || d.created_at),
  };
}

function adaptMemory(m) {
  return {
    id: m.id,
    category: (m.category || "context").replace(/_/g, " "),
    text: m.text || "",
  };
}

const SIGNAL_LABEL = {
  chinese_philosophy: "chinese philosophy",
  arabic_philosophy: "arabic philosophy",
  francis_su: "mathematics for human flourishing",
  inspiration: "inspiration",
};
function adaptSignal(q) {
  const source = q.source_name || "";
  const title = q.title || "";
  let attribution = "";
  if (title && source) attribution = `— ${title} · ${source}`;
  else if (title) attribution = `— ${title}`;
  else if (source) attribution = `— ${source}`;
  return {
    id: q.id,
    text: q.body || "",
    attribution,
    categoryLabel: SIGNAL_LABEL[q.category] || q.category || "signal",
  };
}

function humanizeAgo(iso) {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "—";
  const diff = Date.now() - t;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d === 1) return "yest";
  if (d < 7) return `${d}d`;
  const w = Math.floor(d / 7);
  if (w < 5) return `${w}w`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export { HomeView };
