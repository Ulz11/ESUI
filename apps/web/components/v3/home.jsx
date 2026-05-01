"use client";

import React, { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Avatar, Cursor, Empty, GhostBtn, ModePill, ProviderChip, Rule, SectionTitle, Skel, Surface, Tag, useNow } from "./atoms";
import { I } from "./icons";

// — Home: click-to-expand bento, calm, library-feel

function HomeView({ mode, onNav }) {
  const now = useNow();
  const [open, setOpen] = useState(null); // widget key, null when closed
  const greeting = useMemo(() => {
    const h = now.getHours();
    if (h < 5) return "still up";
    if (h < 12) return "good morning";
    if (h < 17) return "good afternoon";
    if (h < 21) return "good evening";
    return "late evening";
  }, [Math.floor(now.getHours()/3)]);

  const accent = mode === "ulzii" ? "var(--sky)" : "var(--forest)";

  return (
    <div style={{ height:"100%", overflow:"auto" }}>
      <div className="fu" style={{ padding:"40px 56px 64px", maxWidth: 1320, margin:"0 auto" }}>
        {/* Header */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr auto", gap:24, alignItems:"end", marginBottom:36 }}>
          <div style={{ minWidth:0 }}>
            <div className="mono" style={{ fontSize:11, letterSpacing:".18em", textTransform:"uppercase", color:"var(--ink-35)", display:"flex", alignItems:"center", gap:14 }}>
              <span>{now.toLocaleDateString(undefined,{ weekday:"long", month:"long", day:"numeric" })}</span>
              <span style={{ width:4, height:4, borderRadius:2, background:"var(--ink-20)" }}/>
              <span className="tnum">{now.toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" })}</span>
            </div>
            <h1 style={{
              fontFamily:"var(--serif)", fontSize:"clamp(40px, 5.4vw, 64px)",
              lineHeight:1.05, letterSpacing:"-.02em", margin:"16px 0 0",
              color:"var(--ink)", fontWeight:500, textWrap:"balance",
            }}>
              <em>{greeting}</em>, Esui.
            </h1>
            <div style={{ marginTop:14, color:"var(--ink-50)", fontFamily:"var(--serif)", fontSize:17, fontStyle:"italic", maxWidth:520 }}>
              a quiet desk — what would you like to begin with?
            </div>
          </div>
          <button
            onClick={() => onNav("chat")}
            style={{
              display:"flex", alignItems:"center", gap:10, alignSelf:"end",
              padding:"11px 16px 11px 14px",
              background:"var(--ink)", color:"var(--paper)",
              borderRadius:"100px", fontSize:13, fontWeight:500,
              boxShadow:"var(--shadow-2)", whiteSpace:"nowrap",
            }}
          >
            <I.sparkle size={14}/> new conversation
            <span className="mono" style={{ fontSize:10, opacity:.55, marginLeft:4, padding:"2px 6px", background:"rgba(255,255,255,.12)", borderRadius:4, letterSpacing:".06em" }}>⌘ /</span>
          </button>
        </div>

        {/* Bento grid */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(280px, 1fr))", gap:16 }}>

          <Widget
            id="today" k="today"
            open={open} setOpen={setOpen}
            span="span 3"
            label="today"
            preview={<TodayPreview/>}
            expand={<TodayExpanded onNav={onNav}/>}
          />

          <Widget
            id="signal" k="signal"
            open={open} setOpen={setOpen}
            span="span 3"
            label="signal · just in"
            preview={<SignalPreview/>}
            expand={<SignalExpanded onNav={onNav}/>}
          />

          <Widget
            id="threads" k="threads"
            open={open} setOpen={setOpen}
            span="span 2"
            label="recent threads"
            preview={<ThreadsPreview/>}
            expand={<ThreadsExpanded onNav={onNav}/>}
          />

          <Widget
            id="vault" k="vault"
            open={open} setOpen={setOpen}
            span="span 2"
            label="vault"
            preview={<VaultPreview/>}
            expand={<VaultExpanded onNav={onNav}/>}
          />

          <Widget
            id="beauty" k="beauty"
            open={open} setOpen={setOpen}
            span="span 2"
            label="beauty"
            preview={<BeautyPreview/>}
            expand={<BeautyExpanded onNav={onNav}/>}
            mediaTop
          />

          <Widget
            id="memory" k="memory"
            open={open} setOpen={setOpen}
            span="span 2"
            label="memory · ambient"
            preview={<MemoryPreview/>}
            expand={<MemoryExpanded/>}
          />

          <Widget
            id="modes" k="modes"
            open={open} setOpen={setOpen}
            span="span 2"
            label="think with"
            preview={<ModesPreview mode={mode}/>}
            expand={<ModesExpanded onNav={onNav}/>}
          />

          <Widget
            id="exam" k="exam"
            open={open} setOpen={setOpen}
            span="span 2"
            label="exam workspace"
            preview={<ExamPreview/>}
            expand={<ExamExpanded onNav={onNav}/>}
          />

        </div>
      </div>
    </div>
  );
}

// — Generic click-to-expand widget shell ——————————————————————————————————

function Widget({ id, span, label, preview, expand, open, setOpen, mediaTop }) {
  const isOpen = open === id;
  return (
    <div
      onClick={() => setOpen(isOpen ? null : id)}
      className={"card card-clickable" + (mediaTop ? " card-media" : "")}
      style={{
        gridColumn: isOpen ? "1 / -1" : "auto",
        gridRow: isOpen ? "span 2" : "span 1",
        padding: mediaTop ? 0 : "20px 22px",
        display:"flex", flexDirection:"column",
        position:"relative",
        cursor:"pointer",
        outline: isOpen ? "1px solid var(--ink)" : "none",
      }}
    >
      {!mediaTop && (
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
          <div className="mono" style={{ fontSize:13, letterSpacing:".14em", textTransform:"uppercase", color:"var(--ink)", fontWeight:700 }}>{label}</div>
          <button onClick={(e) => { e.stopPropagation(); setOpen(isOpen ? null : id); }} className="qbtn"
            style={{ padding:"3px 8px", border:"1px solid var(--rule)", borderRadius:100, fontSize:10.5, color:"var(--ink-50)" }}>
            {isOpen ? "close" : "open"}
          </button>
        </div>
      )}
      <div style={{ minHeight:0 }}>
        {isOpen ? <div className="fi" onClick={(e) => e.stopPropagation()}>{expand}</div> : preview}
      </div>
    </div>
  );
}

// — Today —————————————————————————————————————————————————————————————

function TodayPreview() {
  const next = TODAY.find(t => !t.done) || TODAY[TODAY.length - 1];
  const done = TODAY.filter(t => t.done).length;
  return (
    <div>
      <div style={{ display:"flex", alignItems:"baseline", gap:14 }}>
        <div className="tnum mono" style={{ fontSize:34, color:"var(--ink)", fontWeight:500, letterSpacing:"-.01em" }}>{next.time}</div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontFamily:"var(--serif)", fontSize:18, color:"var(--ink)", fontStyle:"italic" }}>{next.label}</div>
          <div className="mono" style={{ fontSize:11, color:"var(--ink-35)", marginTop:3 }}>next · {done} of {TODAY.length} done today</div>
        </div>
      </div>
      <div style={{ marginTop:16, display:"flex", gap:6 }}>
        {TODAY.map((t, i) => (
          <span key={i} style={{
            flex:1, height:4, borderRadius:2,
            background: t.done ? "var(--ink-50)" : "var(--ink-10)",
          }}/>
        ))}
      </div>
    </div>
  );
}
function TodayExpanded({ onNav }) {
  return (
    <div>
      <div style={{ display:"flex", alignItems:"baseline", justifyContent:"space-between", marginBottom:16 }}>
        <div style={{ fontFamily:"var(--serif)", fontSize:22, color:"var(--ink)" }}><em>today</em></div>
        <button onClick={() => onNav("calendar")} className="qbtn">open calendar →</button>
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:2 }}>
        {TODAY.map((t, i) => (
          <div key={i} className="row-hover" style={{ display:"grid", gridTemplateColumns:"56px 12px 1fr auto", alignItems:"center", padding:"9px 8px", borderRadius:6 }}>
            <span className="tnum mono" style={{ fontSize:12, color:"var(--ink-50)" }}>{t.time}</span>
            <span style={{ width:6, height:6, borderRadius:3, background: t.color || "var(--ink-20)" }}/>
            <span style={{ fontSize:14, color: t.done ? "var(--ink-35)" : "var(--ink)", textDecoration: t.done ? "line-through" : "none" }}>{t.label}</span>
            <span className="mono" style={{ fontSize:10.5, color:"var(--ink-35)" }}>{t.tag}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// — Signal ————————————————————————————————————————————————————————————

function SignalPreview() {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
      <div style={{ fontFamily:"var(--serif)", fontSize:20, lineHeight:1.35, color:"var(--ink)", letterSpacing:"-.005em" }}>
        <em>“The journey of a thousand </em>li<em> begins beneath one's feet.”</em>
      </div>
      <div style={{ fontSize:12, color:"var(--ink-50)", fontFamily:"var(--serif)", fontStyle:"italic" }}>
        — Laozi · <span style={{ fontStyle:"normal" }}>Tao Te Ching</span>, 64
      </div>
    </div>
  );
}
function SignalExpanded({ onNav }) {
  return (
    <div>
      <div className="mono" style={{ fontSize:10.5, letterSpacing:".18em", textTransform:"uppercase", color:"var(--rose)", marginBottom:12 }}>chinese philosophy</div>
      <div style={{ fontFamily:"var(--serif)", fontSize:30, lineHeight:1.3, color:"var(--ink)", letterSpacing:"-.01em" }}>
        <em>“The journey of a thousand </em>li<em> begins beneath one's feet.”</em>
      </div>
      <div style={{ marginTop:18, fontFamily:"var(--serif)", fontStyle:"italic", color:"var(--ink-50)", fontSize:15 }}>
        — Laozi · Tao Te Ching, 64
      </div>
      <div style={{ display:"flex", gap:8, marginTop:24 }}>
        <button onClick={() => onNav("signals")} className="qbtn" style={{ padding:"6px 10px", border:"1px solid var(--rule)", borderRadius:100 }}>open daily signals</button>
        <button className="qbtn" style={{ padding:"6px 10px", border:"1px solid var(--rule)", borderRadius:100 }}><I.pin size={12}/> pin to vault</button>
      </div>
    </div>
  );
}

// — Recent threads ————————————————————————————————————————————————————

function ThreadsPreview() {
  const t = RECENT_THREADS[0];
  return (
    <div>
      <div style={{ display:"flex", alignItems:"baseline", gap:8 }}>
        <ModePill mode={t.mode} size="xs"/>
        <span className="mono" style={{ fontSize:10.5, color:"var(--ink-35)", marginLeft:"auto" }}>{t.ago}</span>
      </div>
      <div style={{ marginTop:10, fontFamily:"var(--serif)", fontSize:17, lineHeight:1.35, color:"var(--ink)" }}>{t.title}</div>
      <div className="mono" style={{ fontSize:11, color:"var(--ink-50)", marginTop:10 }}>{RECENT_THREADS.length - 1} more threads…</div>
    </div>
  );
}
function ThreadsExpanded({ onNav }) {
  return (
    <div>
      <div style={{ display:"flex", alignItems:"baseline", justifyContent:"space-between", marginBottom:14 }}>
        <div style={{ fontFamily:"var(--serif)", fontSize:20 }}><em>recent threads</em></div>
        <button onClick={() => onNav("chat")} className="qbtn">open chat →</button>
      </div>
      <div style={{ display:"flex", flexDirection:"column" }}>
        {RECENT_THREADS.map((t, i) => (
          <div key={i} className="row-hover" style={{ padding:"10px 6px", borderTop: i === 0 ? "none" : "1px solid var(--rule-soft)", display:"grid", gridTemplateColumns:"auto 1fr auto", gap:12, alignItems:"baseline", borderRadius:4 }}>
            <ModePill mode={t.mode} size="xs"/>
            <span style={{ fontSize:13.5, color:"var(--ink)" }}>{t.title}</span>
            <span className="mono" style={{ fontSize:11, color:"var(--ink-35)" }}>{t.ago}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// — Vault preview ——————————————————————————————————————————————————————

function VaultPreview() {
  const d = RECENT_VAULT[0];
  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
        <span className="chip" style={{ background:"transparent", border:"1px solid var(--rule)" }}>{d.type}</span>
        <span className="mono" style={{ fontSize:10.5, color:"var(--ink-35)", marginLeft:"auto" }}>{d.ago}</span>
      </div>
      <div style={{ fontFamily:"var(--serif)", fontSize:17, color:"var(--ink)", marginTop:10, lineHeight:1.35 }}>{d.title}</div>
      <div className="mono" style={{ fontSize:11, color:"var(--ink-50)", marginTop:10 }}>156 items · graph available</div>
    </div>
  );
}
function VaultExpanded({ onNav }) {
  return (
    <div>
      <div style={{ display:"flex", alignItems:"baseline", justifyContent:"space-between", marginBottom:14 }}>
        <div style={{ fontFamily:"var(--serif)", fontSize:20 }}><em>vault</em></div>
        <button onClick={() => onNav("vault")} className="qbtn">open vault →</button>
      </div>
      <div style={{ display:"flex", flexDirection:"column" }}>
        {RECENT_VAULT.map((d, i) => (
          <div key={i} className="row-hover" style={{ padding:"10px 6px", borderTop: i === 0 ? "none" : "1px solid var(--rule-soft)", borderRadius:4 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <span className="chip" style={{ background:"transparent", border:"1px solid var(--rule)" }}>{d.type}</span>
              <span className="mono" style={{ fontSize:10.5, color:"var(--ink-35)", marginLeft:"auto" }}>{d.ago}</span>
            </div>
            <div style={{ fontSize:13.5, color:"var(--ink)", marginTop:6 }}>{d.title}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// — Beauty (media-top) ————————————————————————————————————————————————

function BeautyPreview() {
  return (
    <div style={{ position:"relative", height:"100%", minHeight:160 }}>
      <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr", gridTemplateRows:"1fr 1fr", height:"100%", gap:1, background:"var(--rule)" }}>
        {BEAUTY_THUMBS.map((b, i) => (
          <div key={i} style={{ background: b, gridColumn: i===0 ? "1" : "2", gridRow: i===0 ? "1 / span 2" : (i===1 ? "1" : "2") }}/>
        ))}
      </div>
      <div style={{ position:"absolute", inset:0, background:"linear-gradient(to top, rgba(0,0,0,.5), transparent 40%)", pointerEvents:"none" }}/>
      <div style={{ position:"absolute", left:18, bottom:14, color:"#fbf8f1" }}>
        <div className="mono" style={{ fontSize:13, letterSpacing:".14em", textTransform:"uppercase", opacity:.95, fontWeight:700 }}>beauty</div>
        <div style={{ fontFamily:"var(--serif)", fontSize:18, marginTop:2 }}><em>this week</em></div>
      </div>
      <div style={{ position:"absolute", top:14, right:14, padding:"4px 9px", borderRadius:100, background:"rgba(0,0,0,.4)", color:"#fbf8f1", fontFamily:"var(--mono)", fontSize:10.5, letterSpacing:".06em" }}>12 new</div>
    </div>
  );
}
function BeautyExpanded({ onNav }) {
  return (
    <div style={{ padding:"20px 22px" }}>
      <div style={{ display:"flex", alignItems:"baseline", justifyContent:"space-between", marginBottom:14 }}>
        <div style={{ fontFamily:"var(--serif)", fontSize:20 }}><em>beauty · this week</em></div>
        <button onClick={() => onNav("beauty")} className="qbtn">open wall →</button>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap:8 }}>
        {[...BEAUTY_THUMBS, ...BEAUTY_THUMBS].map((b, i) => (
          <div key={i} style={{ aspectRatio:"1", background: b, borderRadius:6 }}/>
        ))}
      </div>
    </div>
  );
}

// — Memory ——————————————————————————————————————————————————————————————

function MemoryPreview() {
  return (
    <div>
      <div style={{ fontFamily:"var(--serif)", fontStyle:"italic", color:"var(--ink-70)", fontSize:15, lineHeight:1.5 }}>
        she reads philosophy in <em>two</em> languages, prefers tradeoffs, ships in spurts.
      </div>
      <div style={{ marginTop:14, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <span className="mono" style={{ fontSize:11, color:"var(--ink-35)" }}>247 memories</span>
        <span style={{ display:"flex", gap:5 }}>
          {Array.from({length: 6}).map((_, i) => (
            <span key={i} style={{ width:6, height:6, borderRadius:3, background:"var(--ink-20)", opacity: 1 - i*0.13 }}/>
          ))}
        </span>
      </div>
    </div>
  );
}
function MemoryExpanded() {
  return (
    <div>
      <div style={{ fontFamily:"var(--serif)", fontSize:20, marginBottom:14 }}><em>memory · ambient</em></div>
      <ul style={{ margin:0, padding:0, listStyle:"none", display:"flex", flexDirection:"column", gap:10 }}>
        {[
          ["preferences", "reads philosophy in two languages; prefers original-language quotes when feasible."],
          ["working style", "prefers tradeoffs over recommendations; when forced, asks for the second-best."],
          ["schedule", "morning pages by hand on tuesdays — do not pester before 9am."],
          ["context", "uses italic for the load-bearing word of a sentence."],
        ].map(([cat, t]) => (
          <li key={cat} className="row-hover" style={{ display:"grid", gridTemplateColumns:"110px 1fr", gap:14, padding:"6px 4px", borderRadius:4 }}>
            <span className="mono" style={{ fontSize:10.5, letterSpacing:".06em", textTransform:"uppercase", color:"var(--ink-50)" }}>{cat}</span>
            <span style={{ fontFamily:"var(--serif)", fontSize:14, color:"var(--ink)", lineHeight:1.5 }}>{t}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// — Modes ——————————————————————————————————————————————————————————————

function ModesPreview({ mode }) {
  return (
    <div>
      <div style={{ display:"flex", gap:18 }}>
        <ModeMini k="ulzii" active={mode === "ulzii"}/>
        <ModeMini k="obama" active={mode === "obama"}/>
      </div>
      <div className="mono" style={{ fontSize:11, color:"var(--ink-50)", marginTop:14 }}>active · {mode === "ulzii" ? "Ulzii" : "Obama"}</div>
    </div>
  );
}
function ModeMini({ k, active }) {
  const isU = k === "ulzii";
  const c = isU ? "var(--sky)" : "var(--forest)";
  return (
    <div style={{ flex:1, opacity: active ? 1 : .55 }}>
      <div style={{ display:"flex", alignItems:"center", gap:6 }}>
        <span style={{ width:8, height:8, borderRadius:4, background:c }}/>
        <span className="mono" style={{ fontSize:10.5, letterSpacing:".14em", textTransform:"uppercase", color:"var(--ink-50)" }}>{isU ? "ulzii" : "obama"}</span>
      </div>
      <div style={{ fontFamily:"var(--serif)", fontStyle:"italic", color:"var(--ink-70)", fontSize:14, marginTop:6 }}>
        {isU ? "tok · teacher" : "tech · founder"}
      </div>
    </div>
  );
}
function ModesExpanded({ onNav }) {
  return (
    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
      {["ulzii","obama"].map(m => {
        const isU = m === "ulzii";
        const c = isU ? "var(--sky)" : "var(--forest)";
        const sf = isU ? "var(--sky-soft)" : "var(--forest-soft)";
        return (
          <button key={m} onClick={() => onNav("chat")} style={{
            textAlign:"left", padding:"16px 16px 18px", borderRadius:"var(--r-md)",
            background:"transparent", border:"1px solid var(--rule)",
          }}
          onMouseEnter={e => { e.currentTarget.style.background = sf; e.currentTarget.style.borderColor = c; }}
          onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "var(--rule)"; }}
          >
            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
              <span style={{ width:8, height:8, borderRadius:4, background:c }}/>
              <span className="mono" style={{ fontSize:10.5, letterSpacing:".14em", textTransform:"uppercase", color:"var(--ink-50)" }}>
                {isU ? "ulzii · tok / teacher" : "obama · tech / founder"}
              </span>
            </div>
            <div style={{ fontFamily:"var(--serif)", fontSize:18, marginTop:10, color:"var(--ink)", lineHeight:1.3 }}>
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
  return (
    <div>
      <div style={{ fontFamily:"var(--serif)", fontSize:17, color:"var(--ink)" }}>Real Analysis · IB HL</div>
      <div style={{ display:"flex", gap:10, marginTop:10, alignItems:"baseline" }}>
        <div className="tnum" style={{ fontFamily:"var(--serif)", fontSize:30, color:"var(--ink)", letterSpacing:"-.01em" }}>14</div>
        <div className="mono" style={{ fontSize:10.5, color:"var(--ink-50)" }}>days · 7 sources · 4 artifacts</div>
      </div>
      <div style={{ marginTop:12, height:4, background:"var(--ink-10)", borderRadius:2, overflow:"hidden" }}>
        <div style={{ width:"68%", height:"100%", background:"var(--ink)" }}/>
      </div>
    </div>
  );
}
function ExamExpanded({ onNav }) {
  return (
    <div>
      <div style={{ display:"flex", alignItems:"baseline", justifyContent:"space-between", marginBottom:12 }}>
        <div style={{ fontFamily:"var(--serif)", fontSize:20 }}><em>Real Analysis · IB HL</em></div>
        <button onClick={() => onNav("exam")} className="qbtn">open workspace →</button>
      </div>
      <div className="mono" style={{ fontSize:11, color:"var(--ink-50)", marginBottom:10 }}>14 days · 7 sources · 4 artifacts</div>
      <ul style={{ margin:0, padding:0, listStyle:"none", display:"flex", flexDirection:"column", gap:6 }}>
        {[
          ["cheatsheet", "compressed for the exam"],
          ["graph", "knowledge map · 18 nodes"],
          ["practice", "8 problems queued"],
          ["sim", "ready when you are"],
        ].map(([k, t]) => (
          <li key={k} className="row-hover" style={{ display:"grid", gridTemplateColumns:"100px 1fr", padding:"7px 4px", borderRadius:4 }}>
            <span className="mono" style={{ fontSize:11, color:"var(--ink-50)" }}>{k}</span>
            <span style={{ fontSize:13.5, color:"var(--ink)", fontFamily:"var(--serif)", fontStyle:"italic" }}>{t}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// — Hooks & data ———————————————————————————————————————————————————————

function useNow() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30 * 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

const TODAY = [
  { time:"08:30", label:"morning pages",       done:true,  color:"var(--amber)", tag:"ritual" },
  { time:"10:00", label:"deep work · ESUI",    done:true,  color:"var(--forest)", tag:"focus" },
  { time:"13:00", label:"lunch w/ Badrushk",   done:true,  color:"var(--rose)", tag:"social" },
  { time:"15:30", label:"TOK reading: Carson", done:false, color:"var(--sky)", tag:"study" },
  { time:"19:00", label:"climb",               done:false, color:"var(--ink-20)", tag:"body" },
];

const RECENT_THREADS = [
  { mode:"ulzii", title:"the way of knowing in mathematical proof", ago:"2h" },
  { mode:"obama", title:"three-scenario sim — vault search architecture", ago:"yest" },
  { mode:"ulzii", title:"weil and attention", ago:"sun" },
];

const RECENT_VAULT = [
  { type:"artifact", title:"Market research · personal AI workspaces (q2)", ago:"30m" },
  { type:"note",     title:"On the difference between rigor and pedantry", ago:"2h" },
  { type:"idea",     title:"a calendar that respects energy curves", ago:"yest" },
];

const BEAUTY_THUMBS = [
  "linear-gradient(135deg, #d3c5a8 0%, #8b7e63 60%, #5e553f 100%)",
  "linear-gradient(160deg, #b3c4ce 0%, #6e8694 100%)",
  "linear-gradient(160deg, #c8b3a3 0%, #7e6a55 100%)",
];

export { HomeView };
