// Wire-format types — keep in sync with apps/api/app/widgets/*.py response models.

export type Mode = "ulzii" | "obama";

export type User = {
  id: string;
  email: string;
  display_name: string;
  role: string;
  avatar_url: string | null;
  timezone: string;
  default_mode: Mode;
};

export type AuthResponse = {
  access_token: string;
  expires_at: string;
  user: User;
};

export type Conversation = {
  id: string;
  title: string | null;
  pinned_context: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

export type ContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; file_id: string; alt?: string }
  | { type: "file"; file_id: string }
  | { type: "signal_card"; signal_id: string }
  | { type: "vault_link"; document_id: string }
  | {
      type: "vault_pin_suggestion";
      title: string;
      content_md: string;
      tags: string[];
    }
  | {
      type: "citation";
      source_id: string;
      source_kind: "vault" | "file" | "memory";
      quote?: string;
    }
  | { type: "thinking"; text: string };

export type Message = {
  id: string;
  conversation_id: string;
  parent_message_id: string | null;
  sender_type: "user" | "ai" | "system";
  sender_user_id: string | null;
  mode: Mode | null;
  model_id: string | null;
  content_blocks: ContentBlock[];
  status: "pending" | "streaming" | "complete" | "error";
  error: string | null;
  created_at: string;
};

export type VaultDocument = {
  id: string;
  owner_id: string;
  title: string;
  content_md: string;
  content_type: string;
  shared: boolean;
  source_file_id: string | null;
  created_at: string;
  updated_at: string;
};

export type VaultSearchHit = {
  document_id: string;
  title: string;
  snippet: string;
  score: number;
};

export type VaultGraph = {
  nodes: Array<{
    id: string;
    label: string;
    content_type?: string;
    centrality?: number;
    x?: number;
    y?: number;
  }>;
  edges: Array<{ source: string; target: string; weight?: number }>;
};

export type ExamWorkspace = {
  id: string;
  title: string;
  subject: string | null;
  created_at: string;
  updated_at: string;
};

export type ArtifactKind =
  | "cheatsheet"
  | "practice_set"
  | "concept_map"
  | "knowledge_graph"
  | "simulation";

export type ExamArtifact = {
  id: string;
  workspace_id: string;
  kind: ArtifactKind;
  title: string;
  mode: Mode;
  status: "generating" | "ready" | "error";
  content: Record<string, unknown> | null;
  created_at: string;
};

export type Signal = {
  id: string;
  category: string;
  title: string;
  body: string;
  source_url: string | null;
  source_name: string | null;
  fetched_at: string;
  expires_at: string;
};

export type SignalsCycle = {
  cycle_id: string | null;
  refreshed_at: string | null;
  expires_at: string | null;
  items: Signal[];
};

export type TogetherPrompt = {
  id: string;
  shown_at: string;
  outcome: string;
};

export type TogetherPhoto = {
  id: string;
  status: "queued" | "composing" | "ready" | "error";
  scene_prompt: string;
  composite_file_id: string | null;
  created_at: string;
  ready_at: string | null;
  error: string | null;
};

export type Memory = {
  id: string;
  owner_id: string;
  scope: string;
  text: string;
  category: string | null;
  salience: number;
  confidence: number;
  source_kind: string | null;
  created_at: string;
  last_used_at: string | null;
};

export type Usage = {
  today_usd: number;
  daily_cap_usd: number;
  by_task: Array<{
    task: string;
    calls: number;
    tokens_in: number;
    tokens_out: number;
    cost_usd: number;
  }>;
  range_days: number;
};
