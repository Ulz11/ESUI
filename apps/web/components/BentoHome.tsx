"use client";

import { useEffect, useRef, useState } from "react";
import type { Mode } from "@/lib/types";
import type { RouteId } from "./TopNav";

function greeting() {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return "good morning";
  if (h >= 12 && h < 17) return "good afternoon";
  if (h >= 17 && h < 21) return "good evening";
  return "goodnight";
}

export function BentoHome({
  onNavigate,
  mode,
  userName = "you",
}: {
  onNavigate: (r: RouteId) => void;
  mode: Mode;
  userName?: string;
}) {
  return (
    <div style={hS.page}>
      <div style={hS.greetRow}>
        <h1 style={hS.greet}>
          {greeting()}, <em style={{ fontWeight: 300 }}>{userName}</em>
        </h1>
        <p style={hS.greetSub}>Badrushk was here recently</p>
      </div>
      <div style={hS.grid}>
        <BentoCard
          style={{ gridColumn: "span 7", gridRow: "span 2", minHeight: 460 }}
          accent="#5b9ab8"
          accentLight="#e8f2f8"
          label="Chat"
          count="conversations"
          onClick={() => onNavigate("chat")}
          delay={0}
        >
          <ChatPreview mode={mode} />
        </BentoCard>

        <BentoCard
          style={{ gridColumn: "span 5", minHeight: 210 }}
          accent="#2e3360"
          accentLight="#ecedf8"
          label="Vault"
          count="your knowledge"
          onClick={() => onNavigate("vault")}
          delay={50}
        >
          <VaultPreview />
        </BentoCard>

        <BentoCard
          style={{ gridColumn: "span 5", minHeight: 210 }}
          accentGrad="linear-gradient(120deg,#c4a89a,#9aacc4)"
          label="Together"
          count="just the two of you"
          onClick={() => onNavigate("together")}
          delay={80}
          lightLabel
        >
          <TogetherPreview />
        </BentoCard>

        <BentoCard
          style={{ gridColumn: "span 4", minHeight: 200 }}
          accent="#3e6f54"
          accentLight="#e4f0e9"
          label="Exam"
          count="study compression"
          onClick={() => onNavigate("exam")}
          delay={110}
        >
          <ExamPreview />
        </BentoCard>

        <BentoCard
          style={{ gridColumn: "span 8", minHeight: 200 }}
          accent="#8c6b3a"
          accentLight="#f4ead9"
          label="Signals"
          count="postcards from the world"
          onClick={() => onNavigate("signals")}
          delay={140}
        >
          <SignalsPreview />
        </BentoCard>
      </div>
    </div>
  );
}

function BentoCard({
  children,
  style,
  accent,
  accentLight,
  accentGrad,
  label,
  count,
  onClick,
  delay,
  lightLabel,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
  accent?: string;
  accentLight?: string;
  accentGrad?: string;
  label: string;
  count: string;
  onClick: () => void;
  delay: number;
  lightLabel?: boolean;
}) {
  const [hov, setHov] = useState(false);
  const headerBg = accentGrad || (accentLight ? accentLight : accent);
  const textCol = lightLabel
    ? "rgba(255,255,255,.95)"
    : accentLight
      ? accent
      : "#fff";
  const subCol = lightLabel
    ? "rgba(255,255,255,.60)"
    : accentLight
      ? (accent || "") + "88"
      : "rgba(255,255,255,.60)";

  return (
    <div
      style={{
        ...hS.card,
        ...style,
        boxShadow: hov ? "var(--shadow-hover)" : "var(--shadow-card)",
        transform: hov ? "translateY(-4px) scale(1.005)" : "none",
        transition: "transform .2s ease, box-shadow .2s ease",
        animation: `stagger .3s ${delay}ms ease both`,
      }}
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
    >
      <div style={{ ...hS.cardHead, background: headerBg }}>
        <span
          style={{
            fontSize: 14,
            fontWeight: 700,
            letterSpacing: "-.01em",
            color: textCol,
          }}
        >
          {label}
        </span>
        <span style={{ fontSize: 11.5, color: subCol }}>{count}</span>
      </div>
      <div style={hS.cardBody}>{children}</div>
    </div>
  );
}

