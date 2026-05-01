"use client";

import React, { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Avatar, Cursor, Empty, GhostBtn, ModePill, ProviderChip, Rule, SectionTitle, Skel, Surface, Tag, useNow } from "./atoms";
import { I } from "./icons";

// — Chat surface — Eden-calm conversation w/ mode toggle, tool cards, citations

function ChatView({ mode, setMode }) {
  const [draft, setDraft] = useState("");
  const [streaming, setStreaming] = useState(true);
  const [streamedLen, setStreamedLen] = useState(0);
  const isU = mode === "ulzii";
  const accent = isU ? "var(--sky)" : "var(--forest)";

  // Simulated streaming
  useEffect(() => {
    if (!streaming) return;
    const target = STREAMING_TEXT[mode].length;
    if (streamedLen >= target) { setStreaming(false); return; }
    const id = setTimeout(() => setStreamedLen(l => Math.min(target, l + 4)), 24);
    return () => clearTimeout(id);
  }, [streaming, streamedLen, mode]);

  // Reset when mode toggles in active stream
  useEffect(() => { setStreamedLen(0); setStreaming(true); }, [mode]);

  const composerHint = isU ? "what would you like to understand?" : "what are we shipping or deciding?";
  const affordances = isU
    ? ["sketch the territory", "open a knowledge question", "bridge to another field"]
    : ["run 3-scenario sim", "propose tech stack", "market research"];

  return (
    <div style={{ height:"100%", display:"grid", gridTemplateColumns:"260px 1fr", overflow:"hidden" }}>
      {/* Conversation rail */}
      <div style={{ borderRight:"1px solid var(--rule)", overflow:"auto", padding:"22px 14px" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 8px 14px" }}>
          <div style={{ fontSize:11, letterSpacing:".14em", textTransform:"uppercase", color:"var(--ink-50)" }}>conversations</div>
          <button className="qbtn" title="new"><I.plus size={14}/></button>
        </div>
        {THREADS.map((t, i) => (
          <div key={i} style={{
            padding:"10px 10px", borderRadius:8, marginBottom:2, cursor:"pointer",
            background: i === 0 ? "var(--ink-06)" : "transparent",
          }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
              <ModePill mode={t.mode} size="xs"/>
              <span className="mono" style={{ fontSize:10.5, color:"var(--ink-35)", marginLeft:"auto" }}>{t.ago}</span>
            </div>
            <div style={{ fontSize:13, color: i === 0 ? "var(--ink)" : "var(--ink-70)", lineHeight:1.35 }}>{t.title}</div>
            <div style={{ fontSize:11.5, color:"var(--ink-35)", marginTop:3, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{t.preview}</div>
          </div>
        ))}
      </div>

      {/* Conversation */}
      <div style={{ display:"grid", gridTemplateRows:"auto 1fr auto", overflow:"hidden", background:"var(--surface)" }}>
        {/* Header */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"18px 32px", borderBottom:"1px solid var(--rule-soft)" }}>
          <div>
            <div style={{ fontFamily:"var(--serif)", fontSize:19, color:"var(--ink)" }}><em>the way of knowing in mathematical proof</em></div>
            <div style={{ fontSize:11.5, color:"var(--ink-35)", marginTop:2, fontFamily:"var(--mono)", letterSpacing:".04em" }}>started 2h ago · 12 messages · mixed mode</div>
          </div>
          <div style={{ display:"flex", gap:6 }}>
            <button className="qbtn"><I.archive size={13}/> archive thread</button>
            <button className="qbtn"><I.dots size={14}/></button>
          </div>
        </div>

        {/* Timeline */}
        <div style={{ overflow:"auto", padding:"32px 0" }}>
          <div style={{ maxWidth: 720, margin:"0 auto", padding:"0 32px", display:"flex", flexDirection:"column", gap:36 }}>

            {/* User msg */}
            <div className="fu" style={{ alignSelf:"flex-end", maxWidth: 540 }}>
              <div style={{ fontSize:14.5, color:"var(--ink-70)", lineHeight:1.55, padding:"10px 14px", background:"var(--ink-06)", borderRadius:"14px 14px 4px 14px" }}>
                I keep getting stuck on what counts as <em>understanding</em> a proof — versus just being able to verify each step. is there a useful frame here from TOK?
              </div>
              <div style={{ fontSize:11, color:"var(--ink-35)", textAlign:"right", marginTop:4, fontFamily:"var(--mono)" }}>2:14 pm</div>
            </div>

            {/* AI msg — streaming */}
            <div className="fu">
              <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
                <ModePill mode="ulzii"/>
                <ProviderChip provider="opus" intent="deep" model="claude-opus-4-1-20250805"/>
              </div>
              <div className="serif" style={{ fontSize:17, lineHeight:1.62, color:"var(--ink)", letterSpacing:"-.005em" }}>
                {STREAMING_TEXT[mode].slice(0, streamedLen)}
                {streaming && <Cursor/>}
              </div>

              {/* Tool-use card: vault pin suggestion */}
              {!streaming && isU && (
                <PinSuggestionCard
                  title="rigor vs. pedantry — the verification trap"
                  preview="To verify is to grant local consent. To understand is to know which step you could replace, and what would survive."
                  tags={["TOK", "mathematics", "epistemology"]}
                />
              )}

              {/* Tool-use card: artifact suggestion */}
              {!streaming && !isU && (
                <ArtifactSuggestionCard
                  kind="three_scenario_sim"
                  title="three-scenario sim · vault search architecture"
                />
              )}

              {/* Citations */}
              {!streaming && (
                <div style={{ marginTop:18, display:"flex", flexWrap:"wrap", gap:14, fontSize:12, color:"var(--ink-50)", fontFamily:"var(--mono)" }}>
                  <a><sup style={{ color: accent, marginRight:3 }}>[1]</sup> mathematics for human flourishing · su</a>
                  <a><sup style={{ color: accent, marginRight:3 }}>[2]</sup> proofs and refutations · lakatos</a>
                  <a><sup style={{ color: accent, marginRight:3 }}>[3]</sup> stanford encyclopedia · mathematical understanding</a>
                </div>
              )}

              {/* Hover actions */}
              <div style={{ marginTop:14, display:"flex", gap:8, opacity: streaming ? 0 : 1, transition:"opacity .3s" }}>
                <button className="qbtn"><I.copy size={12}/> copy</button>
                <button className="qbtn"><I.pin size={12}/> cite</button>
                <button className="qbtn"><I.archive size={12}/> archive thread to vault</button>
              </div>
            </div>

            {streaming && (
              <button onClick={() => { setStreamedLen(STREAMING_TEXT[mode].length); setStreaming(false); }}
                style={{ alignSelf:"center", padding:"6px 14px", fontSize:12, color:"var(--ink-50)", border:"1px solid var(--rule)", borderRadius:100 }}>
                stop
              </button>
            )}
          </div>
        </div>

        {/* Composer */}
        <div style={{ padding:"16px 32px 24px", borderTop:"1px solid var(--rule-soft)", background:"var(--paper)" }}>
          <div style={{ maxWidth: 720, margin:"0 auto" }}>
            {/* Affordances when empty */}
            {!draft && !streaming && (
              <div className="fu" style={{ display:"flex", gap:8, marginBottom:12 }}>
                {affordances.map(a => (
                  <button key={a} className="qbtn" style={{ border:"1px solid var(--rule)", color:"var(--ink-50)", fontStyle:"italic", fontFamily:"var(--serif)", fontSize:13 }}
                    onClick={() => setDraft(a + " — ")}
                  >{a}</button>
                ))}
              </div>
            )}
            <Surface style={{ padding:"14px 16px", borderColor: draft ? accent : "var(--rule)" }}>
              <textarea value={draft} onChange={e => setDraft(e.target.value)} rows={2} placeholder={composerHint}
                style={{ width:"100%", resize:"none", fontFamily:"var(--serif)", fontSize:16, lineHeight:1.5, color:"var(--ink)", fontStyle: draft ? "normal" : "italic" }}/>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:10 }}>
                {/* Mode toggle */}
                <button onClick={() => setMode(isU ? "obama" : "ulzii")}
                  title="cmd / to swap"
                  style={{
                    display:"inline-flex", alignItems:"center", gap:8,
                    padding:"5px 11px 5px 8px", borderRadius:100,
                    border:`1px solid ${isU ? "var(--sky)" : "var(--forest)"}`,
                    background: isU ? "var(--sky-soft)" : "var(--forest-soft)",
                    fontSize:13, color: isU ? "var(--sky-deep)" : "var(--forest-deep)",
                  }}>
                  <span style={{ width:7, height:7, borderRadius:4, background: accent }}/>
                  {isU ? "Ulzii" : "Obama"}
                  <span className="mono" style={{ fontSize:10, opacity:.6 }}>⌘/</span>
                </button>
                <span style={{ fontFamily:"var(--mono)", fontSize:11, color:"var(--ink-35)", marginLeft:8 }}>
                  {isU ? "TOK · teacher · growth" : "tech · business · founder"}
                </span>
                <div style={{ flex:1 }}/>
                <span className="mono" style={{ fontSize:11, color:"var(--ink-35)" }}>⌘⏎</span>
                <button style={{
                  width:32, height:32, borderRadius:16, background: accent, color:"white",
                  display:"grid", placeItems:"center",
                }}><I.send size={14} sw={2}/></button>
              </div>
            </Surface>
          </div>
        </div>
      </div>
    </div>
  );
}

function PinSuggestionCard({ title, preview, tags }) {
  return (
    <div className="fu" style={{
      marginTop:18, padding:"14px 16px", borderRadius:"var(--r-md)",
      borderLeft:"2px solid var(--sky)", background: "var(--sky-soft)",
    }}>
      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
        <I.pin size={12} style={{ color:"var(--sky-deep)" }}/>
        <span className="mono" style={{ fontSize:10, letterSpacing:".14em", textTransform:"uppercase", color:"var(--sky-deep)" }}>vault · suggested</span>
      </div>
      <div style={{ fontFamily:"var(--serif)", fontSize:16, marginTop:6, color:"var(--ink)" }}>{title}</div>
      <div style={{ fontFamily:"var(--serif)", fontSize:14, lineHeight:1.5, color:"var(--ink-70)", marginTop:6, fontStyle:"italic" }}>{preview}</div>
      <div style={{ marginTop:10, display:"flex", alignItems:"center", gap:6 }}>
        {tags.map(t => <Tag key={t}>{t}</Tag>)}
        <div style={{ flex:1 }}/>
        <button className="qbtn" style={{ color:"var(--sky-deep)", fontWeight:500 }}>save to vault</button>
        <button className="qbtn">dismiss</button>
      </div>
    </div>
  );
}

function ArtifactSuggestionCard({ kind, title }) {
  return (
    <div className="fu" style={{
      marginTop:18, padding:"16px 18px", borderRadius:"var(--r-md)",
      borderLeft:"2px solid var(--forest)", background:"var(--forest-soft)",
    }}>
      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
        <I.sparkle size={12} style={{ color:"var(--forest-deep)" }}/>
        <span className="mono" style={{ fontSize:10, letterSpacing:".14em", textTransform:"uppercase", color:"var(--forest-deep)" }}>artifact · {kind.replace(/_/g," ")}</span>
      </div>
      <div style={{ fontFamily:"var(--serif)", fontSize:17, marginTop:6, color:"var(--ink)" }}>{title}</div>
      <div style={{ marginTop:14, display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10 }}>
        {[
          { k:"conservative", v:"reuse Postgres tsvector. one week, low risk. ceiling at ~10k docs." },
          { k:"base",         v:"add pgvector + hybrid. two weeks. solid through ~100k docs." },
          { k:"aggressive",   v:"vespa or qdrant + reranker. four weeks. unbounded; ops cost up." },
        ].map(c => (
          <div key={c.k} style={{ padding:"10px 12px", background:"var(--surface)", borderRadius:8, border:"1px solid var(--rule)" }}>
            <div className="mono" style={{ fontSize:10, letterSpacing:".12em", textTransform:"uppercase", color:"var(--forest-deep)" }}>{c.k}</div>
            <div style={{ fontFamily:"var(--serif)", fontSize:13.5, lineHeight:1.45, color:"var(--ink-70)", marginTop:4, fontStyle:"italic" }}>{c.v}</div>
          </div>
        ))}
      </div>
      <div style={{ marginTop:12, display:"flex", alignItems:"center", gap:6 }}>
        <Tag>research</Tag><Tag>infra</Tag><Tag ai>auto-tag</Tag>
        <div style={{ flex:1 }}/>
        <button className="qbtn" style={{ color:"var(--forest-deep)", fontWeight:500 }}>save to vault</button>
        <button className="qbtn">dismiss</button>
      </div>
    </div>
  );
}

const THREADS = [
  { mode:"ulzii", title:"the way of knowing in mathematical proof", preview:"Verification grants local consent. Understanding…", ago:"2h" },
  { mode:"obama", title:"three-scenario sim · vault search", preview:"Conservative: Postgres tsvector. Base: pgvector + …", ago:"yest" },
  { mode:"ulzii", title:"weil & attention",                  preview:"Attention as the rarest form of generosity…", ago:"sun" },
  { mode:"obama", title:"market: personal AI workspaces",     preview:"Mem, Reflect, Eden, Granola. The seam is…", ago:"sun" },
  { mode:"ulzii", title:"borges & the encyclopaedia",         preview:"What does it mean for a map to fit its territory…", ago:"3d" },
  { mode:"obama", title:"tech stack · planner service",       preview:"Edge functions vs Sidekiq vs temporal. Tradeoffs…", ago:"4d" },
  { mode:"ulzii", title:"Carson on grief and hours",          preview:"Hours, like sand, like rain, like…", ago:"6d" },
];

const STREAMING_TEXT = {
  ulzii: "There's a useful split here that lives at the heart of TOK: a proof gives you two things, and they aren't the same. The first is consent — a chain of moves where each move is locally licit. You can audit it line by line and find no fault. The second, the one that's slipperier, is what we'd call understanding: knowing which steps are essential and which are scaffolding, knowing what would still hold if you swapped a hypothesis for its weaker cousin, knowing what the proof says about the kind of objects involved. Lakatos's word for the gap is monster-barring. Su, more humanely, calls the second register flourishing.\n\nA good test: can you tell me, without re-reading, what would break if I removed the assumption that f is continuous? If yes, you understand. If you'd have to walk the proof again, you've verified.",
  obama: "Three frames, ranked by leverage. (1) Don't optimize for the proof; optimize for the property. The proof is the artifact you ship today; the property is what you defend in review next quarter. (2) Verification scales. Understanding doesn't — it's the bottleneck on every system that grows in scope. Spend your scarce attention on the deltas: which assumptions are load-bearing, which are convenient. (3) The base case for understanding is being able to sketch the proof from the property without writing it down. If you can't, you have a debt; log it.\n\nMy recommendation: treat 'understood' as a status. Mark proofs as verified, understood, owned. Verified gets you to ship. Understood gets you to defend. Owned gets you to extend.",
};

export { ChatView };
