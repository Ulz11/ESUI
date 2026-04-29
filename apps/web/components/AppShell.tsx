"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TopNav, type RouteId } from "./TopNav";
import { BentoHome } from "./BentoHome";
import { ChatWidget } from "./widgets/ChatWidget";
import { VaultWidget } from "./widgets/VaultWidget";
import { ExamWidget } from "./widgets/ExamWidget";
import { SignalsWidget } from "./widgets/SignalsWidget";
import { TogetherWidget } from "./widgets/TogetherWidget";
import { SettingsDrawer } from "./widgets/SettingsDrawer";
import { useAuthStore } from "@/lib/auth-store";
import type { Mode } from "@/lib/types";

const ROUTE_TO_PATH: Record<RouteId, string> = {
  home: "/",
  chat: "/chat",
  vault: "/vault",
  exam: "/exam",
  signals: "/signals",
  together: "/together",
};

const DARK_VARS: React.CSSProperties = {
  ["--page" as string]: "#161824",
  ["--surface" as string]: "#1d2035",
  ["--border" as string]: "#2a2e48",
  ["--navy" as string]: "#e8e2d8",
  ["--navy-70" as string]: "rgba(232,226,216,.70)",
  ["--navy-60" as string]: "rgba(232,226,216,.60)",
  ["--navy-45" as string]: "rgba(232,226,216,.45)",
  ["--navy-35" as string]: "rgba(232,226,216,.35)",
  ["--navy-20" as string]: "rgba(232,226,216,.20)",
  ["--navy-15" as string]: "rgba(232,226,216,.15)",
  ["--navy-10" as string]: "rgba(232,226,216,.10)",
  ["--navy-08" as string]: "rgba(232,226,216,.08)",
  ["--white" as string]: "#1d2035",
  ["--vanilla" as string]: "#1d2035",
  ["--vanilla-2" as string]: "#242739",
  ["--vanilla-border" as string]: "#2a2e48",
  ["--sky-light" as string]: "rgba(91,154,184,.18)",
  ["--sky-bg" as string]: "rgba(91,154,184,.15)",
  ["--sky-border" as string]: "rgba(91,154,184,.35)",
  ["--sky-deep" as string]: "#7ab5cd",
  ["--forest-light" as string]: "rgba(62,111,84,.18)",
  ["--forest-bg" as string]: "rgba(62,111,84,.15)",
  ["--forest-border" as string]: "rgba(62,111,84,.35)",
  ["--shadow-card" as string]:
    "0 1px 3px rgba(0,0,0,.25), 0 4px 16px rgba(0,0,0,.35)",
  ["--shadow-hover" as string]:
    "0 2px 8px rgba(0,0,0,.30), 0 12px 40px rgba(0,0,0,.45)",
};

export function AppShell({ initialRoute = "home" }: { initialRoute?: RouteId }) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const setSessionUser = useAuthStore((s) => s.setSession);
  const sessionExp = useAuthStore((s) => s.expiresAt);
  const sessionToken = useAuthStore((s) => s.token);

  const [route, setRoute] = useState<RouteId>(initialRoute);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark" | "system">("light");
  const [mode, setMode] = useState<Mode>(user?.default_mode || "ulzii");

  // sync local mode with persisted user preference once available
  useEffect(() => {
    if (user?.default_mode) setMode(user.default_mode);
  }, [user?.default_mode]);

  // resolve "system" theme to light/dark for var application
  const isDark =
    theme === "dark" ||
    (theme === "system" &&
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);

  const navigate = (r: RouteId) => {
    setRoute(r);
    if (typeof window !== "undefined") {
      const target = ROUTE_TO_PATH[r];
      if (window.location.pathname !== target) {
        router.push(target);
      }
    }
  };

  const handleModeChange = (m: Mode) => {
    setMode(m);
    if (user && sessionToken) {
      // Persist as default_mode silently; ignore failures.
      import("@/lib/api").then(({ api }) => {
        api
          .patch<{
            id: string;
            email: string;
            display_name: string;
            role: string;
            avatar_url: string | null;
            timezone: string;
            default_mode: Mode;
          }>("/api/v1/me", { default_mode: m })
          .then((updated) => {
            if (sessionExp && sessionToken) {
              setSessionUser({
                token: sessionToken,
                user: updated,
                expiresAt: sessionExp,
              });
            }
          })
          .catch(() => {});
      });
    }
  };

  return (
    <div style={{ ...shS.root, ...(isDark ? DARK_VARS : {}) }}>
      <TopNav
        route={route}
        onNavigate={navigate}
        mode={mode}
        setMode={handleModeChange}
        onSettings={() => setSettingsOpen(true)}
        userInitial={user?.display_name?.[0] || "E"}
      />

      <div style={shS.main}>
        {route === "home" && <BentoHome onNavigate={navigate} mode={mode} userName={user?.display_name || "you"} />}
        {route === "chat" && (
          <WidgetWrap key="chat">
            <ChatWidget mode={mode} setMode={handleModeChange} />
          </WidgetWrap>
        )}
        {route === "vault" && (
          <WidgetWrap key="vault">
            <VaultWidget />
          </WidgetWrap>
        )}
        {route === "exam" && (
          <WidgetWrap key="exam">
            <ExamWidget mode={mode} />
          </WidgetWrap>
        )}
        {route === "signals" && (
          <WidgetWrap key="signals">
            <SignalsWidget />
          </WidgetWrap>
        )}
        {route === "together" && (
          <WidgetWrap key="together">
            <TogetherWidget />
          </WidgetWrap>
        )}
      </div>

      {settingsOpen && (
        <SettingsDrawer
          onClose={() => setSettingsOpen(false)}
          mode={mode}
          setMode={handleModeChange}
          theme={theme}
          setTheme={setTheme}
        />
      )}

    </div>
  );
}

function WidgetWrap({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        flex: 1,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        animation: "fadeUp .2s ease both",
      }}
    >
      {children}
    </div>
  );
}

const shS: Record<string, React.CSSProperties> = {
  root: {
    width: "100vw",
    height: "100vh",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    background: "var(--page)",
    transition: "background .3s",
  },
  main: { flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" },
};
