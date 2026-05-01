"use client";

import React, { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Avatar, Cursor, Empty, GhostBtn, ModePill, ProviderChip, Rule, SectionTitle, Skel, Surface, Tag, useNow } from "./atoms";
import { I } from "./icons";

// Vault — 4 tabs + Graph

function VaultView({ mode }) {
  const [tab, setTab] = useState("notes");
  return (
    <div style={{ height:"100%", display:"grid", gridTemplateRows:"auto 1fr", overflow:"hidden" }}>
      <div style={{ padding:"22px 32px 0", borderBottom:"1px solid var(--rule-soft)" }}>
        <div style={{ display:"flex", alignItems:"baseline", justifyContent:"space-between" }}>
          <div>
            <div className="mono" style={{ fontSize:11, letterSpacing:".18em", textTransform:"uppercase", color:"var(--ink-35)" }}>vault</div>
            <div style={{ fontFamily:"var(--serif)", fontSize:28, marginTop:4 }}><em>everything she's keeping</em></div>
          </div>
          <div style={{ display:"flex", gap:6, alignItems:"center" }}>
            <div style={{ display:"flex", alignItems:"center", gap:6, padding:"6px 12px", border:"1px solid var(--rule)", borderRadius:100, fontSize:12.5, color:"var(--ink-50)", width:240 }}>
              <I.search size={13}/><span style={{ fontStyle:"italic", fontFamily:"var(--serif)" }}>search this tab…</span>
            </div>
          </div>
        </div>
        <div style={{ display:"flex", gap:4, marginTop:18 }}>
          {[
            ["ideas", "ideas", "37"],
            ["notes", "notes", "82"],
            ["chat",  "chat history", "14"],
            ["art",   "project artifacts", "23"],
            ["graph", "graph", null],
          ].map(([k, l, c]) => (
            <button key={k} onClick={() => setTab(k)} style={{
              padding:"10px 14px", borderBottom: tab === k ? "2px solid var(--ink)" : "2px solid transparent",
              color: tab === k ? "var(--ink)" : "var(--ink-50)", fontSize:13.5, marginBottom:-1,
              display:"inline-flex", alignItems:"baseline", gap:8,
            }}>
              {l}{c && <span className="mono" style={{ fontSize:10.5, color:"var(--ink-35)" }}>{c}</span>}
            </button>
          ))}
        </div>
      </div>
      <div style={{ overflow:"auto" }}>
        {tab === "ideas" && <IdeasList/>}
        {tab === "notes" && <NotesView/>}
        {tab === "chat" && <ChatHistoryList/>}
        {tab === "art" && <ArtifactsList/>}
        {tab === "graph" && <VaultGraph/>}
      </div>
    </div>
  );
}

