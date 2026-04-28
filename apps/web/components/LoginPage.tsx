"use client";

import { useState } from "react";
import { api, ApiError } from "@/lib/api";

type Props = {
  initialEmail?: string;
  initialError?: string | null;
};

export function LoginPage({ initialEmail = "", initialError = null }: Props) {
  const [email, setEmail] = useState(initialEmail);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(initialError);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      await api.post("/api/v1/auth/magic-link", { email: email.trim() }, { auth: false });
      setSent(true);
    } catch (err) {
      const msg =
        err instanceof ApiError && err.status === 429
          ? "too many requests — try again in a bit"
          : "we couldn't quite get that — try again?";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={aS.page}>
      <div style={aS.card} className="anim-fade-up">
        <div style={aS.wordmark}>ESUI</div>
        <p style={aS.tagline}>a private workspace — just the two of you</p>

        {!sent ? (
          <form onSubmit={handleSubmit} style={{ width: "100%" }}>
            <div style={aS.inputWrap}>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your email"
                style={aS.input}
                autoFocus
                aria-label="email"
              />
            </div>
            <button
              type="submit"
              style={{ ...aS.btn, opacity: loading ? 0.65 : 1 }}
              disabled={loading || !email.trim()}
            >
              {loading ? "sending…" : "send magic link"}
            </button>
            {error && <p style={aS.errorMsg}>{error}</p>}
            <p style={aS.hint}>access is by invitation only</p>
          </form>
        ) : (
          <div style={aS.confirm} className="anim-fade-up">
            <p style={aS.confirmText}>check your email — a link is waiting for you</p>
            <button
              style={aS.demoBtn}
              onClick={() => {
                setSent(false);
                setError(null);
              }}
            >
              use a different email
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const aS: Record<string, React.CSSProperties> = {
  page: {
    width: "100vw",
    height: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "var(--page)",
  },
  card: {
    width: 360,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  wordmark: {
    fontFamily: "var(--serif)",
    fontSize: 34,
    fontWeight: 400,
    letterSpacing: ".12em",
    color: "var(--navy)",
    marginBottom: 8,
  },
  tagline: {
    fontSize: 13,
    color: "var(--navy-60)",
    fontFamily: "var(--serif)",
    fontStyle: "italic",
    marginBottom: 40,
    textAlign: "center",
    lineHeight: 1.5,
  },
  inputWrap: {
    width: "100%",
    borderBottom: "1px solid var(--border)",
    marginBottom: 18,
    paddingBottom: 8,
  },
  input: {
    width: "100%",
    fontSize: 15,
    color: "var(--navy)",
    background: "transparent",
  },
  btn: {
    width: "100%",
    padding: "10px 0",
    background: "var(--navy)",
    color: "var(--page)",
    fontSize: 13,
    fontWeight: 500,
    letterSpacing: ".025em",
    borderRadius: "var(--rs)",
    cursor: "pointer",
    transition: "opacity .15s",
  },
  hint: {
    marginTop: 14,
    textAlign: "center",
    fontSize: 12,
    color: "var(--navy-35)",
    fontFamily: "var(--serif)",
    fontStyle: "italic",
  },
  errorMsg: {
    marginTop: 12,
    fontSize: 12,
    color: "var(--rose)",
    fontFamily: "var(--serif)",
    fontStyle: "italic",
    textAlign: "center",
  },
  confirm: { width: "100%", textAlign: "center" },
  confirmText: {
    fontSize: 14,
    color: "var(--navy-60)",
    fontFamily: "var(--serif)",
    fontStyle: "italic",
    lineHeight: 1.65,
    marginBottom: 24,
  },
  demoBtn: {
    fontSize: 12,
    color: "var(--sky)",
    background: "none",
    border: "none",
    cursor: "pointer",
    textDecoration: "underline",
    textDecorationColor: "var(--sky-border)",
  },
};
