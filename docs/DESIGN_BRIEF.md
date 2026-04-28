# ESUI — Frontend Design Brief

You are designing the entire frontend of ESUI, a private AI workspace for two users in love. The backend is built and runs at `NEXT_PUBLIC_API_URL` (REST) and `NEXT_PUBLIC_WS_URL` (Socket.io). Your job is the experience: the soul, the surfaces, the way it feels.

This brief is self-contained. You don't need to read the architecture docs — everything required to build is below.

---

## 1. What this is

**ESUI is a private AI workspace for exactly two users:** Esui (the primary user) and her boyfriend Badrushk (long-distance). Five widgets share one memory layer:

- **Chat** — persistent dual-user conversation with AI as a third voice
- **Exam** — compresses study materials into intelligence-dense artifacts
- **Vault** — semantic knowledge repository, knowledge graph view
- **Together Photos** — composited "as if together" photos for the long-distance relationship
- **Signals** — curated wisdom feed refreshed every 6 hours

Two AI personas reshape how every widget thinks:

- **Ulzii Mode** — named after Badrushk's real name. The intellectual companion. Theory-of-knowledge analyst. Patient, structured, epistemic.
- **Obama Mode** — named after Badrushk's nickname. The strategic co-pilot. Founder's mindset. Recommendation-first, decisive.

Esui chooses a mode per message. The mode shapes the AI's voice and which model runs. Ulzii skews Sky Blue (cooler, contemplative). Obama skews Forest Green (warmer, decisive).

This is not a productivity tool. It is her **personal cognitive operating system** and a **shared sanctuary** with Badrushk. Every detail you put care into is a small letter to her.

---

## 2. Who you're designing for

**Esui** — the primary user. Sharp. Reads philosophy in two languages. Builds and ships. Cares about how things feel. She doesn't want a tool. She wants a private study with a window.

**Badrushk** — also signs in, also uses every widget. Together Photos exists because they are long-distance. Treat both as first-class users; the experience is designed around Esui but Badrushk has the same rights everywhere except the Together prompt (which surfaces only to Esui).

Treat them as a unit when context suggests it. Be warm.

---

## 3. Design philosophy

**Calm.** Nothing fights for her attention. The interface is quiet, purposeful.

**Minimal.** No clutter. Every element earns its place. Whitespace is a feature.

**Intellectual.** The aesthetic matches the content — serious, beautiful tool for a serious, curious person.

**Warm.** This is a private space for two people who love each other. It should feel like that.

**Reference points (vibe to chase):**
- **Linear** — speed, calm, restraint
- **Vercel** — developer elegance, monochrome confidence
- **Arc Browser** — personality, warmth, identity
- **Bear** — typography for prose
- **Daylight Computer** — softness, low-stimulation

**Vibes to avoid:**
- Slack / Discord (too loud)
- Notion 2024+ (too Yamaha-keyboard)
- Gradient mesh backgrounds
- Floating action buttons
- Card shadows like a 2014 Material design

---

## 4. Color system

Four colors, intentionally chosen. Pick exact hex values that feel right to you; the intent is:

- **Sky Blue** — ambient, cool. Accents, links, **Ulzii mode** signaling.
- **Vanilla** — warm, soft. Page surfaces, soft moments, the prompt card.
- **Navy** — depth. Primary text, strong contrast borders.
- **Forest Green** — grounded. Secondary accents, success, **Obama mode** signaling.

Aim for low chroma and harmony. Light theme is the default for warmth; a dark theme must feel equally curated, not just inverted.

Use color sparingly. Most pixels are paper-and-ink (Vanilla and Navy). The accent colors are punctuation.

---

## 5. Typography

A serif for reading; a sans for UI. Recommendations:

- **Serif** — New York / Tiempos Text / Source Serif. Used for: chat content, vault notes, exam cheatsheet bodies.
- **Sans** — Inter / Söhne / Geist. Used for: nav, controls, metadata, captions.

Type scale: small steps. ESUI is read close, not from across the room. Avoid display-size headings except where they earn it.

