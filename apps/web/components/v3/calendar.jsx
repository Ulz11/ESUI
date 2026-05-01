"use client";

import React, { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Avatar, Cursor, Empty, GhostBtn, ModePill, ProviderChip, Rule, SectionTitle, Skel, Surface, Tag, useNow } from "./atoms";
import { I } from "./icons";

// Calendar — week view + AI planner review

function CalendarView({ mode }) {
  const [view, setView] = useState("week");
  const [planning, setPlanning] = useState(false);
  return (
    <div style={{ height:"100%", display:"grid", gridTemplateRows:"auto 1fr", overflow:"hidden" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"22px 32px", borderBottom:"1px solid var(--rule-soft)" }}>
        <div>
          <div style={{ fontFamily:"var(--mono)", fontSize:11, letterSpacing:".18em", textTransform:"uppercase", color:"var(--ink-35)" }}>calendar</div>
          <div style={{ fontFamily:"var(--serif)", fontSize:28, marginTop:4 }}>
            <em>this week</em> · <span className="tnum">may 4 — 10</span>
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:14 }}>
          <div style={{ display:"flex", padding:3, background:"var(--ink-06)", borderRadius:100, gap:2 }}>
            {["month","week","day"].map(v => (
              <button key={v} onClick={() => setView(v)} style={{
                padding:"5px 14px", borderRadius:100, fontSize:12.5,
                background: v === view ? "var(--surface)" : "transparent",
                color: v === view ? "var(--ink)" : "var(--ink-50)",
                boxShadow: v === view ? "0 1px 2px rgba(26,29,44,.08)" : "none",
              }}>{v}</button>
            ))}
          </div>
          <button onClick={() => setPlanning(true)} style={{
            padding:"8px 14px", background:"var(--ink)", color:"var(--paper)",
            borderRadius:100, fontSize:13, display:"inline-flex", alignItems:"center", gap:8,
          }}><I.sparkle size={13}/> plan with ai</button>
        </div>
      </div>
      {view === "week" && <WeekGrid/>}
      {view === "month" && <MonthGrid/>}
      {view === "day" && <DayGrid/>}
      {planning && <PlannerModal mode={mode} onClose={() => setPlanning(false)}/>}
    </div>
  );
}

