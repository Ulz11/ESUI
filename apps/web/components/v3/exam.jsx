"use client";

import React, { useEffect, useState } from "react";
import { Empty, Skel } from "./atoms";
import { I } from "./icons";
import { api } from "@/lib/api";

// Exam — workspaces, artifacts. Wired to /api/v1/exam.

function ExamView({ mode }) {
  const [workspaces, setWorkspaces] = useState(null);
  const [activeId, setActiveId] = useState(null);
  const [tab, setTab] = useState("cheatsheet");
  const [artifacts, setArtifacts] = useState([]);
  const [loadingArt, setLoadingArt] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    api
      .get("/api/v1/exam/workspaces")
      .then((ws) => {
        setWorkspaces(ws);
        if (ws.length > 0) setActiveId(ws[0].id);
      })
      .catch(() => setWorkspaces([]));
  }, []);

  useEffect(() => {
    if (!activeId) {
      setArtifacts([]);
      return;
    }
    setLoadingArt(true);
    api
      .get(`/api/v1/exam/workspaces/${activeId}/artifacts`)
      .then(setArtifacts)
      .catch(() => setArtifacts([]))
      .finally(() => setLoadingArt(false));
  }, [activeId]);

  const onCreate = async () => {
    const title = window.prompt("workspace title?");
    if (!title) return;
    try {
      const ws = await api.post("/api/v1/exam/workspaces", { title });
      setWorkspaces([ws, ...(workspaces || [])]);
      setActiveId(ws.id);
    } catch {}
  };

  const onGenerate = async (kind) => {
    if (!activeId) return;
    setCreating(true);
    try {
      const a = await api.post(
        `/api/v1/exam/workspaces/${activeId}/generate`,
        { kind, mode },
      );
      // show new artifact at top of list
      setArtifacts([a, ...artifacts]);
    } catch {} finally {
      setCreating(false);
    }
  };

  const activeWS = (workspaces || []).find((w) => w.id === activeId);
  const tabKindMap = {
    cheatsheet: "cheatsheet",
    practice: "practice_set",
    sim: "simulation",
    graph: "knowledge_graph",
  };
  const visibleArtifact = artifacts.find((a) => a.kind === tabKindMap[tab]);

  return (
    <div style={{ height: "100%", display: "grid", gridTemplateColumns: "260px 1fr", overflow: "hidden" }}>
      <div style={{ borderRight: "1px solid var(--rule)", padding: "22px 18px", overflow: "auto" }}>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
          }}
        >
          <div className="mono" style={{ fontSize: 11, letterSpacing: ".18em", textTransform: "uppercase", color: "var(--ink-35)" }}>
            workspaces
          </div>
          <button onClick={onCreate} className="qbtn" title="new workspace">
            <I.plus size={14} />
          </button>
        </div>
        <div style={{ marginTop: 14 }}>
          {workspaces === null ? (
            <Skel w="80%" />
          ) : workspaces.length === 0 ? (
            <div style={{ color: "var(--ink-35)", fontSize: 12, fontStyle: "italic", fontFamily: "var(--serif)", padding: "12px" }}>
              create a workspace, add sources, ask for a cheatsheet.
            </div>
          ) : (
            workspaces.map((w) => (
              <div
                key={w.id}
                onClick={() => setActiveId(w.id)}
                style={{
                  padding: "12px 12px",
                  borderRadius: 8,
                  background: w.id === activeId ? "var(--ink-06)" : "transparent",
                  marginBottom: 4,
                  cursor: "pointer",
                }}
              >
                <div
                  style={{
                    fontFamily: "var(--serif)",
                    fontSize: 15,
                    color: w.id === activeId ? "var(--ink)" : "var(--ink-70)",
                  }}
                >
                  {w.title}
                </div>
                <div className="mono" style={{ fontSize: 10.5, color: "var(--ink-35)", marginTop: 4 }}>
                  {w.subject || "—"}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      <div style={{ overflow: "auto" }}>
        {!activeWS ? (
          <Empty>create a workspace on the left to begin.</Empty>
        ) : (
          <>
            <div style={{ padding: "22px 32px 0", borderBottom: "1px solid var(--rule-soft)" }}>
              <div className="mono" style={{ fontSize: 11, letterSpacing: ".18em", textTransform: "uppercase", color: "var(--ink-35)" }}>
                {activeWS.subject || "exam workspace"}
              </div>
              <div style={{ fontFamily: "var(--serif)", fontSize: 28, marginTop: 4 }}>
                <em>{activeWS.title}</em>
              </div>
              <div style={{ display: "flex", gap: 4, marginTop: 18 }}>
                {[
                  ["cheatsheet", "cheatsheet"],
                  ["graph", "knowledge graph"],
                  ["practice", "practice set"],
                  ["sim", "simulation"],
                ].map(([k, l]) => (
                  <button
                    key={k}
                    onClick={() => setTab(k)}
                    style={{
                      padding: "10px 14px",
                      borderBottom: tab === k ? "2px solid var(--ink)" : "2px solid transparent",
                      color: tab === k ? "var(--ink)" : "var(--ink-50)",
                      fontSize: 13.5,
                      marginBottom: -1,
                    }}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ padding: "24px 32px" }}>
              {loadingArt ? (
                <Skel w="60%" />
              ) : visibleArtifact ? (
                <ArtifactRenderer artifact={visibleArtifact} mode={mode} />
              ) : (
                <Empty>
                  <div style={{ marginBottom: 14 }}>
                    no {tab} for this workspace yet.
                  </div>
                  <button
                    onClick={() => onGenerate(tabKindMap[tab])}
                    disabled={creating}
                    style={{
                      padding: "8px 16px",
                      background: "var(--ink)",
                      color: "var(--paper)",
                      borderRadius: 100,
                      fontSize: 13,
                      fontStyle: "normal",
                      fontFamily: "var(--sans)",
                    }}
                  >
                    {creating ? "generating…" : `generate ${tab}`}
                  </button>
                </Empty>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ArtifactRenderer({ artifact, mode }) {
  if (artifact.kind === "cheatsheet") {
    const sections = artifact.payload?.sections || [];
    return (
      <div style={{ maxWidth: 800, margin: "0 auto" }}>
        {sections.map((s, i) => (
          <div key={i} style={{ borderTop: "1px solid var(--rule)", padding: "24px 0" }}>
            <div
              className="mono"
              style={{
                fontSize: 11,
                letterSpacing: ".14em",
                textTransform: "uppercase",
                color: mode === "ulzii" ? "var(--sky)" : "var(--forest)",
              }}
            >
              {s.title}
            </div>
            <div style={{ fontFamily: "var(--serif)", fontSize: 18, lineHeight: 1.65, marginTop: 10, color: "var(--ink)" }}>
              {(s.items || []).map((it, j) => (
                <div key={j} style={{ marginTop: j === 0 ? 0 : 14 }}>
                  <strong>{it.name}</strong>
                  <div style={{ color: "var(--ink-70)", marginTop: 4, whiteSpace: "pre-wrap" }}>
                    {it.body_md}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }
  if (artifact.kind === "knowledge_graph") {
    const data = artifact.payload || {};
    return (
      <div style={{ color: "var(--ink-50)", fontStyle: "italic", fontFamily: "var(--serif)" }}>
        {data.nodes?.length ?? 0} concepts across {data.regions?.length ?? 0} regions.
        (3D visualization coming.)
      </div>
    );
  }
  return (
    <pre style={{ whiteSpace: "pre-wrap", fontFamily: "var(--serif)", fontSize: 14, color: "var(--ink-70)" }}>
      {JSON.stringify(artifact.payload, null, 2)}
    </pre>
  );
}

export { ExamView };
