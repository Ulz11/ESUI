"use client";

import React, { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Avatar, Cursor, Empty, GhostBtn, ModePill, ProviderChip, Rule, SectionTitle, Skel, Surface, Tag, useNow } from "./atoms";
import { I } from "./icons";

// Settings drawer — focus on Memory audit

function SettingsDrawer({ open, onClose }) {
  const [section, setSection] = useState("memory");
  if (!open) return null;
  return (
    <div className="fi" style={{ position:"fixed", inset:0, background:"rgba(13,15,23,.32)", zIndex:55 }} onClick={onClose}>
      <div className="fu" onClick={e => e.stopPropagation()} style={{
        position:"absolute", right:0, top:0, bottom:0, width:"min(720px, 92vw)",
        background:"var(--paper)", borderLeft:"1px solid var(--rule)",
        display:"grid", gridTemplateColumns:"180px 1fr", overflow:"hidden",
      }}>
        <div style={{ borderRight:"1px solid var(--rule)", padding:"32px 18px" }}>
          <div className="mono" style={{ fontSize:11, letterSpacing:".18em", textTransform:"uppercase", color:"var(--ink-35)" }}>settings</div>
          <div style={{ marginTop:18, display:"flex", flexDirection:"column", gap:2 }}>
            {[
              ["profile","profile"],
              ["memory","memory"],
              ["usage","usage"],
              ["theme","theme"],
            ].map(([k, l]) => (
              <button key={k} onClick={() => setSection(k)} style={{
                textAlign:"left", padding:"8px 10px", borderRadius:6,
                background: section === k ? "var(--ink-06)" : "transparent",
                color: section === k ? "var(--ink)" : "var(--ink-50)", fontSize:13.5,
              }}>{l}</button>
            ))}
          </div>
        </div>
        <div style={{ overflow:"auto", padding:"36px 36px" }}>
          {section === "memory" && <MemoryAudit/>}
          {section === "profile" && <ProfilePanel/>}
          {section === "usage"  && <UsagePanel/>}
          {section === "theme"  && <ThemePanel/>}
        </div>
      </div>
    </div>
  );
}