function WeekGrid() {
  const days = ["mon 4","tue 5","wed 6","thu 7","fri 8","sat 9","sun 10"];
  const hours = Array.from({length:14}, (_, i) => i + 8); // 8..21
  return (
    <div style={{ overflow:"auto", padding:"0 32px 32px" }}>
      <div style={{ display:"grid", gridTemplateColumns:"56px repeat(7, 1fr)", borderBottom:"1px solid var(--rule)" }}>
        <div/>
        {days.map((d, i) => (
          <div key={d} style={{ padding:"14px 12px", borderLeft:"1px solid var(--rule-soft)", display:"flex", alignItems:"baseline", justifyContent:"space-between" }}>
            <span className="mono" style={{ fontSize:11, letterSpacing:".1em", textTransform:"uppercase", color:"var(--ink-50)" }}>{d.split(" ")[0]}</span>
            <span className="tnum" style={{ fontFamily:"var(--serif)", fontSize:22, color: i === 1 ? "var(--ink)" : "var(--ink-50)", fontStyle: i===1 ? "italic" : "normal" }}>{d.split(" ")[1]}</span>
          </div>
        ))}
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"56px repeat(7, 1fr)", position:"relative" }}>
        <div>
          {hours.map(h => (
            <div key={h} style={{ height:64, position:"relative", color:"var(--ink-35)" }}>
              <span className="tnum mono" style={{ position:"absolute", top:-7, right:8, fontSize:10.5 }}>{String(h).padStart(2,"0")}:00</span>
            </div>
          ))}
        </div>
        {days.map((d, di) => (
          <div key={d} style={{ borderLeft:"1px solid var(--rule-soft)", position:"relative" }}>
            {hours.map(h => <div key={h} style={{ height:64, borderTop:"1px solid var(--rule-soft)" }}/>)}
            {EVENTS[di] && EVENTS[di].map((e, ei) => (
              <div key={ei} style={{
                position:"absolute",
                left:6, right:6,
                top: (e.h - 8) * 64 + 2,
                height: e.dur * 64 - 4,
                background: e.color,
                borderRadius:8,
                padding:"8px 10px",
                fontSize:12,
                color:"var(--ink)",
                borderLeft:`3px solid ${e.accent}`,
                overflow:"hidden",
              }}>
                <div style={{ fontWeight:500 }}>{e.title}</div>
                <div className="tnum" style={{ fontSize:11, color:"var(--ink-50)", marginTop:2 }}>{String(e.h).padStart(2,"0")}:00</div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function MonthGrid() {
  return (
    <div style={{ padding:"0 32px 32px", overflow:"auto" }}>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(7, 1fr)", borderTop:"1px solid var(--rule)", borderLeft:"1px solid var(--rule)" }}>
        {["mon","tue","wed","thu","fri","sat","sun"].map(d => (
          <div key={d} className="mono" style={{ padding:"10px 12px", fontSize:11, letterSpacing:".1em", textTransform:"uppercase", color:"var(--ink-50)", borderRight:"1px solid var(--rule)", borderBottom:"1px solid var(--rule)" }}>{d}</div>
        ))}
        {Array.from({length: 35}, (_, i) => {
          const day = i - 2;
          const inMonth = day >= 1 && day <= 31;
          const isToday = day === 5;
          return (
            <div key={i} style={{ minHeight:96, padding:"8px 10px", borderRight:"1px solid var(--rule)", borderBottom:"1px solid var(--rule)", background: inMonth ? "transparent" : "var(--paper-2)" }}>
              <div className="tnum" style={{
                fontFamily:"var(--serif)", fontSize:15,
                color: !inMonth ? "var(--ink-35)" : (isToday ? "var(--ink)" : "var(--ink-70)"),
                display:"inline-flex", alignItems:"center", justifyContent:"center",
                width:24, height:24, borderRadius:12,
                border: isToday ? "1px solid var(--sky)" : "none",
                fontStyle: isToday ? "italic" : "normal",
              }}>{inMonth ? day : (day < 1 ? 30 + day : day - 31)}</div>
              {inMonth && MONTH_PILLS[day] && (
                <div style={{ marginTop:6, display:"flex", flexDirection:"column", gap:3 }}>
                  {MONTH_PILLS[day].slice(0,3).map((p, pi) => (
                    <div key={pi} style={{ fontSize:11, padding:"2px 6px", borderRadius:4, background: p.bg, color: p.fg, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{p.title}</div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DayGrid() {
  return (
    <div style={{ display:"grid", gridTemplateColumns:"1fr 280px", overflow:"hidden" }}>
      <div style={{ overflow:"auto", padding:"0 32px 32px" }}>
        <div style={{ position:"relative" }}>
          {Array.from({length:14}, (_, i) => i + 8).map(h => (
            <div key={h} style={{ display:"flex", borderTop:"1px solid var(--rule-soft)", height:80 }}>
              <div className="tnum mono" style={{ width:60, fontSize:11, color:"var(--ink-35)", paddingTop:6 }}>{String(h).padStart(2,"0")}:00</div>
              <div style={{ flex:1, position:"relative" }}>
                {DAY_EVENTS[h] && (
                  <div style={{ position:"absolute", inset:"4px 12px", background: DAY_EVENTS[h].color, borderLeft:`3px solid ${DAY_EVENTS[h].accent}`, borderRadius:8, padding:"10px 14px" }}>
                    <div style={{ fontFamily:"var(--serif)", fontSize:15 }}>{DAY_EVENTS[h].title}</div>
                    <div className="mono" style={{ fontSize:11, color:"var(--ink-50)", marginTop:3 }}>{DAY_EVENTS[h].sub}</div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ borderLeft:"1px solid var(--rule)", padding:"22px 22px", overflow:"auto" }}>
        <div style={{ fontSize:11, letterSpacing:".14em", textTransform:"uppercase", color:"var(--ink-50)", marginBottom:14 }}>undated</div>
        {UNDATED.map(t => (
          <div key={t} style={{ padding:"10px 12px", border:"1px solid var(--rule)", borderRadius:8, marginBottom:8, fontSize:13, color:"var(--ink-70)", cursor:"grab" }}>
            {t}
          </div>
        ))}
      </div>
    </div>
  );
}

function PlannerModal({ mode, onClose }) {
  const [stage, setStage] = useState("input"); // input -> loading -> review
  const [intent, setIntent] = useState("a deep work day. carve real time for the proof writeup, finish the planner UX, and leave room for reading.");
  useEffect(() => {
    if (stage === "loading") {
      const id = setTimeout(() => setStage("review"), 2400);
      return () => clearTimeout(id);
    }
  }, [stage]);

  return (
    <div className="fi" style={{ position:"fixed", inset:0, background:"rgba(13,15,23,.32)", backdropFilter:"blur(2px)", zIndex:50, display:"grid", placeItems:"center", padding:32 }}>
      <div className="fu" style={{ width:"min(820px, 100%)", maxHeight:"90vh", background:"var(--surface)", borderRadius:"var(--r-lg)", border:"1px solid var(--rule)", boxShadow:"0 30px 80px -20px rgba(13,15,23,.35)", overflow:"hidden", display:"grid", gridTemplateRows:"auto 1fr auto" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"18px 22px", borderBottom:"1px solid var(--rule-soft)" }}>
          <div style={{ fontFamily:"var(--serif)", fontSize:19 }}><em>plan with ai</em></div>
          <button onClick={onClose} className="qbtn"><I.close size={14}/></button>
        </div>

        {stage === "input" && (
          <div style={{ padding:"24px 28px", overflow:"auto" }}>
            <div style={{ fontSize:11, letterSpacing:".14em", textTransform:"uppercase", color:"var(--ink-50)", marginBottom:8 }}>what would you like to plan?</div>
            <textarea value={intent} onChange={e => setIntent(e.target.value)} rows={4} autoFocus
              style={{ width:"100%", padding:"14px 16px", border:"1px solid var(--rule)", borderRadius:"var(--r-md)", fontFamily:"var(--serif)", fontSize:16, lineHeight:1.5 }}/>
            <div style={{ display:"flex", gap:24, marginTop:18, alignItems:"center" }}>
              <div>
                <div className="mono" style={{ fontSize:10, letterSpacing:".14em", textTransform:"uppercase", color:"var(--ink-50)", marginBottom:6 }}>range</div>
                <div style={{ fontFamily:"var(--serif)", fontSize:15 }}>today · <em>tue may 5</em></div>
              </div>
              <div style={{ flex:1 }}/>
              <div>
                <div className="mono" style={{ fontSize:10, letterSpacing:".14em", textTransform:"uppercase", color:"var(--ink-50)", marginBottom:6 }}>posture</div>
                <ModePill mode={mode}/>
              </div>
            </div>
          </div>
        )}

        {stage === "loading" && (
          <div style={{ padding:"60px 28px", textAlign:"center", display:"grid", gap:18, justifyItems:"center" }}>
            <div style={{ width:46, height:46, borderRadius:23, border:`1.5px solid ${mode==="ulzii"?"var(--sky)":"var(--forest)"}`, animation:"breathe 2.2s ease-in-out infinite" }}/>
            <div style={{ fontFamily:"var(--serif)", fontSize:18, fontStyle:"italic", color:"var(--ink-70)", maxWidth:460 }}>
              opus is reading your vault, calendar, and recent memory…
            </div>
          </div>
        )}

        {stage === "review" && (
          <div style={{ padding:"22px 28px", overflow:"auto" }}>
            <div style={{ fontFamily:"var(--serif)", fontSize:17, lineHeight:1.55, color:"var(--ink-70)", borderLeft:"2px solid var(--rule)", paddingLeft:14, fontStyle:"italic" }}>
              You've named two heavy heads — the proof writeup and the planner UX — so I split them. Mornings hold quiet for the writeup; the UX needs collaborative energy, so I placed it after lunch. Reading sits at dusk where you've kept it before.
            </div>

            <div className="mono" style={{ fontSize:10, letterSpacing:".14em", textTransform:"uppercase", color:"var(--ink-50)", marginTop:24, marginBottom:10 }}>open question</div>
            <div style={{ padding:"12px 14px", background:"#f5e9c8", borderRadius:8, fontFamily:"var(--serif)", fontStyle:"italic", color:"var(--ink-70)", fontSize:14 }}>
              do you want a buffer before lunch with badrushk, or use that hour for the proof?
            </div>

            <div className="mono" style={{ fontSize:10, letterSpacing:".14em", textTransform:"uppercase", color:"var(--ink-50)", marginTop:24, marginBottom:10 }}>proposed · 6 items</div>
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              {PROPOSED.map((p, i) => (
                <div key={i} style={{ padding:"12px 14px", border:"1px solid var(--rule)", borderRadius:"var(--r-md)" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                    <span style={{ width:8, height:8, borderRadius:4, background:p.color }}/>
                    <span style={{ fontFamily:"var(--serif)", fontSize:15.5 }}>{p.title}</span>
                    <span className="tnum mono" style={{ fontSize:11, color:"var(--ink-50)", marginLeft:"auto" }}>{p.time}</span>
                  </div>
                  <div style={{ marginLeft:18, fontFamily:"var(--serif)", fontStyle:"italic", color:"var(--ink-50)", fontSize:13.5, marginTop:4 }}>{p.rationale}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ display:"flex", justifyContent:"flex-end", gap:8, padding:"14px 22px", borderTop:"1px solid var(--rule-soft)" }}>
          {stage === "input" && (
            <>
              <button onClick={onClose} className="qbtn">not now</button>
              <button onClick={() => setStage("loading")} style={{ padding:"8px 16px", background:"var(--ink)", color:"var(--paper)", borderRadius:100, fontSize:13 }}>think it through</button>
            </>
          )}
          {stage === "review" && (
            <>
              <button onClick={onClose} className="qbtn">discard</button>
              <button className="qbtn">edit</button>
              <button onClick={onClose} style={{ padding:"8px 16px", background:"var(--ink)", color:"var(--paper)", borderRadius:100, fontSize:13 }}>accept all</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const EVENTS = [
  // Monday (i=0)
  [{ h:9, dur:2, title:"morning pages", color:"#f4ead9", accent:"var(--amber)" },
   { h:14, dur:1.5, title:"vault search · spec", color:"var(--forest-soft)", accent:"var(--forest)" }],
  // Tuesday (today)
  [{ h:8.5, dur:1, title:"morning pages", color:"#f4ead9", accent:"var(--amber)" },
   { h:10, dur:2.5, title:"deep work · ESUI", color:"var(--forest-soft)", accent:"var(--forest)" },
   { h:13, dur:1, title:"lunch · badrushk", color:"var(--rose-soft)", accent:"var(--rose)" },
   { h:15.5, dur:1.5, title:"TOK reading · carson", color:"var(--sky-soft)", accent:"var(--sky)" }],
  // Wed
  [{ h:9, dur:1.5, title:"climbing · early", color:"#e7e5ec", accent:"#6f6aa8" },
   { h:14, dur:2, title:"three-scenario sim", color:"var(--forest-soft)", accent:"var(--forest)" }],
  // Thu
  [{ h:10, dur:3, title:"writeup · proof", color:"var(--sky-soft)", accent:"var(--sky)" },
   { h:17, dur:1, title:"office hours", color:"#f4ead9", accent:"var(--amber)" }],
  // Fri
  [{ h:9, dur:1, title:"morning pages", color:"#f4ead9", accent:"var(--amber)" },
   { h:11, dur:2, title:"sketch · planner UX", color:"var(--sky-soft)", accent:"var(--sky)" }],
  // Sat
  [{ h:11, dur:2, title:"market: AI workspaces", color:"var(--forest-soft)", accent:"var(--forest)" }],
  // Sun
  [{ h:10, dur:2, title:"reading · weil", color:"var(--sky-soft)", accent:"var(--sky)" }],
];

const MONTH_PILLS = {
  4: [{ title:"morning pages", bg:"#f4ead9", fg:"var(--amber)" }, { title:"vault spec", bg:"var(--forest-soft)", fg:"var(--forest-deep)" }],
  5: [{ title:"deep work · ESUI", bg:"var(--forest-soft)", fg:"var(--forest-deep)" }, { title:"lunch · badrushk", bg:"var(--rose-soft)", fg:"var(--rose)" }, { title:"TOK · carson", bg:"var(--sky-soft)", fg:"var(--sky-deep)" }],
  6: [{ title:"climbing", bg:"#e7e5ec", fg:"#6f6aa8" }, { title:"sim", bg:"var(--forest-soft)", fg:"var(--forest-deep)" }],
  7: [{ title:"writeup · proof", bg:"var(--sky-soft)", fg:"var(--sky-deep)" }],
  8: [{ title:"sketch · planner", bg:"var(--sky-soft)", fg:"var(--sky-deep)" }],
  10:[{ title:"reading · weil", bg:"var(--sky-soft)", fg:"var(--sky-deep)" }],
  14:[{ title:"talk @ stanford", bg:"var(--rose-soft)", fg:"var(--rose)" }],
  20:[{ title:"deep work", bg:"var(--forest-soft)", fg:"var(--forest-deep)" }],
};

const DAY_EVENTS = {
  8:  { title:"morning pages", sub:"a quiet half hour", color:"#f4ead9", accent:"var(--amber)" },
  10: { title:"deep work · ESUI", sub:"vault search architecture", color:"var(--forest-soft)", accent:"var(--forest)" },
  13: { title:"lunch · badrushk", sub:"the place near campus", color:"var(--rose-soft)", accent:"var(--rose)" },
  15: { title:"TOK reading · carson", sub:"hours, like sand", color:"var(--sky-soft)", accent:"var(--sky)" },
  19: { title:"climb", sub:"easy session", color:"#e7e5ec", accent:"#6f6aa8" },
};

const UNDATED = [
  "reply to advisor on draft 2",
  "rewrite intro to esui paper",
  "shop for tea",
  "borges reread (labyrinths)",
  "find that ibn rushd citation",
];

const PROPOSED = [
  { color:"var(--amber)", title:"morning pages", time:"08:30 — 09:00", rationale:"thirty quiet minutes; you said you write better when this leads the day." },
  { color:"var(--sky)", title:"writeup · proof", time:"09:00 — 11:30", rationale:"two and a half hours of solitary morning energy. no interruptions." },
  { color:"var(--rose)", title:"lunch · badrushk", time:"13:00 — 14:00", rationale:"already on the calendar; left as is." },
  { color:"var(--forest)", title:"sketch · planner UX", time:"14:30 — 16:30", rationale:"collaborative energy is for after lunch; pair work fits here." },
  { color:"var(--sky)", title:"TOK reading · carson", time:"17:00 — 18:00", rationale:"dusk reading you've kept consistent for six weeks." },
  { color:"#6f6aa8", title:"climb", time:"19:00 — 20:00", rationale:"booked." },
];

export { CalendarView };