function IdeasList() {
  return (
    <div style={{ maxWidth: 760, margin:"0 auto", padding:"32px" }}>
      <textarea placeholder="capture a thought…" rows={2}
        style={{ width:"100%", padding:"14px 16px", border:"1px solid var(--rule)", borderRadius:"var(--r-md)", fontFamily:"var(--serif)", fontSize:16, fontStyle:"italic", color:"var(--ink-50)", background:"var(--surface)" }}/>
      <div style={{ marginTop:24 }}>
        {IDEAS.map((i, idx) => (
          <div key={idx} style={{ padding:"14px 0", borderTop: idx === 0 ? "none" : "1px solid var(--rule-soft)", display:"grid", gridTemplateColumns:"1fr auto", gap:14 }}>
            <div>
              <div style={{ fontFamily:"var(--serif)", fontSize:16, color:"var(--ink)" }}>{i.title}</div>
              <div style={{ fontFamily:"var(--serif)", fontSize:14, color:"var(--ink-50)", marginTop:4, lineHeight:1.5 }}>{i.preview}</div>
            </div>
            <div className="mono" style={{ fontSize:11, color:"var(--ink-35)" }}>{i.ago}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function NotesView() {
  return (
    <div style={{ display:"grid", gridTemplateColumns:"280px 1fr", height:"100%", overflow:"hidden" }}>
      <div style={{ borderRight:"1px solid var(--rule)", overflow:"auto", padding:"18px 14px" }}>
        {NOTES.map((n, i) => (
          <div key={i} style={{ padding:"10px 12px", borderRadius:8, background: i === 0 ? "var(--ink-06)" : "transparent", marginBottom:4 }}>
            <div style={{ fontSize:13.5, color:"var(--ink)" }}>{n.title}</div>
            <div className="mono" style={{ fontSize:10.5, color:"var(--ink-35)", marginTop:3 }}>{n.ago} · {n.kind}</div>
          </div>
        ))}
      </div>
      <div style={{ overflow:"auto", padding:"40px 56px", maxWidth: 720, width:"100%" }}>
        <div className="mono" style={{ fontSize:11, letterSpacing:".14em", textTransform:"uppercase", color:"var(--ink-35)" }}>note · tok</div>
        <div style={{ fontFamily:"var(--serif)", fontSize:34, lineHeight:1.15, letterSpacing:"-.015em", marginTop:10 }}>
          <em>On the difference between rigor and pedantry</em>
        </div>
        <div style={{ display:"flex", gap:6, marginTop:16 }}>
          <Tag>TOK</Tag><Tag>mathematics</Tag><Tag ai>epistemology</Tag><Tag ai>su</Tag>
        </div>
        <div style={{ marginTop:32, fontFamily:"var(--serif)", fontSize:18, lineHeight:1.7, color:"var(--ink)" }}>
          <p>Rigor is local consent. You ask each step whether the next is licit, and the proof responds yes, yes, yes. Pedantry is consent that has forgotten what it was assenting to.</p>
          <p style={{ marginTop:18 }}>The test, taken from Lakatos and Su both, is whether you can sketch the proof in five sentences. If you cannot, you have verified but not understood.</p>
          <p style={{ marginTop:18, paddingLeft:18, borderLeft:"2px solid var(--sky)", color:"var(--ink-70)", fontStyle:"italic" }}>
            "Mathematics is for human flourishing." — but flourishing requires that the steps be felt, not merely audited.
          </p>
        </div>
      </div>
    </div>
  );
}

function ChatHistoryList() {
  return (
    <div style={{ maxWidth: 920, margin:"0 auto", padding:"32px" }}>
      {ARCHIVED.map((a, i) => (
        <div key={i} style={{ padding:"18px 0", borderTop: i === 0 ? "none" : "1px solid var(--rule-soft)", display:"grid", gridTemplateColumns:"auto 1fr auto auto", gap:16, alignItems:"baseline" }}>
          <ModePill mode={a.mode} size="xs"/>
          <div>
            <div style={{ fontFamily:"var(--serif)", fontSize:17 }}>{a.title}</div>
            <div style={{ fontSize:13, color:"var(--ink-50)", marginTop:4, fontFamily:"var(--serif)", fontStyle:"italic" }}>{a.preview}</div>
          </div>
          <div className="mono" style={{ fontSize:11.5, color:"var(--ink-35)" }}>{a.msgs} msgs</div>
          <div className="mono" style={{ fontSize:11.5, color:"var(--ink-35)" }}>{a.date}</div>
        </div>
      ))}
    </div>
  );
}

function ArtifactsList() {
  return (
    <div style={{ maxWidth: 1080, margin:"0 auto", padding:"32px", display:"grid", gridTemplateColumns:"1fr 1fr", gap:18 }}>
      {ARTIFACTS.map((a, i) => (
        <Surface key={i} style={{ padding:"20px 22px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <span className="chip" style={{ background:"transparent", border:"1px solid var(--rule)" }}>{a.kind.replace(/_/g," ")}</span>
            <span className="mono" style={{ fontSize:10.5, color:"var(--ink-35)", marginLeft:"auto" }}>{a.date}</span>
          </div>
          <div style={{ fontFamily:"var(--serif)", fontSize:18, marginTop:12 }}>{a.title}</div>
          <div style={{ fontFamily:"var(--serif)", fontStyle:"italic", color:"var(--ink-50)", fontSize:14, marginTop:8, lineHeight:1.55 }}>{a.preview}</div>
          <div style={{ marginTop:14, display:"flex", gap:6 }}>
            {a.tags.map(t => <Tag key={t}>{t}</Tag>)}
          </div>
        </Surface>
      ))}
    </div>
  );
}

function VaultGraph() {
  return (
    <div style={{ padding:"24px 32px 32px" }}>
      <div style={{ display:"flex", alignItems:"baseline", justifyContent:"space-between", marginBottom:14 }}>
        <div style={{ fontFamily:"var(--serif)", fontSize:20 }}><em>the constellation of her own thinking</em></div>
        <div className="mono" style={{ fontSize:11, color:"var(--ink-35)" }}>156 nodes · 312 edges · last updated 2h ago</div>
      </div>
      <Graph3D data={VAULT_GRAPH} height={580}/>
      <div style={{ marginTop:14, display:"flex", gap:18, fontSize:11.5, color:"var(--ink-50)", fontFamily:"var(--mono)" }}>
        <Legend c="#4a8cad" l="note · reference"/>
        <Legend c="#a64f63" l="idea"/>
        <Legend c="#8a6a3c" l="journal"/>
        <Legend c="#3a6a51" l="research · artifact"/>
        <Legend c="#6f6aa8" l="draft"/>
        <Legend c="#5a6178" l="chat history"/>
        <span style={{ marginLeft:"auto" }}>drag to orbit · click to focus · idle auto-rotates</span>
      </div>
    </div>
  );
}
function Legend({ c, l }) {
  return <span style={{ display:"inline-flex", alignItems:"center", gap:6 }}><span style={{ width:8, height:8, borderRadius:4, background:c }}/>{l}</span>;
}

const IDEAS = [
  { title:"a calendar that respects energy curves", preview:"Mornings as solitary, afternoons as collaborative, evenings as receptive. The grid should know.", ago:"2h" },
  { title:"single-button focus mode", preview:"One press, all surfaces fade except the current one. Reverse with the same press.", ago:"yest" },
  { title:"borges & the encyclopaedia", preview:"What does a map mean once it is the territory.", ago:"sun" },
  { title:"the vault should breathe", preview:"On open, the recent items rise; the cold ones recede. A quiet kind of memory.", ago:"4d" },
  { title:"a private diary for tuesdays", preview:"Tuesdays I write by hand. The vault should know not to pester.", ago:"6d" },
];

const NOTES = [
  { title:"On the difference between rigor and pedantry", ago:"2h", kind:"tok" },
  { title:"Weil — attention as generosity", ago:"sun", kind:"reading" },
  { title:"draft · esui announcement post", ago:"3d", kind:"draft" },
  { title:"Ibn Rushd on the harmony of philosophy", ago:"5d", kind:"reference" },
  { title:"morning pages · april", ago:"1w", kind:"journal" },
];

const ARCHIVED = [
  { mode:"obama", title:"market: personal AI workspaces", preview:"Mem, Reflect, Eden, Granola. The seam is durability of memory…", msgs:48, date:"sun" },
  { mode:"ulzii", title:"weil & attention", preview:"Attention as the rarest form of generosity…", msgs:21, date:"sun" },
  { mode:"obama", title:"tech stack · planner service", preview:"Edge functions vs Sidekiq vs temporal…", msgs:32, date:"4d" },
  { mode:"ulzii", title:"borges & the encyclopaedia", preview:"What does it mean for a map to fit its territory…", msgs:18, date:"6d" },
];

const ARTIFACTS = [
  { kind:"market_research", title:"personal AI workspaces · q2", preview:"Mem, Reflect, Eden, Granola, Rewind. Seams: durable memory, latency, voice.", tags:["research","competitive"], date:"30m" },
  { kind:"three_scenario_sim", title:"vault search architecture", preview:"Conservative tsvector / base pgvector hybrid / aggressive vespa+rerank.", tags:["infra","decision"], date:"yest" },
  { kind:"knowledge_map", title:"areas of knowledge · TOK", preview:"Voronoi regions: math, natural sciences, history, indigenous knowledge…", tags:["TOK"], date:"sun" },
  { kind:"tok_exploration", title:"the knowledge question hiding in 'rigor'", preview:"What does it mean to verify a claim without inheriting its assumptions?", tags:["TOK","epistemology"], date:"sun" },
  { kind:"decision_memo", title:"writeups: notion vs in-vault", preview:"Recommendation: in-vault. Reasoning: durability, search, single source of truth.", tags:["meta"], date:"4d" },
  { kind:"mind_map", title:"esui · feature tree", preview:"Six routes, three layers (capture, think, recall).", tags:["product"], date:"6d" },
];

// Graph data — vault constellation
const VAULT_GRAPH = {
  title: "vault · graph view",
  nodes: [
    { id:"n1", title:"On rigor and pedantry", content_type:"note", weight:.8 },
    { id:"n2", title:"Weil · attention", content_type:"note", weight:.7 },
    { id:"n3", title:"market · AI workspaces", content_type:"project_artifact", weight:.9 },
    { id:"n4", title:"three-scenario · vault search", content_type:"project_artifact", weight:.85 },
    { id:"n5", title:"knowledge map · TOK", content_type:"project_artifact", weight:1 },
    { id:"n6", title:"morning pages · april", content_type:"journal", weight:.5 },
    { id:"n7", title:"Ibn Rushd", content_type:"reference", weight:.6 },
    { id:"n8", title:"Borges · encyclopaedia", content_type:"idea", weight:.55 },
    { id:"n9", title:"calendar respects energy", content_type:"idea", weight:.5 },
    { id:"n10",title:"draft · esui announcement", content_type:"draft", weight:.6 },
    { id:"n11",title:"weil & attention thread", content_type:"chat_history", weight:.55 },
    { id:"n12",title:"Carson · hours like sand", content_type:"reference", weight:.55 },
    { id:"n13",title:"Lakatos · proofs and refutations", content_type:"reference", weight:.7 },
    { id:"n14",title:"Su · for human flourishing", content_type:"reference", weight:.7 },
    { id:"n15",title:"vault breathes", content_type:"idea", weight:.45 },
    { id:"n16",title:"single-button focus", content_type:"idea", weight:.4 },
    { id:"n17",title:"esui feature tree", content_type:"project_artifact", weight:.65 },
    { id:"n18",title:"ESUI · principles", content_type:"note", weight:.7 },
    { id:"n19",title:"planner UX sketch", content_type:"draft", weight:.55 },
    { id:"n20",title:"signal · Laozi 64", content_type:"reference", weight:.4 },
    { id:"n21",title:"signal · Carson", content_type:"reference", weight:.4 },
    { id:"n22",title:"thread · proof understanding", content_type:"chat_history", weight:.6 },
    { id:"n23",title:"thread · planner service", content_type:"chat_history", weight:.55 },
    { id:"n24",title:"thread · borges encyclopaedia", content_type:"chat_history", weight:.5 },
    { id:"n25",title:"reading · attention", content_type:"note", weight:.55 },
  ],
  edges: [
    {from:"n1",to:"n13"},{from:"n1",to:"n14"},{from:"n1",to:"n22"},{from:"n1",to:"n5"},
    {from:"n2",to:"n11"},{from:"n2",to:"n25"},{from:"n2",to:"n12"},
    {from:"n3",to:"n4"},{from:"n3",to:"n17"},{from:"n3",to:"n18"},
    {from:"n4",to:"n23"},{from:"n4",to:"n17"},
    {from:"n5",to:"n13"},{from:"n5",to:"n14"},{from:"n5",to:"n7"},{from:"n5",to:"n8"},
    {from:"n6",to:"n2"},{from:"n6",to:"n12"},
    {from:"n7",to:"n5"},{from:"n7",to:"n8"},
    {from:"n8",to:"n24"},{from:"n8",to:"n5"},
    {from:"n9",to:"n19"},{from:"n9",to:"n18"},
    {from:"n10",to:"n18"},{from:"n10",to:"n3"},
    {from:"n11",to:"n22"},{from:"n12",to:"n25"},
    {from:"n13",to:"n22"},{from:"n14",to:"n22"},
    {from:"n15",to:"n18"},{from:"n16",to:"n18"},
    {from:"n17",to:"n18"},{from:"n19",to:"n18"},
    {from:"n20",to:"n6"},{from:"n21",to:"n12"},
  ],
};

export { VaultView, VAULT_GRAPH };