function MemoryAudit() {
  return (
    <div>
      <div style={{ fontFamily:"var(--serif)", fontSize:26 }}><em>memory</em></div>
      <div style={{ fontFamily:"var(--serif)", fontSize:15, color:"var(--ink-50)", marginTop:6, fontStyle:"italic" }}>
        what the AI has come to know about her. all of it editable, all of it forgettable.
      </div>
      <div style={{ marginTop:24, display:"flex", alignItems:"center", gap:8, padding:"8px 12px", border:"1px solid var(--rule)", borderRadius:100 }}>
        <I.search size={13}/><span style={{ fontFamily:"var(--serif)", fontStyle:"italic", color:"var(--ink-50)", fontSize:14 }}>search memories…</span>
      </div>
      <div style={{ marginTop:22 }}>
        {MEMS.map((m, i) => (
          <div key={i} style={{ padding:"14px 0", borderTop:"1px solid var(--rule-soft)", display:"grid", gridTemplateColumns:"1fr auto auto", gap:14, alignItems:"baseline" }}>
            <div>
              <div style={{ fontFamily:"var(--serif)", fontSize:15.5, color:"var(--ink)" }}>{m.text}</div>
              <div style={{ display:"flex", gap:8, marginTop:6, alignItems:"center" }}>
                <Tag>{m.cat}</Tag>
                <span className="mono" style={{ fontSize:11, color:"var(--ink-35)" }}>{m.src} · used {m.ago}</span>
              </div>
            </div>
            <div style={{ display:"flex", gap:2 }}>
              {Array.from({length:3}).map((_, di) => (
                <span key={di} style={{ width:6, height:6, borderRadius:3, background: di < m.salience ? "var(--ink-50)" : "var(--ink-10)" }}/>
              ))}
            </div>
            <div style={{ display:"flex", gap:4 }}>
              <button className="qbtn">edit</button>
              <button className="qbtn">forget</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProfilePanel() {
  return (
    <div>
      <div style={{ fontFamily:"var(--serif)", fontSize:26 }}><em>profile</em></div>
      <div style={{ marginTop:24, display:"flex", flexDirection:"column", gap:18 }}>
        {[
          ["display name", "Esui"],
          ["timezone", "America/Los_Angeles"],
          ["default mode", "Ulzii"],
        ].map(([k, v]) => (
          <div key={k} style={{ display:"grid", gridTemplateColumns:"160px 1fr", borderTop:"1px solid var(--rule-soft)", paddingTop:14 }}>
            <div className="mono" style={{ fontSize:11, letterSpacing:".1em", textTransform:"uppercase", color:"var(--ink-50)" }}>{k}</div>
            <div style={{ fontFamily:"var(--serif)", fontSize:16 }}>{v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function UsagePanel() {
  return (
    <div>
      <div style={{ fontFamily:"var(--serif)", fontSize:26 }}><em>usage</em></div>
      <div style={{ marginTop:24, padding:"22px 24px", border:"1px solid var(--rule)", borderRadius:"var(--r-md)" }}>
        <div className="mono" style={{ fontSize:11, letterSpacing:".14em", textTransform:"uppercase", color:"var(--ink-50)" }}>today</div>
        <div className="tnum" style={{ fontFamily:"var(--serif)", fontSize:34, marginTop:6 }}>$2.48</div>
        <div className="mono" style={{ fontSize:11, color:"var(--ink-35)", marginTop:4 }}>of $10.00 daily cap</div>
      </div>
      <div style={{ marginTop:18 }}>
        {[
          ["chat · opus", "$1.62"],
          ["chat · sonnet", "$0.34"],
          ["planner · opus", "$0.42"],
          ["embeddings", "$0.10"],
        ].map(([k, v]) => (
          <div key={k} style={{ display:"flex", justifyContent:"space-between", padding:"12px 0", borderTop:"1px solid var(--rule-soft)" }}>
            <span>{k}</span><span className="mono tnum" style={{ color:"var(--ink-50)" }}>{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ThemePanel() {
  return (
    <div>
      <div style={{ fontFamily:"var(--serif)", fontSize:26 }}><em>theme</em></div>
      <div style={{ marginTop:24, display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:14 }}>
        {[["light","selected"],["dark",""],["system",""]].map(([k, s]) => (
          <button key={k} style={{ padding:"22px 18px", border: s ? "1px solid var(--ink)" : "1px solid var(--rule)", borderRadius:"var(--r-md)", textAlign:"left" }}>
            <div className="mono" style={{ fontSize:11, letterSpacing:".14em", textTransform:"uppercase", color:"var(--ink-50)" }}>{k}</div>
            <div style={{ fontFamily:"var(--serif)", fontSize:18, marginTop:4 }}>{s ? "selected" : "—"}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

const MEMS = [
  { text:"reads philosophy in english and arabic; prefers original-language quotes when feasible.", cat:"preferences", src:"from chat", ago:"2 hours ago", salience:3 },
  { text:"writes morning pages by hand on tuesdays; do not pester before 9am tuesday.", cat:"schedule", src:"manual", ago:"3 days ago", salience:3 },
  { text:"prefers tradeoffs over recommendations; when forced to recommend, asks for the second-best option.", cat:"working style", src:"from chat", ago:"yesterday", salience:2 },
  { text:"climbs at planet granite tuesdays and thursdays. evenings.", cat:"schedule", src:"from chat", ago:"a week ago", salience:2 },
  { text:"uses italic for the load-bearing word of a sentence.", cat:"writing style", src:"from chat", ago:"5 days ago", salience:1 },
  { text:"badrushk's nickname is obama, but only she may use it.", cat:"context", src:"manual", ago:"a month ago", salience:3 },
];

export { SettingsDrawer };
