"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import type { ArtifactKind, ExamArtifact, ExamWorkspace, Mode } from "@/lib/types";

const KIND: Record<
  ArtifactKind,
  { label: string; color: string; icon: string }
> = {
  cheatsheet: { label: "Cheatsheet", color: "#5b9ab8", icon: "≡" },
  practice_set: { label: "Practice Set", color: "#3e6f54", icon: "◎" },
  concept_map: { label: "Concept Map", color: "#8b6fba", icon: "◈" },
  knowledge_graph: { label: "Knowledge Graph", color: "#b5893a", icon: "⬡" },
  simulation: { label: "Simulation", color: "#c0534d", icon: "◷" },
};

type View = "list" | "workspace" | "artifact";

type ServerArtifact = {
  id: string;
  workspace_id: string;
  kind: string;
  title: string;
  payload: Record<string, unknown>;
  status: string;
  error: string | null;
  generated_in_mode: string | null;
  generated_by_model: string | null;
  created_at: string;
};

export function ExamWidget({ mode }: { mode: Mode }) {
  const [view, setView] = useState<View>("list");
  const [workspaces, setWorkspaces] = useState<ExamWorkspace[]>([]);
  const [activeWS, setActiveWS] = useState<ExamWorkspace | null>(null);
  const [artifacts, setArtifacts] = useState<ServerArtifact[]>([]);
  const [activeArt, setActiveArt] = useState<ServerArtifact | null>(null);
  const [kind, setKind] = useState<ArtifactKind>("cheatsheet");
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    api
      .get<ExamWorkspace[]>("/api/v1/exam/workspaces?limit=50")
      .then(setWorkspaces)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!activeWS) return;
    api
      .get<ServerArtifact[]>(
        `/api/v1/exam/workspaces/${activeWS.id}/artifacts`
      )
      .then(setArtifacts)
      .catch(() => {});
  }, [activeWS]);

  // listen for artifact:complete to refresh
  useEffect(() => {
    if (!activeWS) return;
    const s = getSocket();
    if (!s) return;
    const onComplete = (p: { artifact_id: string }) => {
      api
        .get<ServerArtifact>(`/api/v1/exam/artifacts/${p.artifact_id}`)
        .then((art) => {
          setArtifacts((prev) =>
            prev.some((a) => a.id === art.id)
              ? prev.map((a) => (a.id === art.id ? art : a))
              : [art, ...prev]
          );
          setGenerating(false);
        })
        .catch(() => {});
    };
    s.on("artifact:complete", onComplete);
    return () => {
      s.off("artifact:complete", onComplete);
    };
  }, [activeWS]);

  const generate = async () => {
    if (!activeWS) return;
    setGenerating(true);
    try {
      const res = await api.post<ServerArtifact>(
        `/api/v1/exam/workspaces/${activeWS.id}/generate`,
        { kind, mode }
      );
      setArtifacts((p) => [res, ...p]);
    } catch {
      setGenerating(false);
    }
  };

  const newWorkspace = async () => {
    const title = prompt("workspace title?")?.trim();
    if (!title) return;
    try {
      const ws = await api.post<ExamWorkspace>("/api/v1/exam/workspaces", {
        title,
      });
      setWorkspaces((p) => [ws, ...p]);
      setActiveWS(ws);
      setView("workspace");
    } catch {}
  };

  if (view === "artifact" && activeArt) {
    return <ArtifactView art={activeArt} onBack={() => setView("workspace")} />;
  }

  if (view === "workspace" && activeWS) {
    return (
      <div style={eS.page}>
        <div style={eS.header}>
          <button
            style={eS.back}
            onClick={() => {
              setView("list");
              setActiveWS(null);
            }}
          >
            <Chev /> Workspaces
          </button>
          <h2 style={eS.h2}>{activeWS.title}</h2>
          <span style={eS.sub}>{activeWS.subject || ""}</span>
        </div>
        <div style={eS.body}>
          <div style={eS.section}>
            <h3 style={eS.sLabel}>Sources</h3>
            <div style={eS.dropzone}>
              <svg
                width="22"
                height="22"
                viewBox="0 0 22 22"
                fill="none"
                style={{ color: "var(--navy-35)" }}
              >
                <path
                  d="M11 4v10M7 9l4-5 4 5M4 17h14"
                  stroke="currentColor"
                  strokeWidth="1.3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span
                style={{
                  fontSize: 13,
                  color: "var(--navy-60)",
                  fontFamily: "var(--serif)",
                  fontStyle: "italic",
                }}
              >
                drop files here — PDF, DOCX, MD, TXT
              </span>
            </div>
          </div>

          <div style={eS.section}>
            <h3 style={eS.sLabel}>Generate artifact</h3>
            <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 14 }}>
              {(Object.entries(KIND) as Array<[ArtifactKind, (typeof KIND)[ArtifactKind]]>).map(
                ([k, meta]) => (
                  <button
                    key={k}
                    style={{
                      ...eS.kindChip,
                      ...(kind === k
                        ? {
                            background: meta.color + "18",
                            color: meta.color,
                            borderColor: meta.color + "50",
                          }
                        : {}),
                    }}
                    onClick={() => setKind(k)}
                  >
                    <span>{meta.icon}</span>
                    <span>{meta.label}</span>
                  </button>
                )
              )}
            </div>
            <button
              style={{ ...eS.genBtn, opacity: generating ? 0.7 : 1 }}
              onClick={generate}
              disabled={generating}
            >
              {generating ? (
                <>
                  <span
                    style={{
                      width: 12,
                      height: 12,
                      border: "2px solid rgba(255,255,255,.3)",
                      borderTopColor: "white",
                      borderRadius: "50%",
                      display: "inline-block",
                      animation: "spin .7s linear infinite",
                      marginRight: 8,
                    }}
                  />
                  generating…
                </>
              ) : (
                `generate ${KIND[kind].label.toLowerCase()}`
              )}
            </button>
          </div>

          <div style={eS.section}>
            <h3 style={eS.sLabel}>Artifacts</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {artifacts.length === 0 ? (
                <p
                  style={{
                    fontSize: 13,
                    color: "var(--navy-35)",
                    fontFamily: "var(--serif)",
                    fontStyle: "italic",
                  }}
                >
                  none yet — generate your first.
                </p>
              ) : (
                artifacts.map((a) => {
                  const meta = KIND[a.kind as ArtifactKind] || KIND.cheatsheet;
                  return (
                    <button
                      key={a.id}
                      style={eS.artRow}
                      onClick={() => {
                        setActiveArt(a);
                        setView("artifact");
                      }}
                    >
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 500,
                          padding: "2px 8px",
                          borderRadius: 10,
                          background: meta.color + "18",
                          color: meta.color,
                          flexShrink: 0,
                        }}
                      >
                        {meta.icon} {meta.label}
                      </span>
                      <span
                        style={{
                          flex: 1,
                          fontSize: 13.5,
                          fontFamily: "var(--serif)",
                          color: "var(--navy)",
                          textAlign: "left",
                        }}
                      >
                        {a.title}
                      </span>
                      <span
                        style={{ fontSize: 11.5, color: "var(--navy-35)" }}
                      >
                        {a.generated_in_mode || ""} ·{" "}
                        {a.status === "ready" ? "" : a.status}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={eS.page}>
      <div style={eS.header}>
        <h2 style={eS.h1}>Exam</h2>
        <span style={eS.sub}>compress knowledge into artifacts</span>
      </div>
      <div style={eS.wsList}>
        {workspaces.map((ws) => (
          <button
            key={ws.id}
            style={eS.wsCard}
            onClick={() => {
              setActiveWS(ws);
              setView("workspace");
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: 8,
              }}
            >
              <span
                style={{
                  fontSize: 15,
                  fontFamily: "var(--serif)",
                  fontWeight: 400,
                  color: "var(--navy)",
                  flex: 1,
                  textAlign: "left",
                }}
              >
                {ws.title}
              </span>
              <span
                style={{
                  fontSize: 11.5,
                  color: "var(--navy-35)",
                  marginLeft: 12,
                  flexShrink: 0,
                }}
              >
                {formatRelative(ws.updated_at)}
              </span>
            </div>
            {ws.subject && (
              <div style={{ display: "flex", gap: 8 }}>
                <span
                  style={{
                    fontSize: 12,
                    color: "var(--sky)",
                    background: "var(--sky-bg)",
                    padding: "2px 9px",
                    borderRadius: 10,
                  }}
                >
                  {ws.subject}
                </span>
              </div>
            )}
          </button>
        ))}
        <button style={eS.newWs} onClick={newWorkspace}>
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path
              d="M6.5 1.5v10M1.5 6.5h10"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          new workspace
        </button>
      </div>
    </div>
  );
}

function ArtifactView({
  art,
  onBack,
}: {
  art: ServerArtifact;
  onBack: () => void;
}) {
  const meta = KIND[art.kind as ArtifactKind] || KIND.cheatsheet;
  const [open, setOpen] = useState<Record<number, boolean>>({ 0: true });

  if (art.status === "generating") {
    return (
      <div style={eS.page}>
        <div style={eS.header}>
          <button style={eS.back} onClick={onBack}>
            <Chev /> Workspace
          </button>
          <h2 style={eS.h2}>{art.title}</h2>
        </div>
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <p
            style={{
              fontFamily: "var(--serif)",
              fontStyle: "italic",
              color: "var(--navy-60)",
            }}
          >
            still composing — this takes a moment
          </p>
        </div>
      </div>
    );
  }

  if (art.kind === "cheatsheet") {
    const sections =
      ((art.payload as { sections?: Array<{ title: string; items: Array<{ term: string; body: string }> }> })
        .sections) || [];
    return (
      <div style={eS.page}>
        <div style={eS.header}>
          <button style={eS.back} onClick={onBack}>
            <Chev /> Workspace
          </button>
          <h2 style={eS.h2}>{art.title}</h2>
          <span
            style={{
              fontSize: 12,
              color: meta.color,
              background: meta.color + "15",
              padding: "2px 9px",
              borderRadius: 10,
              alignSelf: "flex-start",
              marginTop: 4,
            }}
          >
            {meta.label}
          </span>
        </div>
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "16px 28px",
            maxWidth: 780,
          }}
        >
          {sections.map((sec, si) => (
            <div
              key={si}
              style={{
                marginBottom: 8,
                border: "1px solid var(--vanilla-border)",
                borderRadius: "var(--rs)",
                overflow: "hidden",
              }}
            >
              <button
                style={{
                  width: "100%",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "11px 16px",
                  background: "var(--vanilla)",
                  cursor: "pointer",
                  color: "inherit",
                }}
                onClick={() => setOpen((p) => ({ ...p, [si]: !p[si] }))}
              >
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: ".07em",
                    textTransform: "uppercase",
                    color: "var(--sky)",
                  }}
                >
                  {sec.title}
                </span>
                <Chev up={open[si]} />
              </button>
              {open[si] && (
                <div
                  style={{
                    padding: "4px 16px 14px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 14,
                  }}
                >
                  {sec.items.map((item, ii) => (
                    <div
                      key={ii}
                      style={{
                        paddingTop: 12,
                        borderTop:
                          ii === 0 ? "1px solid var(--vanilla-border)" : "none",
                      }}
                    >
                      <strong
                        style={{
                          display: "block",
                          fontSize: 13.5,
                          fontFamily: "var(--serif)",
                          fontWeight: 500,
                          color: "var(--navy)",
                          marginBottom: 4,
                        }}
                      >
                        {item.term}
                      </strong>
                      <p
                        style={{
                          fontSize: 13.5,
                          fontFamily: "var(--serif)",
                          lineHeight: 1.72,
                          color: "var(--navy-60)",
                          fontWeight: 300,
                        }}
                      >
                        {item.body}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (art.kind === "practice_set") {
    return (
      <PracticeSetView art={art} onBack={onBack} />
    );
  }

  return (
    <div style={eS.page}>
      <div style={eS.header}>
        <button style={eS.back} onClick={onBack}>
          <Chev /> Workspace
        </button>
        <h2 style={eS.h2}>{art.title}</h2>
      </div>
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <p
          style={{
            fontFamily: "var(--serif)",
            fontStyle: "italic",
            color: "var(--navy-60)",
          }}
        >
          {meta.label} viewer — coming soon
        </p>
      </div>
    </div>
  );
}

type Question = {
  id: string;
  type: "short" | "mcq";
  q: string;
  opts?: string[];
};

function PracticeSetView({
  art,
  onBack,
}: {
  art: ServerArtifact;
  onBack: () => void;
}) {
  const questions =
    ((art.payload as { questions?: Question[] }).questions || []) as Question[];
  const [qi, setQi] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | number>>({});
  const [submitted, setSubmitted] = useState<{
    score: number | null;
    weak_topics: unknown[] | null;
  } | null>(null);

  const current = questions[qi];

  const submit = async () => {
    try {
      const res = await api.post<{
        score: number | null;
        weak_topics: unknown[] | null;
      }>(`/api/v1/exam/artifacts/${art.id}/attempt`, {
        responses: answers,
        duration_sec: 0,
      });
      setSubmitted({ score: res.score, weak_topics: res.weak_topics });
    } catch {}
  };

  if (submitted) {
    return (
      <div style={eS.page}>
        <div style={eS.header}>
          <button style={eS.back} onClick={onBack}>
            <Chev /> Workspace
          </button>
          <h2 style={eS.h2}>{art.title}</h2>
        </div>
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
          }}
        >
          <p
            style={{
              fontFamily: "var(--serif)",
              fontSize: 24,
              color: "var(--navy)",
            }}
          >
            score: {submitted.score == null ? "—" : `${Math.round(submitted.score * 100)}%`}
          </p>
          {submitted.weak_topics && submitted.weak_topics.length > 0 && (
            <p
              style={{
                fontFamily: "var(--serif)",
                fontStyle: "italic",
                color: "var(--navy-60)",
              }}
            >
              weak topics: {submitted.weak_topics.join(", ")}
            </p>
          )}
        </div>
      </div>
    );
  }

  if (!current) {
    return (
      <div style={eS.page}>
        <div style={eS.header}>
          <button style={eS.back} onClick={onBack}>
            <Chev /> Workspace
          </button>
          <h2 style={eS.h2}>{art.title}</h2>
        </div>
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <p
            style={{
              fontFamily: "var(--serif)",
              fontStyle: "italic",
              color: "var(--navy-60)",
            }}
          >
            no questions in this set yet
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={eS.page}>
      <div style={eS.header}>
        <button style={eS.back} onClick={onBack}>
          <Chev /> Workspace
        </button>
        <h2 style={eS.h2}>{art.title}</h2>
        <span style={{ fontSize: 12, color: "var(--navy-35)" }}>
          {qi + 1} / {questions.length}
        </span>
      </div>
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: 44,
          maxWidth: 680,
          display: "flex",
          flexDirection: "column",
          gap: 22,
        }}
      >
        <p
          style={{
            fontSize: 16,
            fontFamily: "var(--serif)",
            lineHeight: 1.75,
            fontWeight: 300,
            color: "var(--navy)",
          }}
        >
          {current.q}
        </p>
        {current.type === "mcq" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {(current.opts || []).map((opt, oi) => (
              <button
                key={oi}
                style={{
                  textAlign: "left",
                  padding: "11px 14px",
                  border: `1px solid ${
                    answers[current.id] === oi
                      ? "var(--sky)"
                      : "var(--vanilla-border)"
                  }`,
                  borderRadius: "var(--rs)",
                  background:
                    answers[current.id] === oi ? "var(--sky-bg)" : "var(--white)",
                  fontSize: 14,
                  fontFamily: "var(--serif)",
                  color: "var(--navy)",
                  cursor: "pointer",
                }}
                onClick={() =>
                  setAnswers((p) => ({ ...p, [current.id]: oi }))
                }
              >
                {opt}
              </button>
            ))}
          </div>
        ) : (
          <textarea
            value={(answers[current.id] as string) || ""}
            onChange={(e) =>
              setAnswers((p) => ({ ...p, [current.id]: e.target.value }))
            }
            placeholder="write your answer…"
            style={{
              resize: "none",
              border: "1px solid var(--vanilla-border)",
              borderRadius: "var(--rs)",
              padding: 14,
              fontFamily: "var(--serif)",
              fontSize: 14,
              lineHeight: 1.7,
              color: "var(--navy)",
              background: "var(--vanilla)",
              height: 150,
            }}
          />
        )}
        <div style={{ display: "flex", gap: 10 }}>
          {qi > 0 && (
            <button
              style={eS.backBtn2}
              onClick={() => setQi((p) => p - 1)}
            >
              ← previous
            </button>
          )}
          <button
            style={{ ...eS.genBtn, marginLeft: "auto", padding: "8px 22px" }}
            onClick={() =>
              qi < questions.length - 1 ? setQi((p) => p + 1) : submit()
            }
          >
            {qi < questions.length - 1 ? "next →" : "submit"}
          </button>
        </div>
      </div>
    </div>
  );
}

function formatRelative(iso: string): string {
  const t = new Date(iso).getTime();
  if (!t) return "";
  const diff = Date.now() - t;
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

const Chev = ({ up }: { up?: boolean }) => (
  <svg
    width="11"
    height="11"
    viewBox="0 0 11 11"
    fill="none"
    style={{
      transform: up ? "rotate(180deg)" : "rotate(270deg)",
      flexShrink: 0,
    }}
  >
    <path
      d="M2.5 4.5l3 3 3-3"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const eS: Record<string, React.CSSProperties> = {
  page: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    overflow: "hidden",
  },
  header: {
    padding: "18px 28px 14px",
    borderBottom: "1px solid var(--vanilla-border)",
    display: "flex",
    flexDirection: "column",
    gap: 4,
    background: "var(--white)",
    flexShrink: 0,
  },
  back: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    fontSize: 12,
    color: "var(--navy-60)",
    cursor: "pointer",
    marginBottom: 2,
    padding: 0,
  },
  h1: {
    fontSize: 22,
    fontWeight: 300,
    fontFamily: "var(--serif)",
    color: "var(--navy)",
  },
  h2: {
    fontSize: 18,
    fontWeight: 400,
    fontFamily: "var(--serif)",
    color: "var(--navy)",
  },
  sub: {
    fontSize: 13,
    color: "var(--navy-60)",
    fontFamily: "var(--serif)",
    fontStyle: "italic",
  },
  wsList: {
    flex: 1,
    overflowY: "auto",
    padding: "20px 28px",
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  wsCard: {
    width: "100%",
    textAlign: "left",
    padding: 16,
    border: "1px solid var(--vanilla-border)",
    borderRadius: "var(--rs)",
    background: "var(--white)",
    cursor: "pointer",
  },
  newWs: {
    display: "flex",
    alignItems: "center",
    gap: 7,
    padding: "12px 16px",
    border: "1.5px dashed var(--vanilla-border)",
    borderRadius: "var(--rs)",
    color: "var(--navy-60)",
    fontSize: 13,
    cursor: "pointer",
  },
  body: {
    flex: 1,
    overflowY: "auto",
    padding: "20px 28px",
    display: "flex",
    flexDirection: "column",
    gap: 22,
  },
  section: { display: "flex", flexDirection: "column", gap: 9 },
  sLabel: {
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: ".08em",
    textTransform: "uppercase",
    color: "var(--navy-35)",
  },
  dropzone: {
    border: "1.5px dashed var(--vanilla-border)",
    borderRadius: "var(--rs)",
    padding: 24,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 8,
    background: "var(--vanilla)",
  },
  kindChip: {
    display: "flex",
    alignItems: "center",
    gap: 5,
    padding: "5px 11px",
    borderRadius: "var(--rs)",
    border: "1px solid var(--vanilla-border)",
    fontSize: 12,
    color: "var(--navy-60)",
    cursor: "pointer",
  },
  genBtn: {
    padding: "9px 20px",
    background: "var(--navy)",
    color: "var(--vanilla)",
    borderRadius: "var(--rs)",
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer",
    alignSelf: "flex-start",
    display: "flex",
    alignItems: "center",
  },
  artRow: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "11px 14px",
    border: "1px solid var(--vanilla-border)",
    borderRadius: "var(--rs)",
    background: "var(--white)",
    cursor: "pointer",
  },
  backBtn2: {
    padding: "8px 16px",
    border: "1px solid var(--vanilla-border)",
    borderRadius: "var(--rs)",
    fontSize: 13,
    color: "var(--navy-60)",
    cursor: "pointer",
  },
};