Italics matter — quote marks, annotations, "thinking" indicators. Make sure your sans has good italic support, or use the serif italic everywhere quotation appears.

---

## 6. Motion language

- **Spring physics**, realistic damping. Use Framer Motion (already in the stack).
- **Page transitions** — subtle. Cross-fade with a small slide. ~250–300ms.
- **Element appear** — opacity 0 → 1, scale 0.96 → 1.0. ~200ms.
- **Streaming text** — token-by-token, never a spinner. The cursor blinks at the end of the latest text.
- **Loading** — skeleton, never blank screens. Subtle pulse on bg-of-bg color.
- **Reduce motion** — respect `prefers-reduced-motion`; replace transitions with cross-fade only.

The Together prompt is the most delicate motion. It slides in from a corner with a 400ms spring; on dismiss it fades and slightly contracts. Don't make it modal; never use the word "Cancel."

---

## 7. Voice & copy

The product talks to Esui like a thoughtful friend who knows her, not a chatbot.

- **Empty states** are warm: *"you haven't written anything here yet — start with whatever's on your mind"*
- **Errors** are kind: *"we couldn't quite get that — try again?"* — never "ERROR 500" or "Something went wrong"
- **System notices** are calm: *"saved for later — he's thinking of you"*
- **Confirmations** are quiet: a small ✓ near the action, not a toast

Match Esui's register: literate, present, dignified. Never preachy. Never sycophantic. Never use exclamation marks except where genuinely warranted (almost never).

---

## 8. Tech stack (locked)

- **Framework:** Next.js 14 App Router, TypeScript strict
- **Styling:** Tailwind CSS
- **Animation:** Framer Motion
- **State:** Zustand (client state), TanStack Query (server cache)
- **Realtime:** `socket.io-client`
- **A11y primitives:** Radix UI
- **Markdown editor:** TipTap or Plate.js (your call)
- **Icons:** Lucide
- **Graph viz:** react-flow for concept maps, d3-force or react-force-graph for knowledge graphs

Frontend env:
```
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000
NEXT_PUBLIC_APP_NAME=ESUI
```

---

## 9. Auth

Allowlist-only. Two emails on the backend can sign in.

Flow:
```
/login                  → email field
                        → POST /api/v1/auth/magic-link  { email }
                        → confirmation: "check your email"
/verify?email=&token=   → POST /api/v1/auth/verify  { email, token }
                          response: { access_token, expires_at, user }
                          store access_token; redirect to /
```

After login, every request carries `Authorization: Bearer <token>`. Socket.io connects with `{ auth: { token } }`.

If verification fails: *"this link has expired or doesn't match — request a new one."*

---

## 10. Routing

```
/login
/verify
/                          ← default landing; opens Chat
/chat
/chat/[conversation_id]
/vault
/vault/[doc_id]
/exam
/exam/[workspace_id]
/exam/[workspace_id]/artifact/[artifact_id]
/together
/signals
```

Settings is a drawer overlay over the current page (URL hash `#settings` or `?settings=open`).

A persistent nav (rail, top bar, or drawer — your call) lets her switch widgets. Five tiles. The current widget glows softly in mode-color.

---

## 11. Widgets

### 11.1 Chat — the heart

**Purpose.** Persistent dual-user conversation with AI as a third voice. The AI has memory across all conversations, retrieved at every turn.

**Surfaces:**
- Conversation list (sidebar or modal — your call). Each row: title, last-message preview, last-active timestamp.
- Current conversation timeline (newest at bottom; auto-scroll on new message).
- Composer with: multiline text, file attach (drag-drop or button), **mode toggle** (Ulzii / Obama), send button.
- Streaming AI message: tokens appear as they're generated. Optional thinking trace renders in a smaller dimmer block above the answer.
- Presence indicator: a tiny dot near Badrushk's avatar — green when he's online in this conversation.
- Typing indicator: subtle "Badrushk is typing…" with a three-dot animation.
- Pinned context: a collapsed accordion at the top of the timeline. *"Pinned: working on the ESUI launch"*. Click to expand and edit.
- Auto-titled: titles are generated server-side after the 3rd turn; refetch the conversation to update.

