"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "./auth-store";

/** Wrap pages that require an authenticated session.
 *  Redirects to /login when the token is missing or expired. */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [hydrated, setHydrated] = useState(false);
  const isAuth = useAuthStore((s) => s.isAuthenticated());
  const token = useAuthStore((s) => s.token);

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated && !isAuth) router.replace("/login");
  }, [hydrated, isAuth, token, router]);

  if (!hydrated) return null;
  if (!isAuth) return null;
  return <>{children}</>;
}
