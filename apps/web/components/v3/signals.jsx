"use client";

import React, { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Avatar, Cursor, Empty, GhostBtn, ModePill, ProviderChip, Rule, SectionTitle, Skel, Surface, Tag, useNow } from "./atoms";
import { I } from "./icons";

// Daily Signals — typography-first reading

function SignalsView() {
  const [src, setSrc] = useState("chinese_philosophy");
  const [idx, setIdx] = useState(0);
  const list = QUOTES[src];
  const q = list[idx];
  return (
    <div style={{ height:"100%", display:"grid", gridTemplateColumns:"260px 1fr", overflow:"hidden" }}>
      <div style={{ borderRight:"1px solid var(--rule)", padding:"32px 22px", overflow:"auto" }}>
        <div className="mono" style={{ fontSize:11, letterSpacing:".18em", textTransform:"uppercase", color:"var(--ink-35)" }}>daily signals</div>
        <div style={{ marginTop:24 }}>
          {SOURCES.map(s => {
            const active = src === s.k;
            return (
              <button key={s.k} onClick={() => { setSrc(s.k); setIdx(0); }}
                style={{ display:"block", textAlign:"left", padding:"12px 0", borderTop:"1px solid var(--rule-soft)", width:"100%" }}>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <span style={{ width:6, height:6, borderRadius:3, background: s.c, opacity: active ? 1 : .35 }}/>
                  <span style={{ fontFamily:"var(--serif)", fontSize:15, color: active ? "var(--ink)" : "var(--ink-50)", fontStyle: active ? "italic" : "normal" }}>{s.label}</span>
                </div>
                <div className="mono" style={{ fontSize:10.5, color:"var(--ink-35)", marginTop:4, marginLeft:14 }}>{QUOTES[s.k].length} entries</div>
              </button>
            );
          })}
        </div>
        <div style={{ marginTop:32, padding:"12px 14px", border:"1px dashed var(--rule)", borderRadius:8 }}>
          <div className="mono" style={{ fontSize:10, letterSpacing:".14em", textTransform:"uppercase", color:"var(--ink-35)" }}>next cycle</div>
          <div style={{ fontFamily:"var(--serif)", fontSize:14, color:"var(--ink-70)", marginTop:4, fontStyle:"italic" }}>in 23 minutes</div>
        </div>
      </div>

      <div style={{ overflow:"auto", padding:"80px 64px", display:"grid", placeItems:"center" }}>
        <div style={{ maxWidth: 720, width:"100%" }}>
          <div className="mono" style={{ fontSize:11, letterSpacing:".18em", textTransform:"uppercase", color: SOURCES.find(s => s.k === src).c, marginBottom: 28 }}>
            {SOURCES.find(s => s.k === src).label}
          </div>
          <div style={{ fontFamily:"var(--serif)", fontSize: 38, lineHeight:1.35, letterSpacing:"-.012em", color:"var(--ink)" }}>
            <em>“{q.text}”</em>
          </div>
          <div style={{ marginTop:36, fontFamily:"var(--serif)", fontStyle:"italic", color:"var(--ink-50)", fontSize:16 }}>
            — {q.attribution}
          </div>
          <div style={{ marginTop:48, display:"flex", alignItems:"center", gap:16, color:"var(--ink-35)" }}>
            <button onClick={() => setIdx((idx - 1 + list.length) % list.length)} className="qbtn"><I.back size={14}/></button>
            <span className="tnum mono" style={{ fontSize:11 }}>{idx + 1} / {list.length}</span>
            <button onClick={() => setIdx((idx + 1) % list.length)} className="qbtn" style={{ transform:"rotate(180deg)" }}><I.back size={14}/></button>
            <div style={{ flex:1 }}/>
            <button className="qbtn"><I.pin size={13}/> pin to vault</button>
            <button className="qbtn"><I.chat size={13}/> share to chat</button>
          </div>
        </div>
      </div>
    </div>
  );
}

const SOURCES = [
  { k:"chinese_philosophy", label:"Chinese philosophy", c:"#a64f63" },
  { k:"arabic_philosophy",  label:"Arabic philosophy",  c:"#3a6a51" },
  { k:"francis_su",         label:"Francis Su",         c:"#8a6a3c" },
  { k:"inspiration",        label:"Inspiration",        c:"#4a8cad" },
];

const QUOTES = {
  chinese_philosophy: [
    { text:"The journey of a thousand li begins beneath one's feet.", attribution:"Laozi · Tao Te Ching, 64" },
    { text:"To know what you know and what you do not know, that is true knowledge.", attribution:"Confucius · Analects" },
    { text:"The fish trap exists because of the fish; once you've gotten the fish, you can forget the trap.", attribution:"Zhuangzi" },
    { text:"To know and not to do is not to know.", attribution:"Wang Yangming" },
  ],
  arabic_philosophy: [
    { text:"The first thing the Creator created was the intellect, and He said to it: come — and it came.", attribution:"Al-Ghazali" },
    { text:"He who knows himself, knows his Lord.", attribution:"Ibn Arabi" },
    { text:"The world is a bridge; pass over it, but build no house upon it.", attribution:"attributed · Ibn Khaldun" },
  ],
  francis_su: [
    { text:"Mathematics, rightly seen, is the pursuit of human flourishing.", attribution:"Francis Su · Mathematics for Human Flourishing" },
    { text:"Every person, no matter their background, is built for mathematics, because every person is built to flourish.", attribution:"Francis Su" },
  ],
  inspiration: [
    { text:"Attention is the rarest and purest form of generosity.", attribution:"Simone Weil" },
    { text:"How we spend our days is, of course, how we spend our lives.", attribution:"Annie Dillard" },
    { text:"You will find, if you look, that much of what we say is sand.", attribution:"Anne Carson" },
    { text:"You have power over your mind, not outside events. Realize this, and you will find strength.", attribution:"Marcus Aurelius" },
  ],
};

export { SignalsView };
