"use client";

import React, { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Avatar, Cursor, Empty, GhostBtn, ModePill, ProviderChip, Rule, SectionTitle, Skel, Surface, Tag, useNow } from "./atoms";
import { I } from "./icons";

// Exam — workspace + cheatsheet + 3D knowledge graph

function ExamView({ mode }) {
  const [tab, setTab] = useState("cheatsheet");
  return (
    <div style={{ height:"100%", display:"grid", gridTemplateColumns:"260px 1fr", overflow:"hidden" }}>
      <div style={{ borderRight:"1px solid var(--rule)", padding:"22px 18px", overflow:"auto" }}>
        <div className="mono" style={{ fontSize:11, letterSpacing:".18em", textTransform:"uppercase", color:"var(--ink-35)" }}>workspaces</div>
        <div style={{ marginTop:14 }}>
          {WORKSPACES.map((w, i) => (
            <div key={i} style={{ padding:"12px 12px", borderRadius:8, background: i === 0 ? "var(--ink-06)" : "transparent", marginBottom:4 }}>
              <div style={{ fontFamily:"var(--serif)", fontSize:15, color: i === 0 ? "var(--ink)" : "var(--ink-70)" }}>{w.title}</div>
              <div className="mono" style={{ fontSize:10.5, color:"var(--ink-35)", marginTop:4 }}>{w.sources} sources · {w.artifacts} artifacts</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ overflow:"auto" }}>
        <div style={{ padding:"22px 32px 0", borderBottom:"1px solid var(--rule-soft)" }}>
          <div className="mono" style={{ fontSize:11, letterSpacing:".18em", textTransform:"uppercase", color:"var(--ink-35)" }}>real analysis · ib hl</div>
          <div style={{ fontFamily:"var(--serif)", fontSize:28, marginTop:4 }}><em>compressed for the exam</em></div>
          <div style={{ display:"flex", gap:4, marginTop:18 }}>
            {[["cheatsheet","cheatsheet"],["graph","knowledge graph"],["practice","practice set"],["sim","simulation"]].map(([k, l]) => (
              <button key={k} onClick={() => setTab(k)} style={{
                padding:"10px 14px",
                borderBottom: tab === k ? "2px solid var(--ink)" : "2px solid transparent",
                color: tab === k ? "var(--ink)" : "var(--ink-50)", fontSize:13.5, marginBottom:-1,
              }}>{l}</button>
            ))}
          </div>
        </div>
        {tab === "cheatsheet" && <Cheatsheet mode={mode}/>}
        {tab === "graph" && (
          <div style={{ padding:"24px 32px" }}>
            <Graph3D data={EXAM_GRAPH} height={580}/>
          </div>
        )}
        {tab === "practice" && <Empty>generate a practice set from this workspace's sources.</Empty>}
        {tab === "sim" && <Empty>start a timed simulation when you're ready.</Empty>}
      </div>
    </div>
  );
}

function Cheatsheet({ mode }) {
  const sections = mode === "ulzii"
    ? [
        { t:"Foundations", body:"A real number sequence converges iff it is Cauchy. The completeness of ℝ is the load-bearing axiom; everything in real analysis leans on it." },
        { t:"Theorems & Proofs", body:"Bolzano–Weierstrass. Heine–Borel. Mean Value Theorem. For each: state, sketch, then state again from the sketch." },
        { t:"Dependencies", body:"MVT depends on Rolle. Rolle depends on extreme value. Extreme value depends on compactness. Compactness, in ℝ, is closed and bounded." },
        { t:"Pitfalls", body:"Pointwise vs uniform convergence. Termwise differentiation only under uniform convergence on compact sets." },
        { t:"Worked Examples", body:"f(x) = sin(1/x) on (0,1] is continuous but not uniformly continuous. Show why; the gap is the lesson." },
      ]
    : [
        { t:"3-line Summary", body:"Real analysis = continuity + convergence + compactness. ℝ is complete; sequences are the lever; compact sets are where you can act." },
        { t:"Decision Points", body:"Choose: ε-N or ε-δ. Pointwise or uniform. Open or closed. Each choice is a contract; the proof is whether you keep it." },
        { t:"Action Templates", body:"To prove uniform convergence: bound sup-norm. To prove differentiability: bound difference quotient. To prove compactness: extract a convergent subsequence." },
        { t:"Failure Modes", body:"Forgetting which direction the implication goes. Convergent does not mean Cauchy in metric spaces that aren't complete; in ℝ it does." },
        { t:"Worked Example", body:"Show f(x) = x² is uniformly continuous on [0, 1] but not on ℝ. The compact set is doing all the work." },
      ];
  return (
    <div style={{ maxWidth: 800, margin:"0 auto", padding:"32px" }}>
      {sections.map((s, i) => (
        <div key={i} style={{ borderTop:"1px solid var(--rule)", padding:"24px 0" }}>
          <div className="mono" style={{ fontSize:11, letterSpacing:".14em", textTransform:"uppercase", color: mode === "ulzii" ? "var(--sky)" : "var(--forest)" }}>{s.t}</div>
          <div style={{ fontFamily:"var(--serif)", fontSize:18, lineHeight:1.65, marginTop:10, color:"var(--ink)" }}>{s.body}</div>
        </div>
      ))}
    </div>
  );
}

const WORKSPACES = [
  { title:"Real Analysis · IB HL", sources:7, artifacts:4 },
  { title:"TOK · final essay", sources:12, artifacts:6 },
  { title:"Arabic philosophy", sources:5, artifacts:2 },
];

const EXAM_GRAPH = {
  title:"real analysis · territory",
  regions: [
    { id:"r1", label:"Sequences", color:"#4a8cad" },
    { id:"r2", label:"Continuity", color:"#3a6a51" },
    { id:"r3", label:"Differentiation", color:"#a64f63" },
    { id:"r4", label:"Integration", color:"#8a6a3c" },
    { id:"r5", label:"Topology of ℝ", color:"#6f6aa8" },
  ],
  nodes: [
    { id:"e1", label:"Cauchy sequence", region:"r1", weight:.85 },
    { id:"e2", label:"Bolzano–Weierstrass", region:"r1", weight:.9 },
    { id:"e3", label:"completeness of ℝ", region:"r1", weight:1 },
    { id:"e4", label:"convergence", region:"r1", weight:.7 },
    { id:"e5", label:"continuity", region:"r2", weight:.8 },
    { id:"e6", label:"uniform continuity", region:"r2", weight:.75 },
    { id:"e7", label:"Heine–Borel", region:"r5", weight:.85 },
    { id:"e8", label:"compactness", region:"r5", weight:.95 },
    { id:"e9", label:"open / closed", region:"r5", weight:.65 },
    { id:"e10",label:"derivative", region:"r3", weight:.7 },
    { id:"e11",label:"MVT", region:"r3", weight:.8 },
    { id:"e12",label:"Rolle's theorem", region:"r3", weight:.65 },
    { id:"e13",label:"Riemann integral", region:"r4", weight:.85 },
    { id:"e14",label:"FTC", region:"r4", weight:.9 },
    { id:"e15",label:"sup / inf", region:"r5", weight:.55 },
    { id:"e16",label:"limit point", region:"r5", weight:.5 },
    { id:"e17",label:"sequential criterion", region:"r2", weight:.55 },
    { id:"e18",label:"power series", region:"r1", weight:.6 },
  ],
  edges: [
    {from:"e1",to:"e3", kind:"prereq"},{from:"e2",to:"e3", kind:"prereq"},
    {from:"e2",to:"e8", kind:"supports"},{from:"e7",to:"e8", kind:"supports"},
    {from:"e8",to:"e11", kind:"prereq"},{from:"e12",to:"e11", kind:"prereq"},
    {from:"e10",to:"e11", kind:"prereq"},{from:"e11",to:"e14", kind:"supports"},
    {from:"e13",to:"e14", kind:"prereq"},{from:"e5",to:"e10", kind:"prereq"},
    {from:"e5",to:"e6", kind:"specializes"},{from:"e6",to:"e8", kind:"prereq"},
    {from:"e9",to:"e7", kind:"prereq"},{from:"e15",to:"e3", kind:"prereq"},
    {from:"e16",to:"e9", kind:"specializes"},{from:"e17",to:"e5", kind:"specializes"},
    {from:"e4",to:"e1", kind:"prereq"},{from:"e4",to:"e18", kind:"supports"},
    {from:"e18",to:"e3", kind:"prereq"},{from:"e6",to:"e8", kind:"contrasts"},
  ],
};

export { ExamView };
