"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import type { AuthResponse } from "@/lib/types";

export function VerifyPage() {
  const router = useRouter();
  const params = useSearchParams();
  const setSession = useAuthStore((s) => s.setSession);
  const [status, setStatus] = useState<"verifying" | "ok" | "error">("verifying");
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const email = params.get("email");
    const token = params.get("token");
    if (!email || !token) {
      setStatus("error");
      setError("this link is incomplete — request a new one");
      return;
    }
    api
      .post<AuthResponse>("/api/v1/auth/verify", { email, token }, { auth: false })
      .then((res) => {
        setSession({
          token: res.access_token,
          user: res.user,
          expiresAt: res.expires_at,
        });
        setStatus("ok");
        router.replace("/");
      })
      .catch(() => {
        setStatus("error");
        setError("this link has expired or doesn't match — request a new one");
      });
  }, [params, router, setSession]);

  return (
    <div style={vS.page}>
      <div style={vS.card}>
        <div style={vS.wordmark}>ESUI</div>
        {status === "verifying" && (
          <p style={vS.text}>signing you in…</p>
        )}
        {status === "error" && (
          <>
            <p style={vS.text}>{error}</p>
            <button
              style={vS.link}
              onClick={() => router.replace("/login")}
            >
              return to sign in
            </button>
          </>
        )}
      </div>
    </div>
  );
}

const vS: Record<string, React.CSSProperties> = {
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
    marginBottom: 18,
  },
  text: {
    fontSize: 14,
    color: "var(--navy-60)",
    fontFamily: "var(--serif)",
    fontStyle: "italic",
    textAlign: "center",
    lineHeight: 1.6,
  },
  link: {
    marginTop: 18,
    fontSize: 12.5,
    color: "var(--sky)",
    textDecoration: "underline",
    textDecorationColor: "var(--sky-border)",
  },
};
