"use client";

import React, { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Avatar, Cursor, Empty, GhostBtn, ModePill, ProviderChip, Rule, SectionTitle, Skel, Surface, Tag, useNow } from "./atoms";
import { I } from "./icons";
import { HomeView } from "./home";
import { ChatView } from "./chat";
import { CalendarView } from "./calendar";
import { VaultView } from "./vault";
import { BeautyView } from "./beauty";
import { SignalsView } from "./signals";
import { ExamView } from "./exam";
import { SettingsDrawer } from "./settings";

// Shell — sidebar nav + topbar with theme toggle + active route render

const ROUTES = [
  { k:"home",     label:"home",     ico:"home" },
  { k:"chat",     label:"chat",     ico:"chat" },
  { k:"calendar", label:"calendar", ico:"cal" },
  { k:"vault",    label:"vault",    ico:"vault" },
  { k:"beauty",   label:"beauty",   ico:"beauty" },
  { k:"signals",  label:"signals",  ico:"signal" },
  { k:"exam",     label:"exam",     ico:"exam" },
];

function Shell({ tweaks, setTweak }) {
  const { mode, route, role, theme } = tweaks;
  const setMode = (m) => setTweak("mode", m);
  const setRoute = (r) => setTweak("route", r);
  const setTheme = (t) => setTweak("theme", t);
  const [settings, setSettings] = useState(false);
  const accent = mode === "ulzii" ? "var(--sky)" : "var(--forest)";

  const isBadrushk = role === "badrushk";
  const visibleRoutes = isBadrushk ? ROUTES.filter(r => r.k === "beauty") : ROUTES;
  useEffect(() => { if (isBadrushk && route !== "beauty") setRoute("beauty"); }, [isBadrushk]);

  return (
    <div style={{ display:"grid", gridTemplateColumns:"232px 1fr", height:"100vh", overflow:"hidden", background:"var(--paper)" }}>
      <aside style={{
        background:"var(--paper-2)", borderRight:"1px solid var(--rule)",
        padding:"20px 14px 14px", display:"flex", flexDirection:"column",
      }}>
        {/* Brand */}
        <div style={{ padding:"4px 10px 18px", borderBottom:"1px solid var(--rule-soft)" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{
              width:28, height:28, borderRadius:8, background:"var(--ink)",
              color:"var(--paper)", display:"grid", placeItems:"center",
              fontFamily:"var(--serif)", fontStyle:"italic", fontSize:18, fontWeight:600,
            }}>e</div>
            <div>
              <div style={{ fontFamily:"var(--serif)", fontSize:20, letterSpacing:"-.01em", lineHeight:1, color:"var(--ink)" }}>
                <em>Esui</em>
              </div>
              <div className="mono" style={{ fontSize:9.5, letterSpacing:".18em", textTransform:"uppercase", color:"var(--ink-35)", marginTop:3 }}>
                {isBadrushk ? "viewing as badrushk" : "private workspace"}
              </div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ marginTop:14, display:"flex", flexDirection:"column", gap:1 }}>
          {visibleRoutes.map(r => {
            const active = route === r.k;
            const Ic = I[r.ico];
            return (
              <button key={r.k} onClick={() => setRoute(r.k)} className="row-hover" style={{
                display:"flex", alignItems:"center", gap:11,
                padding:"8px 11px", borderRadius:8, fontSize:13.5,
                color: active ? "var(--ink)" : "var(--ink-50)",
                background: active ? "var(--surface)" : "transparent",
                border: active ? "1px solid var(--rule)" : "1px solid transparent",
                position:"relative", textAlign:"left",
                boxShadow: active ? "var(--shadow-1)" : "none",
              }}>
                {active && <span style={{ position:"absolute", left:-1, top:9, bottom:9, width:2, background: accent, borderRadius:1 }}/>}
                <Ic size={15} sw={1.6} style={{ color: active ? accent : "currentColor" }}/>
                <span style={{ fontStyle: active ? "italic" : "normal", fontFamily: active ? "var(--serif)" : "var(--sans)", fontSize: active ? 15 : 13.5, fontWeight: active ? 500 : 400 }}>{r.label}</span>
              </button>
            );
          })}
        </nav>

        <div style={{ flex:1 }}/>

        {/* Mode mini-toggle */}
        {!isBadrushk && (
          <div style={{ padding:"14px 10px 12px", borderTop:"1px solid var(--rule-soft)" }}>
            <div className="mono" style={{ fontSize:9.5, letterSpacing:".16em", textTransform:"uppercase", color:"var(--ink-35)", marginBottom:8 }}>thinking with</div>
            <div style={{ display:"flex", gap:6 }}>
              <button onClick={() => setMode("ulzii")} style={{
                flex:1, padding:"6px 8px", borderRadius:6, fontSize:12, textAlign:"center",
                background: mode === "ulzii" ? "var(--sky-soft)" : "transparent",
                color: mode === "ulzii" ? "var(--sky-deep)" : "var(--ink-50)",
                border: `1px solid ${mode === "ulzii" ? "var(--sky)" : "var(--rule)"}`,
              }}>ulzii</button>
              <button onClick={() => setMode("obama")} style={{
                flex:1, padding:"6px 8px", borderRadius:6, fontSize:12, textAlign:"center",
                background: mode === "obama" ? "var(--forest-soft)" : "transparent",
                color: mode === "obama" ? "var(--forest-deep)" : "var(--ink-50)",
                border: `1px solid ${mode === "obama" ? "var(--forest)" : "var(--rule)"}`,
              }}>obama</button>
            </div>
          </div>
        )}

        {/* Footer — Esui */}
        <div style={{ padding:"12px 10px", borderTop:"1px solid var(--rule-soft)", display:"flex", alignItems:"center", gap:10 }}>
          <Avatar name={isBadrushk ? "B" : "E"} color={isBadrushk ? "#5a6178" : "var(--ink-2)"} ring="var(--paper)"/>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:13, color:"var(--ink)", fontWeight:500 }}>{isBadrushk ? "Badrushk" : "Esui"}</div>
            <div className="mono" style={{ fontSize:10, color:"var(--ink-35)" }}>{isBadrushk ? "guest" : "esui@private"}</div>
          </div>
          {!isBadrushk && (
            <button onClick={() => setSettings(true)} className="qbtn" data-screen-label="settings" title="Settings"><I.settings size={14}/></button>
          )}
        </div>
      </aside>

      <main style={{ overflow:"hidden", background:"var(--paper)", display:"grid", gridTemplateRows:"auto 1fr" }} data-screen-label={`route-${route}`}>
        {/* Topbar */}
        <div style={{
          display:"flex", alignItems:"center", gap:12,
          padding:"10px 24px", borderBottom:"1px solid var(--rule-soft)",
          background:"var(--paper)",
        }}>
          <Crumbs route={route} mode={mode}/>
          <div style={{ flex:1 }}/>
          {!isBadrushk && (
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="qbtn"
              title={theme === "dark" ? "Switch to paper" : "Switch to navy"}
              style={{ padding:"6px 10px", border:"1px solid var(--rule)", borderRadius:8 }}
            >
              {theme === "dark" ? <I.sun size={14}/> : <I.moon size={14}/>}
              <span className="mono" style={{ fontSize:11, letterSpacing:".06em" }}>
                {theme === "dark" ? "navy" : "paper"}
              </span>
            </button>
          )}
        </div>

        <div style={{ overflow:"hidden", position:"relative" }} key={route} className="fi">
          {route === "home" && <HomeView mode={mode} onNav={setRoute}/>}
          {route === "chat" && <ChatView mode={mode} setMode={setMode}/>}
          {route === "calendar" && <CalendarView mode={mode}/>}
          {route === "vault" && <VaultView mode={mode}/>}
          {route === "beauty" && <BeautyView role={role}/>}
          {route === "signals" && <SignalsView/>}
          {route === "exam" && <ExamView mode={mode}/>}
        </div>
      </main>

      <SettingsDrawer open={settings} onClose={() => setSettings(false)}/>
    </div>
  );
}

function Crumbs({ route, mode }) {
  const labels = {
    home:"Home", chat:"Chat", calendar:"Calendar", vault:"Vault",
    beauty:"Beauty", signals:"Daily signals", exam:"Exam",
  };
  return (
    <div style={{ display:"flex", alignItems:"baseline", gap:10, color:"var(--ink-50)", fontSize:13 }}>
      <span className="mono" style={{ fontSize:11, letterSpacing:".14em", textTransform:"uppercase", color:"var(--ink-35)" }}>esui</span>
      <span style={{ color:"var(--ink-20)" }}>/</span>
      <span style={{ color:"var(--ink)", fontFamily:"var(--serif)", fontStyle:"italic", fontSize:16 }}>{labels[route]}</span>
      {route === "chat" && (
        <span style={{ marginLeft:8 }}><ModePill mode={mode} size="xs"/></span>
      )}
    </div>
  );
}

export { Shell };