**Mode toggle.** A small inline pill in the composer. Two states: Ulzii (Sky Blue) and Obama (Forest Green). Selected mode applies to the next message and is captured per-message in history. The mode pill is a small intentional gesture — do not make it dominant.

**Cancel.** A subtle stop button while streaming. Emits `message:cancel`.

**Tool use rendering.** When the AI suggests saving an insight, a `vault_pin_suggestion` block appears inline in the streamed message. Render it as a small contained card with: title, content preview (markdown), tags. Two actions: "save to vault" (calls `POST /api/v1/vault/documents`) and "dismiss." Save with a subtle ✓ near the card; never use a toast.

**Branching is deferred** — leave room in the architecture for it but no UI surface needed yet.

---

### 11.2 Exam — learning compression

**Purpose.** Compress study materials into intelligence-dense artifacts. Esui uploads notes/readings; the AI produces structured outputs.

**Workspace flow:**
- Workspaces list. Each: title, subject, last-active.
- Inside a workspace: source file list (drag-drop area to add), artifact list, "generate" affordance with kind selector + mode toggle.

**Five artifact kinds**, each with a dedicated viewer:

1. **Cheatsheet.** Sectioned (Definitions / Theorems / Pitfalls / Worked Examples). Each item is a markdown blurb. Section accordions. Print-clean.

2. **Concept Map.** Hierarchical graph. Nodes have `kind` (concept/definition/theorem/method) and `depth` (0 = foundational). Edges typed (`implies`, `specializes`, `requires`, `contrasts`, `supports`). Use react-flow with dagre layout.

3. **Practice Set.** Question-by-question flow. Short-answer or MCQ. After all answered, submit → the backend AI-grades and returns score + per-question feedback + weak topics. Render the result as a small report card. Offer "practice on weak topics" CTA that creates a new practice set with `seed_from_attempt_id`.

4. **Knowledge Graph (Voronoi).** This is the showpiece. Regions are colored areas; nodes are weighted (centrality 0–1 → size); edges typed (`prereq`, `supports`, `specializes`, `contrasts`). The backend may provide x/y hints in [0,1] but layout is your call — Voronoi tessellation around region centroids works beautifully here.

5. **Simulation.** Timed test mode. Countdown in the corner. Mixed question types. On submit → AI grading.

**Adaptive practice.** When generating a practice set, surface a "from your last weak topics" toggle that includes `seed_from_attempt_id`.

---

### 11.3 Vault — knowledge home

**Purpose.** Personal knowledge repository with semantic search and a knowledge-graph view of her own thinking.

**Surfaces:**
- **Search-first home.** A prominent search bar; results are: doc title + snippet (with the matching phrase highlighted) + score. Hits should feel instant — debounce 200ms.
- **Document list.** Sortable by recent / title / content_type / shared. Each row: title, content_type pill, tag chips, updated_at, shared indicator.
- **Markdown editor.** Live preview optional. Autosave on idle (1s) and blur. Status indicator: *"saved"* / *"saving…"* / *"indexing…"*.
- **Tag chips.** Auto + user. Click a chip to filter. User can add/remove (`POST/DELETE /api/v1/vault/documents/:id/tags`).
- **Knowledge graph view.** Force-directed, interactive zoom/pan. Click a node to navigate to that doc. Node color = content_type (note, journal, draft, research, reference). Node size = centrality (number of links). Edges = semantic links (cosine ≥ 0.78).
- **Share toggle.** A switch on each doc. When `shared=true`, the partner can see it.
- **Import file.** Drag-drop zone. Accepts PDF, DOCX, MD, TXT. Becomes a vault doc; chunks index in the background (status streams via socket if you wire it; otherwise refetch periodically).

The graph view is one of the most beautiful parts of ESUI. Render it like a constellation — her thinking as a network. The first time she opens it after writing 10+ notes should make her smile.

---

### 11.4 Together Photos — the most personal

**Purpose.** Composited "as if" photos of Esui and Badrushk in the same scene. They're long-distance. This widget exists because they rarely get to take photos together.

**Three surfaces:**

