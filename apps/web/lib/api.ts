"use client";

import { getAuthToken, useAuthStore } from "./auth-store";

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

type FetchOpts = RequestInit & { auth?: boolean };

async function request<T>(path: string, opts: FetchOpts = {}): Promise<T> {
  const headers = new Headers(opts.headers);
  if (opts.auth !== false) {
    const t = getAuthToken();
    if (t) headers.set("Authorization", `Bearer ${t}`);
  }
  if (!headers.has("Content-Type") && opts.body && !(opts.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`${API_URL}${path}`, { ...opts, headers });

  if (res.status === 401) {
    // session is dead; force a re-login.
    try {
      useAuthStore.getState().clear();
    } catch {}
    if (typeof window !== "undefined" && !path.startsWith("/api/v1/auth/")) {
      window.location.href = "/login";
    }
  }

  if (res.status === 204) return undefined as T;

  const ct = res.headers.get("content-type") || "";
  const body = ct.includes("application/json") ? await res.json() : await res.text();

  if (!res.ok) {
    const msg =
      (typeof body === "object" && body && "detail" in body
        ? String((body as { detail?: string }).detail)
        : null) ||
      (typeof body === "string" ? body : `HTTP ${res.status}`);
    throw new ApiError(res.status, msg, body);
  }

  return body as T;
}

export const api = {
  get: <T>(path: string, opts?: FetchOpts) =>
    request<T>(path, { ...opts, method: "GET" }),
  post: <T>(path: string, body?: unknown, opts?: FetchOpts) =>
    request<T>(path, {
      ...opts,
      method: "POST",
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  patch: <T>(path: string, body?: unknown, opts?: FetchOpts) =>
    request<T>(path, {
      ...opts,
      method: "PATCH",
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  delete: <T>(path: string, opts?: FetchOpts) =>
    request<T>(path, { ...opts, method: "DELETE" }),
  upload: <T>(path: string, file: File, fields?: Record<string, string>) => {
    const fd = new FormData();
    fd.append("file", file);
    if (fields) {
      for (const [k, v] of Object.entries(fields)) fd.append(k, v);
    }
    return request<T>(path, { method: "POST", body: fd });
  },
};
