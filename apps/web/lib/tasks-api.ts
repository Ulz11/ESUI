"use client";

import { api } from "./api";
import type {
  PlanRequest,
  PlanResponse,
  Task,
  TaskCreate,
  TaskPatch,
} from "./types";

/** Calendar + task management API helpers. */
export const tasksApi = {
  /** List tasks/events. Use range_from/range_to to scope to a calendar view. */
  list: (params: {
    kind?: "task" | "event";
    status?: Task["status"];
    range_from?: string;
    range_to?: string;
    include_archived?: boolean;
    include_done?: boolean;
    limit?: number;
  } = {}) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) qs.set(k, String(v));
    }
    const suffix = qs.toString() ? `?${qs}` : "";
    return api.get<Task[]>(`/api/v1/tasks${suffix}`);
  },

  today: () => api.get<Task[]>("/api/v1/tasks/today"),

  get: (id: string) => api.get<Task>(`/api/v1/tasks/${id}`),

  create: (body: TaskCreate) => api.post<Task>("/api/v1/tasks", body),

  patch: (id: string, body: TaskPatch) =>
    api.patch<Task>(`/api/v1/tasks/${id}`, body),

  delete: (id: string) => api.delete<void>(`/api/v1/tasks/${id}`),

  complete: (id: string) =>
    api.post<Task>(`/api/v1/tasks/${id}/complete`),

  uncomplete: (id: string) =>
    api.post<Task>(`/api/v1/tasks/${id}/uncomplete`),

  /** Bulk-create — used after Esui accepts an AI plan. */
  bulk: (items: TaskCreate[]) =>
    api.post<Task[]>("/api/v1/tasks/bulk", items),

  /** Run the AI planner. Does NOT save; show the result for review then bulk(). */
  plan: (req: PlanRequest) =>
    api.post<PlanResponse>("/api/v1/tasks/plan", req),
};

/** Convert a PlannedItem to a TaskCreate ready for bulk(). */
export function plannedToTaskCreate(p: import("./types").PlannedItem): TaskCreate {
  return {
    kind: p.kind,
    title: p.title,
    description: p.description ?? null,
    starts_at: p.starts_at ?? null,
    ends_at: p.ends_at ?? null,
    all_day: p.all_day ?? false,
    color: p.color ?? null,
  };
}