function ChatPreview({ mode }: { mode: Mode }) {
  const [cursorOn, setCursorOn] = useState(true);
  const modeColor = mode === "ulzii" ? "var(--sky)" : "var(--forest)";

  useEffect(() => {
    const t = setInterval(() => setCursorOn((p) => !p), 530);
    return () => clearInterval(t);
  }, []);

  const items = [
    { title: "Theory of knowledge — first principles", ts: "2h", active: true },
    { title: "ESUI launch planning", ts: "1d", dot: true },
    { title: "Reading list: Wittgenstein", ts: "5d" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {items.map((c, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "9px 16px",
            borderBottom: "1px solid var(--border)",
            background: c.active ? "var(--page)" : "transparent",
          }}
        >
          {c.dot && (
            <span
              style={{
                width: 5,
                height: 5,
                borderRadius: "50%",
                background: modeColor,
                flexShrink: 0,
              }}
            />
          )}
          <span
            style={{
              fontSize: 13,
              fontFamily: "var(--serif)",
              color: "var(--navy)",
              flex: 1,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              fontWeight: c.active ? 500 : 400,
            }}
          >
            {c.title}
          </span>
          <span
            style={{ fontSize: 11, color: "var(--navy-20)", flexShrink: 0 }}
          >
            {c.ts}
          </span>
        </div>
      ))}
      <div style={{ padding: "14px 16px", flex: 1 }}>
        <div
          style={{
            display: "flex",
            gap: 6,
            alignItems: "center",
            marginBottom: 7,
          }}
        >
          <span
            style={{
              fontSize: 11.5,
              fontWeight: 500,
              fontStyle: "italic",
              color: modeColor,
              fontFamily: "var(--serif)",
            }}
          >
            {mode === "ulzii" ? "Ulzii" : "Obama"}
          </span>
          <span style={{ fontSize: 10.5, color: "var(--navy-20)" }}>now</span>
        </div>
        <p
          style={{
            fontSize: 13.5,
            fontFamily: "var(--serif)",
            fontWeight: 300,
            color: "var(--navy-70)",
            lineHeight: 1.72,
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {mode === "ulzii"
            ? "First principles, patient analysis. Ask the question and we'll work it out together."
            : "Recommendation-first. State the goal, name the tradeoff, pick the move."}
        </p>
      </div>
      <div
        style={{
          padding: "9px 12px",
          borderTop: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <div
          style={{
            flex: 1,
            background: "var(--page)",
            borderRadius: 10,
            padding: "8px 13px",
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <span
            style={{
              fontSize: 12.5,
              color: "var(--navy-20)",
              fontFamily: "var(--serif)",
              fontStyle: "italic",
            }}
          >
            ask anything
          </span>
          <span
            style={{
              width: 1.5,
              height: 14,
              background: modeColor,
              display: "inline-block",
              opacity: cursorOn ? 1 : 0,
              transition: "opacity .05s",
              borderRadius: 1,
              marginLeft: 1,
            }}
          />
        </div>
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            background: modeColor,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
            <path d="M9.5 5.5L1 1.5l2 4-2 4z" fill="white" />
          </svg>
        </div>
      </div>
    </div>
  );
}

function VaultPreview() {
  const docs = [
    { title: "On Gettier and the limits of knowledge", type: "note", col: "#5b9ab8" },
    { title: "Ibn Rushd's reading of Aristotle", type: "research", col: "#3e6f54" },
    { title: "Zhuangzi — relativity of perspectives", type: "note", col: "#5b9ab8" },
    { title: "ESUI product notes", type: "draft", col: "#b5893a" },
  ];
  return (
    <div style={{ display: "flex", height: "100%", minHeight: 165 }}>
      <div
        style={{
          flex: 1,
          position: "relative",
          overflow: "hidden",
          minHeight: 165,
        }}
      >
        <MiniGraphCanvas />
        <div
          style={{
            position: "absolute",
            bottom: 8,
            left: 10,
            fontSize: 10.5,
            color: "var(--navy-20)",
            fontStyle: "italic",
            fontFamily: "var(--serif)",
          }}
        >
          a constellation of ideas
        </div>
      </div>
      <div
        style={{
          width: 195,
          borderLeft: "1px solid var(--border)",
          flexShrink: 0,
        }}
      >
        {docs.map((d, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 12px",
              borderBottom:
                i < docs.length - 1 ? "1px solid var(--border)" : "none",
            }}
          >
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                padding: "2px 6px",
                borderRadius: 8,
                background: d.col + "18",
                color: d.col,
                flexShrink: 0,
              }}
            >
              {d.type}
            </span>
            <span
              style={{
                fontSize: 12,
                fontFamily: "var(--serif)",
                color: "var(--navy)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                lineHeight: 1.3,
              }}
            >
              {d.title}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MiniGraphCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const nodes = useRef([
    { x: 0.15, y: 0.32, r: 0.7, col: "#5b9ab8", lbl: "Epistemology", vx: 0.00022, vy: 0.00031 },
    { x: 0.38, y: 0.18, r: 0.52, col: "#5b9ab8", lbl: "Gettier", vx: -0.00018, vy: 0.00025 },
    { x: 0.62, y: 0.28, r: 0.6, col: "#3e6f54", lbl: "Ibn Rushd", vx: 0.0002, vy: -0.00028 },
    { x: 0.82, y: 0.5, r: 0.55, col: "#3e6f54", lbl: "Aristotle", vx: -0.00024, vy: 0.0002 },
    { x: 0.55, y: 0.68, r: 0.5, col: "#5b9ab8", lbl: "Zhuangzi", vx: 0.00025, vy: 0.00026 },
    { x: 0.22, y: 0.7, r: 0.44, col: "#b5893a", lbl: "ESUI", vx: -0.0002, vy: -0.00022 },
    { x: 0.78, y: 0.78, r: 0.4, col: "#3e6f54", lbl: "ML", vx: 0.00018, vy: -0.00025 },
    { x: 0.42, y: 0.82, r: 0.38, col: "#8b6fba", lbl: "Journal", vx: -0.00022, vy: 0.0002 },
  ]);
  const EDGES: Array<[number, number]> = [
    [0, 1],
    [0, 2],
    [0, 4],
    [2, 3],
    [2, 5],
    [1, 0],
    [3, 6],
    [4, 7],
  ];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    let W = canvas.offsetWidth,
      H = canvas.offsetHeight;
    if (!W || !H) {
      W = 200;
      H = 165;
    }
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      const ns = nodes.current;
      ns.forEach((n) => {
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < 0.06 || n.x > 0.94) n.vx *= -1;
        if (n.y < 0.06 || n.y > 0.94) n.vy *= -1;
      });
      EDGES.forEach(([a, b]) => {
        const na = ns[a],
          nb = ns[b];
        const dx = nb.x * W - na.x * W,
          dy = nb.y * H - na.y * H;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const alpha = Math.max(0, 1 - dist / 180);
        ctx.beginPath();
        ctx.moveTo(na.x * W, na.y * H);
        ctx.lineTo(nb.x * W, nb.y * H);
        ctx.strokeStyle = `rgba(28,31,46,${alpha * 0.09})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      });
      ns.forEach((n) => {
        const r = 4 + n.r * 8;
        ctx.beginPath();
        ctx.arc(n.x * W, n.y * H, r, 0, Math.PI * 2);
        ctx.fillStyle = n.col + "28";
        ctx.fill();
        ctx.strokeStyle = n.col + "90";
        ctx.lineWidth = 1.3;
        ctx.stroke();
        if (n.r > 0.55) {
          ctx.font = "9.5px Inter,sans-serif";
          ctx.fillStyle = "rgba(28,31,46,.45)";
          ctx.textAlign = "center";
          ctx.fillText(n.lbl, n.x * W, n.y * H + r + 11);
        }
      });
      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: "100%",
        height: "100%",
        display: "block",
        minHeight: 165,
      }}
    />
  );
}

function TogetherPreview() {
  const photos = [
    {
      cap: "a quiet sunlit afternoon",
      grad: "linear-gradient(135deg,#e8d5c4,#c8dce8)",
      cls: "float-a",
    },
    {
      cap: "evening walk, waterfront",
      grad: "linear-gradient(135deg,#c8cee8,#e8c4d4)",
      cls: "float-b",
    },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", padding: 12, gap: 10 }}>
      <div style={{ display: "flex", gap: 10, height: 126 }}>
        {photos.map((p, i) => (
          <div
            key={i}
            className={p.cls}
            style={{
              flex: 1,
              borderRadius: 14,
              overflow: "hidden",
              position: "relative",
              background: p.grad,
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <div style={{ display: "flex", gap: 6 }}>
                {["E", "B"].map((l) => (
                  <div
                    key={l}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      background: "rgba(255,255,255,.35)",
                      border: "1.5px solid rgba(255,255,255,.55)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <span
                      style={{
                        fontSize: 13,
                        fontFamily: "var(--serif)",
                        color: "rgba(255,255,255,.92)",
                      }}
                    >
                      {l}
                    </span>
                  </div>
                ))}
              </div>
              <p
                style={{
                  fontSize: 10.5,
                  color: "rgba(255,255,255,.85)",
                  fontFamily: "var(--serif)",
                  fontStyle: "italic",
                  textAlign: "center",
                  padding: "0 10px",
                  lineHeight: 1.4,
                }}
              >
                {p.cap}
              </p>
            </div>
          </div>
        ))}
      </div>
      <p
        style={{
          fontSize: 11.5,
          color: "var(--navy-45)",
          fontFamily: "var(--serif)",
          fontStyle: "italic",
          textAlign: "center",
        }}
      >
        small moments, kept
      </p>
    </div>
  );
}

function ExamPreview() {
  const ws = [
    { title: "Epistemology & Philosophy of Mind", subject: "Philosophy", pct: 75 },
    { title: "Linear Algebra", subject: "Mathematics", pct: 50 },
    { title: "Transformer Architecture", subject: "ML", pct: 88 },
  ];
  return (
    <div>
      {ws.map((w, i) => (
        <div
          key={i}
          style={{
            padding: "10px 14px",
            borderBottom: i < ws.length - 1 ? "1px solid var(--border)" : "none",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 6,
            }}
          >
            <span
              style={{
                fontSize: 12.5,
                fontFamily: "var(--serif)",
                color: "var(--navy)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                flex: 1,
              }}
            >
              {w.title}
            </span>
            <span
              style={{
                fontSize: 11,
                color: "var(--forest)",
                background: "var(--forest-light)",
                padding: "1px 7px",
                borderRadius: 8,
                flexShrink: 0,
                marginLeft: 8,
              }}
            >
              {w.subject}
            </span>
          </div>
          <AnimBar pct={w.pct} color="#3e6f54" delay={i * 120} />
        </div>
      ))}
    </div>
  );
}

function AnimBar({ pct, color, delay }: { pct: number; color: string; delay: number }) {
  const [w, setW] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setW(pct), 300 + (delay || 0));
    return () => clearTimeout(t);
  }, [pct, delay]);
  return (
    <div
      style={{
        height: 3,
        background: "var(--border)",
        borderRadius: 2,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          height: "100%",
          width: `${w}%`,
          background: color,
          borderRadius: 2,
          transition: `width .8s ${delay || 0}ms cubic-bezier(.4,0,.2,1)`,
        }}
      />
    </div>
  );
}

function SignalsPreview() {
  const items = [
    {
      cat: "Global",
      col: "#5b9ab8",
      title: "On the fragility of certainty",
      body:
        "Antifragility suggests systems which gain from disorder differ from those which merely resist it.",
    },
    {
      cat: "Arabic Philosophy",
      col: "#8c6b3a",
      title: "Ibn Tufayl and the self-taught mind",
      body:
        "Hayy ibn Yaqzan argues that pure reason, given sufficient time, reaches the same conclusions as revelation.",
    },
    {
      cat: "Mathematics",
      col: "#8b6fba",
      title: "Gödel and epistemic humility",
      body:
        "Any expressive formal system contains true statements it cannot prove from within.",
    },
  ];
  return (
    <div style={{ display: "flex", gap: 10, padding: "4px 2px", overflowX: "auto" }}>
      {items.map((s, i) => (
        <div
          key={i}
          style={{
            minWidth: 215,
            flex: 1,
            border: "1px solid var(--border)",
            borderRadius: 12,
            overflow: "hidden",
            background: "var(--surface)",
            flexShrink: 0,
            animation: `stagger .3s ${i * 80 + 160}ms ease both`,
          }}
        >
          <div
            className="sig-card-border"
            style={{
              height: 3,
              background: s.col,
              animationDelay: `${i * 100}ms`,
            }}
          />
          <div style={{ padding: "10px 12px" }}>
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: s.col,
                letterSpacing: ".06em",
                textTransform: "uppercase",
                display: "block",
                marginBottom: 5,
              }}
            >
              {s.cat}
            </span>
            <p
              style={{
                fontSize: 12.5,
                fontWeight: 500,
                fontFamily: "var(--serif)",
                color: "var(--navy)",
                lineHeight: 1.4,
                marginBottom: 5,
              }}
            >
              {s.title}
            </p>
            <p
              style={{
                fontSize: 11.5,
                fontFamily: "var(--serif)",
                color: "var(--navy-70)",
                lineHeight: 1.6,
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
                fontWeight: 300,
              }}
            >
              {s.body}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

const hS: Record<string, React.CSSProperties> = {
  page: {
    flex: 1,
    overflowY: "auto",
    padding: "28px 24px 44px",
    display: "flex",
    flexDirection: "column",
    gap: 20,
  },
  greetRow: { paddingLeft: 4 },
  greet: {
    fontSize: 30,
    fontWeight: 300,
    fontFamily: "var(--serif)",
    color: "var(--navy)",
    lineHeight: 1.2,
    marginBottom: 5,
  },
  greetSub: {
    fontSize: 13,
    color: "var(--navy-45)",
    fontFamily: "var(--serif)",
    fontStyle: "italic",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(12, 1fr)",
    gap: 12,
    alignItems: "start",
  },
  card: {
    borderRadius: "var(--r)",
    overflow: "hidden",
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    background: "var(--surface)",
  },
  cardHead: {
    height: 46,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 16px",
    flexShrink: 0,
  },
  cardBody: { flex: 1, overflow: "hidden" },
};
