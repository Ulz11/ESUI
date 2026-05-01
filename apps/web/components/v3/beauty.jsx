"use client";

import React, { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Avatar, Cursor, Empty, GhostBtn, ModePill, ProviderChip, Rule, SectionTitle, Skel, Surface, Tag, useNow } from "./atoms";
import { I } from "./icons";

// Beauty — calm gallery (esui-only writes; badrushk read-only)

function BeautyView({ role = "esui" }) {
  const [open, setOpen] = useState(null);
  const items = MEDIA;
  return (
    <div style={{ height:"100%", display:"grid", gridTemplateRows:"auto 1fr", overflow:"hidden" }}>
      <div style={{ padding:"22px 32px", borderBottom:"1px solid var(--rule-soft)", display:"flex", alignItems:"baseline", justifyContent:"space-between" }}>
        <div>
          <div className="mono" style={{ fontSize:11, letterSpacing:".18em", textTransform:"uppercase", color:"var(--ink-35)" }}>beauty</div>
          <div style={{ fontFamily:"var(--serif)", fontSize:28, marginTop:4 }}><em>a wall in her room</em></div>
        </div>
        {role === "esui" ? (
          <button style={{ padding:"8px 14px", border:"1px solid var(--rule)", borderRadius:100, fontSize:13, color:"var(--ink-70)", display:"inline-flex", alignItems:"center", gap:8 }}>
            <I.plus size={13}/> add
          </button>
        ) : (
          <span className="mono" style={{ fontSize:11, color:"var(--ink-35)" }}>read-only · viewing as badrushk</span>
        )}
      </div>
      <div style={{ overflow:"auto", padding:"32px 40px" }}>
        <div className="mono" style={{ fontSize:11, letterSpacing:".18em", textTransform:"uppercase", color:"var(--ink-35)", marginBottom:16 }}>this week</div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(12, 1fr)", gridAutoRows:"110px", gap:12, marginBottom:48 }}>
          {items.slice(0, 7).map((m, i) => (
            <BeautyCard key={i} m={m} span={m.span} onClick={() => setOpen(i)}/>
          ))}
        </div>
        <div className="mono" style={{ fontSize:11, letterSpacing:".18em", textTransform:"uppercase", color:"var(--ink-35)", marginBottom:16 }}>april</div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(12, 1fr)", gridAutoRows:"110px", gap:12 }}>
          {items.slice(7).map((m, i) => (
            <BeautyCard key={i+7} m={m} span={m.span} onClick={() => setOpen(i+7)}/>
          ))}
        </div>
      </div>
      {open != null && <Lightbox m={items[open]} onClose={() => setOpen(null)} onPrev={() => setOpen((open - 1 + items.length) % items.length)} onNext={() => setOpen((open + 1) % items.length)}/>}
    </div>
  );
}

function BeautyCard({ m, span = "c4 r2", onClick }) {
  const [c, r] = span.split(" ");
  const cw = +c.slice(1), rh = +r.slice(1);
  return (
    <div onClick={onClick} style={{
      gridColumn:`span ${cw}`, gridRow:`span ${rh}`,
      background: m.bg, borderRadius:6, overflow:"hidden", cursor:"pointer",
      position:"relative", boxShadow:"0 1px 2px rgba(26,29,44,.05), 0 8px 30px -12px rgba(26,29,44,.18)",
    }}>
      {m.video && (
        <div style={{ position:"absolute", top:8, right:8, padding:"2px 6px", borderRadius:4, background:"rgba(13,15,23,.5)", color:"#fbf8f1", fontSize:10, fontFamily:"var(--mono)", letterSpacing:".08em", textTransform:"uppercase" }}>video</div>
      )}
      {m.cap && (
        <div style={{ position:"absolute", left:0, right:0, bottom:0, padding:"22px 14px 10px", background:"linear-gradient(to top, rgba(13,15,23,.55), transparent)", color:"#fbf8f1", fontFamily:"var(--serif)", fontSize:13, fontStyle:"italic", opacity:0, transition:"opacity .2s" }}
            onMouseEnter={e => e.currentTarget.style.opacity = 1}>
          {m.cap}
        </div>
      )}
    </div>
  );
}

function Lightbox({ m, onClose, onPrev, onNext }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") onPrev();
      if (e.key === "ArrowRight") onNext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onPrev, onNext]);
  return (
    <div className="fi" style={{ position:"fixed", inset:0, background:"rgba(13,15,23,.85)", backdropFilter:"blur(8px)", zIndex:60, display:"grid", gridTemplateRows:"1fr auto", padding:"40px 80px" }}>
      <div onClick={onClose} style={{ background: m.bg, borderRadius:8, position:"relative" }}/>
      <div style={{ paddingTop:18, color:"#fbf8f1", display:"flex", alignItems:"baseline", gap:18 }}>
        <div style={{ fontFamily:"var(--serif)", fontSize:18, fontStyle:"italic" }}>{m.cap}</div>
        <div style={{ flex:1 }}/>
        <div className="mono" style={{ fontSize:11, opacity:.7 }}>{m.taken_at}</div>
        <button onClick={onClose} style={{ color:"#fbf8f1", padding:6 }}><I.close size={16}/></button>
      </div>
      <button onClick={onPrev} style={{ position:"absolute", left:24, top:"50%", color:"#fbf8f1", padding:14 }}><I.back size={18}/></button>
      <button onClick={onNext} style={{ position:"absolute", right:24, top:"50%", color:"#fbf8f1", padding:14, transform:"rotate(180deg)" }}><I.back size={18}/></button>
    </div>
  );
}

const MEDIA = [
  { span:"c5 r3", bg:"linear-gradient(135deg,#d3c5a8,#7e6d4d)", cap:"morning, the desk", taken_at:"may 5 · 08:24" },
  { span:"c3 r2", bg:"linear-gradient(160deg,#b3c4ce,#5e7382)", cap:"the river behind campus", taken_at:"may 4" },
  { span:"c4 r2", bg:"linear-gradient(140deg,#c8b3a3,#7e6a55)", cap:"books on the floor again", taken_at:"may 4" },
  { span:"c3 r1", bg:"linear-gradient(160deg,#a4b3a0,#5b6e58)", cap:"window, gingko", taken_at:"may 3" },
  { span:"c4 r1", bg:"linear-gradient(135deg,#d8c0c4,#a26b76)", video:true, cap:"badrushk made tea", taken_at:"may 3" },
  { span:"c5 r2", bg:"linear-gradient(160deg,#b9a89a,#604f3f)", cap:"the cafe at 4pm", taken_at:"may 2" },
  { span:"c3 r2", bg:"linear-gradient(140deg,#c4cdb9,#6a7560)", cap:"bookstore", taken_at:"may 2" },
  { span:"c4 r2", bg:"linear-gradient(135deg,#bfb9d3,#7a738f)", cap:"april light", taken_at:"apr 28" },
  { span:"c4 r2", bg:"linear-gradient(160deg,#c8a8a0,#7a4f48)", cap:"borges, in the chair", taken_at:"apr 27" },
  { span:"c4 r2", bg:"linear-gradient(140deg,#a8b8c4,#566a7a)", cap:"morning fog", taken_at:"apr 25" },
  { span:"c3 r1", bg:"linear-gradient(135deg,#bfa57f,#6e552f)", cap:"tea steam", taken_at:"apr 22" },
  { span:"c5 r1", bg:"linear-gradient(160deg,#a89dc4,#5f5478)", cap:"campus, late", taken_at:"apr 20" },
];

export { BeautyView };