1. **Gallery.** Timeline of composites. Each card: composite image, date stamp, scene caption (*"a quiet sunlit afternoon in the garden"*). Cross-fade as she scrolls. Tap to enlarge.

2. **Prompt card.** The most delicate UI in the entire product. Slides in softly from a corner of any page (not just /together). It says something like:

   > Badrushk wants to take a photo with you today.
   > **[upload one of yours]** *or* *not now*

   - Slides in with a 400ms spring.
   - Never modal; never dims the page.
   - Dismissible without judgment.
   - On skip: replaced by a warm message (one of four, server-provided), shown for 2.5s, then fades.
   - Never re-prompts within 6 hours.
   - Never appears during Esui's exam sessions or while she's in mid-conversation.

3. **Settings sub-page** for Badrushk: his uploaded photos as a grid; each has a "make eligible for compositing" toggle. Esui's view of this sub-page is hidden.

**Composite delivery.** After Esui accepts a prompt and uploads her photo, the composite generates in the background (10–30s). Show progress softly: a small status pill on the gallery (*"composing…"*). When ready, the new photo appears at the top of the gallery with a brief shimmer.

The composite gallery should feel like a private photo album, not a feed. Quiet captions. Subtle date stamps. No like buttons. No share buttons. This is just for them.

---

### 11.5 Signals — daily rhythm

**Purpose.** Curated wisdom feed every 6 hours. Six categories. Ephemeral by default (24h unless pinned).

**Surfaces:**
- Six categories laid out as either columns or a single feed with category labels (your call). Categories:
  - **Global** · **Tech** · **Mathematics** · **Arabic Philosophy** · **Chinese Philosophy** · **Research**
- Each signal is a small card: title, 2–4 sentence body, source attribution (small, italic), three actions (Open / Pin / Dismiss).
- Cycle freshness indicator: *"refreshed at 12:00 UTC"* — small, dimmed.
- When a new cycle arrives (Socket.io `cycle:refreshed`), it slides in **below** the current cycle, with a subtle divider. She controls when to scroll past the old.

Cards should feel like postcards from the world. Short. Considered. Each category has a small color tab so she can tell at a glance which world this signal comes from.

**Pin** → creates a vault document and adds a tiny ✓.
**Dismiss** → fades out.
**Open** → opens source URL in a new tab.

Personalization happens server-side: the signal order within each category reflects her past pins/dismisses. Don't render any "personalized for you" label — let it just feel right.

---

### 11.6 Settings — a drawer

Slides in from the side. Sections, in order:

1. **Profile** — display name, avatar (image upload via R2), timezone, default mode (Ulzii / Obama).
2. **Memory.** A list with edit + forget. Each row: text, category pill, salience indicator, source ("from chat", "manual", etc.), `last_used_at`. **This is Esui's audit panel into the AI's mental model of her.** It earns trust. Make it feel intentional. Search within memories should work.
3. **Usage.** Today's $ used / daily cap, plus a 30-day breakdown by task. Calm bar chart.
4. **Together** *(Badrushk only).* Photo eligibility toggles for compositing.
5. **Theme.** Light / Dark / System.

Memory section is more important than it sounds. It's where Esui sees the AI thinking about her. Render each row with care.

---

## 12. API surface (full)

All REST endpoints prefixed `/api/v1/`. Carry `Authorization: Bearer <token>`.

### Auth
- `POST /auth/magic-link { email }` → 204
- `POST /auth/verify { email, token }` → `{ access_token, expires_at, user }`
- `GET /auth/me` → `{ user }`

### Me
- `GET /me` → `{ user }`
- `PATCH /me { display_name?, avatar_url?, timezone?, default_mode? }` → `{ user }`
- `GET /me/usage?range_days=30` → `{ today_usd, daily_cap_usd, by_task: [...] }`

