"use client";

/**
 * Shared React hooks that wire each V3 view to the real backend.
 * Keep view files (.jsx) thin: they call these hooks for data + actions.
 */

import { useCallback, useEffect, useMemo, useState } from "react";

import { api } from "./api";
import { tasksApi } from "./tasks-api";
import type {
  BeautyMedia,
  Conversation,
  Memory,
  Message,
  Quote,
  SignalCategory,
  Task,
  Usage,
  User,
  VaultArtifactSave,
  VaultContentType,
  VaultDocument,
} from "./types";

// ─── /me ─────────────────────────────────────────────────────────────────

export function useMe() {
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancel = false;
    api
      .get<User>("/api/v1/me")
      .then((u) => !cancel && setUser(u))
      .catch((e: Error) => !cancel && setError(e.message));
    return () => {
      cancel = true;
    };
  }, []);
  return { user, error };
}

export function useUsage(rangeDays = 30) {
  const [usage, setUsage] = useState<Usage | null>(null);
  useEffect(() => {
    let cancel = false;
    api
      .get<Usage>(`/api/v1/me/usage?range_days=${rangeDays}`)
      .then((u) => !cancel && setUsage(u))
      .catch(() => {});
    return () => {
      cancel = true;
    };
  }, [rangeDays]);
  return usage;
}

// ─── conversations + messages ────────────────────────────────────────────

export function useConversations(limit = 50) {
  const [convs, setConvs] = useState<Conversation[] | null>(null);
  const reload = useCallback(() => {
    api
      .get<Conversation[]>(`/api/v1/conversations?limit=${limit}`)
      .then(setConvs)
      .catch(() => setConvs([]));
  }, [limit]);
  useEffect(reload, [reload]);
  return { convs: convs ?? [], loading: convs === null, reload };
}

export function useMessages(conversationId: string | null) {
  const [msgs, setMsgs] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!conversationId) {
      setMsgs([]);
      return;
    }
    setLoading(true);
    let cancel = false;
    api
      .get<Message[]>(`/api/v1/conversations/${conversationId}/messages?limit=200`)
      .then((m) => !cancel && setMsgs(m))
      .catch(() => !cancel && setMsgs([]))
      .finally(() => !cancel && setLoading(false));
    return () => {
      cancel = true;
    };
  }, [conversationId]);
  return { msgs, setMsgs, loading };
}

export async function createConversation(title?: string, pinned_context?: string) {
  return api.post<Conversation>("/api/v1/conversations", { title, pinned_context });
}

export async function archiveToVault(conversationId: string) {
  return api.post<{ vault_document_id: string }>(
    `/api/v1/conversations/${conversationId}/archive-to-vault`,
  );
}

// ─── tasks / calendar ────────────────────────────────────────────────────

export function useTasks(params: {
  range_from?: string;
  range_to?: string;
  kind?: "task" | "event";
} = {}) {
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const reload = useCallback(() => {
    tasksApi
      .list(params)
      .then(setTasks)
      .catch(() => setTasks([]));
  }, [params.range_from, params.range_to, params.kind]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(reload, [reload]);
  return { tasks: tasks ?? [], loading: tasks === null, reload };
}

export function useToday() {
  const [items, setItems] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(() => {
    setLoading(true);
    tasksApi
      .today()
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);
  useEffect(reload, [reload]);
  return { items, loading, reload };
}

export { tasksApi };

// ─── vault ───────────────────────────────────────────────────────────────

export function useVault(params: {
  content_type?: string;
  kind?: string;
  archived?: boolean;
} = {}) {
  const [docs, setDocs] = useState<VaultDocument[] | null>(null);
  const reload = useCallback(() => {
    const qs = new URLSearchParams();
    if (params.content_type) qs.set("content_type", params.content_type);
    if (params.kind) qs.set("kind", params.kind);
    if (params.archived !== undefined) qs.set("archived", String(params.archived));
    qs.set("limit", "200");
    api
      .get<VaultDocument[]>(`/api/v1/vault/documents?${qs.toString()}`)
      .then(setDocs)
      .catch(() => setDocs([]));
  }, [params.content_type, params.kind, params.archived]);
  useEffect(reload, [reload]);
  return { docs: docs ?? [], loading: docs === null, reload };
}

export async function searchVault(query: string, limit = 10) {
  return api.post<
    Array<{ document_id: string; title: string; snippet: string; score: number }>
  >("/api/v1/vault/search", { query, limit });
}

export async function createVaultDoc(body: {
  title: string;
  content_md?: string;
  content_type?: VaultContentType;
}) {
  return api.post<VaultDocument>("/api/v1/vault/documents", body);
}

export async function saveArtifact(body: VaultArtifactSave) {
  return api.post<VaultDocument>("/api/v1/vault/artifacts", body);
}

// ─── beauty ──────────────────────────────────────────────────────────────

export function useBeauty() {
  const [items, setItems] = useState<BeautyMedia[] | null>(null);
  const reload = useCallback(() => {
    api
      .get<BeautyMedia[]>("/api/v1/beauty/media?limit=200")
      .then(setItems)
      .catch(() => setItems([]));
  }, []);
  useEffect(reload, [reload]);
  return { items: items ?? [], loading: items === null, reload };
}

// ─── signals ─────────────────────────────────────────────────────────────

export function useSignals(category?: SignalCategory) {
  const [items, setItems] = useState<Quote[] | null>(null);
  const reload = useCallback(() => {
    const qs = new URLSearchParams();
    if (category) qs.set("category", category);
    qs.set("limit", "200");
    api
      .get<Quote[]>(`/api/v1/signals?${qs.toString()}`)
      .then(setItems)
      .catch(() => setItems([]));
  }, [category]);
  useEffect(reload, [reload]);
  return { items: items ?? [], loading: items === null, reload };
}

// ─── memory (settings audit) ─────────────────────────────────────────────

export function useMemories(params: {
  category?: string;
  include_forgotten?: boolean;
} = {}) {
  const [items, setItems] = useState<Memory[]>([]);
  const reload = useCallback(() => {
    const qs = new URLSearchParams();
    if (params.category) qs.set("category", params.category);
    if (params.include_forgotten) qs.set("include_forgotten", "true");
    qs.set("limit", "200");
    api
      .get<Memory[]>(`/api/v1/memory?${qs.toString()}`)
      .then(setItems)
      .catch(() => setItems([]));
  }, [params.category, params.include_forgotten]);
  useEffect(reload, [reload]);
  return { items, reload };
}

// ─── consolidated ────────────────────────────────────────────────────────

export const v3 = {
  // re-exports for convenient single-import in views
  api,
  tasksApi,
  archiveToVault,
  createConversation,
  createVaultDoc,
  saveArtifact,
  searchVault,
};
