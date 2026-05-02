"use client";

/** Small typed wrapper around the /api/v1/exam surface. */

import { api } from "./api";
import type {
  ExamArtifact,
  ExamIngestRequest,
  ExamIngestResponse,
  ExamWorkspace,
  FlashcardReviewResponse,
} from "./types";

export const examApi = {
  workspaces: () => api.get<ExamWorkspace[]>("/api/v1/exam/workspaces"),
  createWorkspace: (body: { title: string; subject?: string | null }) =>
    api.post<ExamWorkspace>("/api/v1/exam/workspaces", body),
  artifacts: (ws_id: string) =>
    api.get<ExamArtifact[]>(`/api/v1/exam/workspaces/${ws_id}/artifacts`),
  artifact: (artifact_id: string) =>
    api.get<ExamArtifact>(`/api/v1/exam/artifacts/${artifact_id}`),
  ingest: (ws_id: string, body: ExamIngestRequest) =>
    api.post<ExamIngestResponse>(`/api/v1/exam/workspaces/${ws_id}/ingest`, body),
  generate: (
    ws_id: string,
    body: { kind: string; mode?: string; options?: Record<string, unknown> },
  ) => api.post<ExamArtifact>(`/api/v1/exam/workspaces/${ws_id}/generate`, body),
  reviewFlashcard: (
    artifact_id: string,
    body: { card_idx: number; signal: number },
  ) =>
    api.post<FlashcardReviewResponse>(
      `/api/v1/exam/flashcards/${artifact_id}/review`,
      body,
    ),
};