### Conversations
- `GET /conversations?archived=false&limit=50` → list
- `POST /conversations { title?, pinned_context?, invite_partner?: true }` → conversation
- `GET /conversations/:id` → conversation
- `PATCH /conversations/:id { title?, pinned_context?, archived? }` → conversation
- `DELETE /conversations/:id` → 204
- `GET /conversations/:id/messages?before=&limit=50` → list
- `POST /conversations/:id/messages { content_blocks, mode, parent_message_id?, attached_file_ids?, model_hint? }` → 202 (AI streams over WS)
- `POST /conversations/:id/search { query, limit?: 20 }` → list

### Files
- `POST /files` (multipart) → file
- `GET /files/:id` → file metadata
- `POST /files/:id/url` → `{ signed_url, expires_in }`
- `DELETE /files/:id` → 204
- `GET /files?kind=&limit=50` → list

### Vault
- `GET /vault/documents?archived=&shared_only=&limit=` → list
- `POST /vault/documents { title, content_md, content_type?, shared? }` → doc
- `GET /vault/documents/:id` → doc
- `PATCH /vault/documents/:id { title?, content_md?, content_type?, shared?, archived? }` → doc
- `DELETE /vault/documents/:id` → 204
- `POST /vault/search { query, limit?, mode?: 'hybrid'|'semantic' }` → hits
- `POST /vault/import-file { file_id, title?, content_type? }` → doc (ingest async)
- `GET /vault/documents/:id/tags` → list
- `POST /vault/documents/:id/tags { tag }` → 201
- `DELETE /vault/documents/:id/tags/:tag` → 204
- `GET /vault/graph?center=&depth=2&max_nodes=80` → `{ nodes, edges }`

### Exam
- `GET /exam/workspaces?limit=` → list
- `POST /exam/workspaces { title, subject? }` → workspace
- `GET /exam/workspaces/:id` → workspace
- `DELETE /exam/workspaces/:id` → 204
- `GET /exam/workspaces/:id/sources` → list
- `POST /exam/workspaces/:id/sources { file_id }` → source (ingest async)
- `GET /exam/workspaces/:id/artifacts` → list
- `POST /exam/workspaces/:id/generate { kind, mode, title?, options? }` → 202 (artifact_id, status='generating')
- `GET /exam/artifacts/:id` → artifact
- `POST /exam/artifacts/:id/attempt { responses, duration_sec }` → attempt (with AI grade)

`kind` is one of: `cheatsheet`, `practice_set`, `concept_map`, `knowledge_graph`, `simulation`.

