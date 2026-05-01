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
      type: "vault_artifact_suggestion";
      title: string;
      content_md: string;
      kind: ArtifactKind;
      tags: string[];
    }
  | {
      type: "citation";
      source_id: string;
      source_kind: "vault" | "file" | "memory" | "web";
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

export type VaultContentType =
  | "note"
  | "journal"
  | "draft"
  | "research"
  | "reference"
  | "idea"
  | "chat_history"
  | "project_artifact";

export type ArtifactKind =
  | "market_research"
  | "three_scenario_sim"
  | "tech_stack"
  | "decision_memo"
  | "knowledge_map"
  | "mind_map"
  | "tok_exploration"
  | "other";

export type VaultDocument = {
  id: string;
  owner_id: string;
  title: string;
  content_md: string;
  content_type: VaultContentType;
  kind: ArtifactKind | null;
  shared: boolean;
  source_file_id: string | null;
  created_at: string;
  updated_at: string;
};

export type VaultArtifactSave = {
  title: string;
  content_md: string;
  kind: ArtifactKind;
  tags?: string[];
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

export type ExamArtifactKind =
  | "cheatsheet"
  | "practice_set"
  | "concept_map"
  | "knowledge_graph"
  | "simulation";

export type ExamArtifact = {
  id: string;
  workspace_id: string;
  kind: ExamArtifactKind;
  title: string;
  mode: Mode;
  status: "generating" | "ready" | "error";
  content: Record<string, unknown> | null;
  created_at: string;
};

// Daily Signals — hourly AI-curated quote feed. Four categories, locked.
export type SignalCategory =
  | "chinese_philosophy"
  | "arabic_philosophy"
  | "francis_su"
  | "inspiration";

export type Quote = {
  id: string;
  category: SignalCategory;
  title: string;
  body: string;
  source_url: string | null;
  source_name: string | null;
  created_at: string;
};

export type QuoteCreate = {
  category: SignalCategory;
  body: string;
  title?: string;
  source_url?: string;
  source_name?: string;
};

// Beauty — clean drag-drop gallery (images + videos).
export type BeautyMediaKind = "image" | "video";
/** @deprecated Use BeautyMediaKind. */
export type TogetherMediaKind = BeautyMediaKind;

export type BeautyMedia = {
  id: string;
  file_id: string;
  kind: BeautyMediaKind;
  mime: string;
  filename: string;
  width?: number | null;
  height?: number | null;
  duration_sec?: number | null;
  caption: string | null;
  taken_at: string | null;
  added_by: string;
  created_at: string;
  // Pre-signed by the backend at list/upload time. Refresh on 403/timeout.
  url?: string | null;
  url_expires_in?: number | null;
};

/** @deprecated Use BeautyMedia. */
export type TogetherMedia = BeautyMedia;

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

// Tasks (calendar + scheduling)
export type TaskKind = "task" | "event";
export type TaskStatus = "pending" | "in_progress" | "done" | "cancelled";

export type Task = {
  id: string;
  owner_id: string;
  kind: TaskKind;
  title: string;
  description: string | null;
  status: TaskStatus;
  starts_at: string | null;
  ends_at: string | null;
  all_day: boolean;
  color: string | null;
  shared: boolean;
  recurrence_rule: string | null;
  location: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type TaskCreate = {
  kind?: TaskKind;
  title: string;
  description?: string | null;
  status?: TaskStatus;
  starts_at?: string | null;
  ends_at?: string | null;
  all_day?: boolean;
  color?: string | null;
  shared?: boolean;
  recurrence_rule?: string | null;
  location?: string | null;
};

export type TaskPatch = Partial<TaskCreate> & { archived?: boolean };

// AI planner
export type PlannedItem = {
  kind: TaskKind;
  title: string;
  description?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
  all_day?: boolean;
  color?: string | null;
  rationale?: string | null;
};

export type PlanRequest = {
  intent: string;
  date_from: string;        // ISO
  date_to: string;          // ISO
  mode?: Mode;
};

export type PlanResponse = {
  items: PlannedItem[];
  summary: string;
  open_questions: string[];
};

// Home layout (bento grid)
export type WidgetLayout = {
  i: string;        // widget id
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
  static?: boolean;
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