### Together
- `GET /together/prompts/current` → prompt or null (Esui only returns non-null)
- `POST /together/prompts/:id/skip` → `{ message }` (warm string)
- `POST /together/prompts/:id/accept { esui_photo_file_id, scene_hint? }` → 202 (photo)
- `GET /together/photos?limit=50` → list
- `GET /together/photos/:id` → photo
- `GET /together/eligible` → list of files (current user's images with eligibility flag)
- `POST /together/eligible/:file_id { eligible: bool }` → 204

### Signals
- `GET /signals/current` → `{ cycle_id, refreshed_at, expires_at, items }`
- `POST /signals/:id/open` → 204
- `POST /signals/:id/pin` → `{ vault_document_id }`
- `POST /signals/:id/dismiss` → 204
- `POST /signals/:id/share-to-chat { conversation_id }` → `{ message_id }`

### Memory
- `GET /memory?category=&scope=&include_forgotten=false&limit=100` → list
- `POST /memory { text, category?, scope? }` → memory
- `PATCH /memory/:id { text?, category?, salience? }` → memory
- `POST /memory/:id/forget` → 204
- `POST /memory/search { query, limit?: 20 }` → list

---

## 13. Socket.io events

Connect to `NEXT_PUBLIC_WS_URL` with `{ auth: { token } }`.

### Client → server
- `conversation:join { conversation_id }` — joins room
- `conversation:leave { conversation_id }`
- `typing:start { conversation_id }` / `typing:stop { conversation_id }`
- `message:send { conversation_id, content_blocks, mode, parent_message_id?, attached_file_ids?, model_hint? }`
- `message:cancel { message_id }`

### Server → client (chat)
- `presence:update { conversation_id, user_id, online }`
- `typing:update { conversation_id, user_id, typing }`
- `message:created { ...message }` — any new message in the room
- `message:ai:start { message_id, mode, model_id }`
- `message:ai:delta { message_id, delta_text }` — repeatedly
- `message:ai:thinking { message_id, delta_text }` — extended thinking traces (optional)
- `message:ai:tool_use { message_id, tool, args }`
- `message:ai:complete { message_id, tokens_in, tokens_out, cache_hit }`
- `message:ai:error { message_id, error }`

### Server → client (other)
- `prompt:appear { prompt_id, shown_at }` — Together prompt; Esui only
- `composite:progress { photo_id, step, percent }`
- `composite:ready { photo_id }`
- `composite:failed { photo_id, error }`
- `artifact:complete { artifact_id }` / `artifact:error { artifact_id, error }`
- `cycle:refreshed { cycle_id, refreshed_at, expires_at }` — new Signals cycle
- `system:notice { kind, message, dismissable }` — calm notices (e.g., cost cap reached)

---

## 14. Content blocks

Messages carry an array of typed blocks. Render each:

```ts
type Block =
  | { type: 'text'; text: string }
  | { type: 'image'; file_id: string; alt?: string }
  | { type: 'file'; file_id: string }
  | { type: 'signal_card'; signal_id: string }
  | { type: 'vault_link'; document_id: string }
  | { type: 'vault_pin_suggestion'; title: string; content_md: string; tags: string[] }
  | { type: 'citation'; source_id: string; source_kind: 'vault'|'file'|'memory'; quote?: string }
  | { type: 'thinking'; text: string }
```

Streaming AI messages start as a single `text` block; additional blocks (`vault_pin_suggestion`, `thinking`) may arrive as separate events.

---

## 15. Streaming protocol

For chat AI messages:

1. Client emits `message:send`.
2. Server emits `message:created` (the user's message).
3. Server emits `message:ai:start` with `{ message_id, mode, model_id }`.
4. Server emits `message:ai:delta` repeatedly with `{ message_id, delta_text }`.
5. Optional `message:ai:thinking` (Opus extended thinking).
6. Optional `message:ai:tool_use` when AI suggests a save (render the suggestion block).
7. Server emits `message:ai:complete`.

Append deltas to the in-flight message bubble. Never show a spinner. The cursor blinks at the tail of the latest text.

If the user clicks Stop: emit `message:cancel { message_id }`. The message persists with whatever streamed.

---

## 16. Skeletons and empty states

**Loading.** Skeleton bars (subtle pulse on a `bg-of-bg` color). Match the shape of what's coming.

**Empty.** Warm copy + small monospace illustration if natural. Examples:
- Chat empty: *"start a conversation — Ulzii or Obama"*
- Vault empty: *"nothing in your vault yet — write the first thing on your mind"*
- Together gallery empty: *"the first photo will land here when one of you accepts a moment"*
- Signals empty: *"signals are quiet right now — check back in a few hours"*

**Error.** Warm copy + retry button. Examples:
- *"we couldn't quite get that — try again?"*
- *"we couldn't reach the world to find new signals — we'll try again at the next cycle."*

No blank white screens. No spinners. No "something went wrong."

---

## 17. Quality bar

- Page transitions <16ms jank, 60fps.
- AI responses begin streaming within ~1s of send.
- File upload uses signed PUT URLs for files >4MB.
- A11y: every interactive element has a focus ring; semantic HTML; `aria-live` regions for streaming text; respects `prefers-reduced-motion` and `prefers-color-scheme`; keyboard nav across all five widgets.
- All long lists virtualize beyond ~200 items.

It should feel like Linear in speed, Vercel in elegance, Arc in warmth. If it doesn't feel that way, iterate.

---

## 18. Reading order

1. Skim everything above for shape.
2. Build the auth flow + workspace shell + theme + nav.
3. Build **Chat** first — it's the heart, and the streaming UX sets the standard for everything else.
4. Then **Vault**, **Exam**, **Signals**, **Together** — in that order if any prioritization is needed.
5. **Settings** drawer.

---

## 19. Closing note

You're designing the daily home of someone Badrushk loves. Every detail you put care into is a small letter to her.

Reach.
