# ESUI — Design Brief V3 (final, locked)

This brief is the single source of truth. **V1 and V2 are superseded.** Everything below is current. Build from this and only this.

You are designing the frontend for ESUI — a private, single-tenant AI workspace. The backend is built and runs at `NEXT_PUBLIC_API_URL` (REST) and `NEXT_PUBLIC_WS_URL` (Socket.io). Your job is the experience.

---

## 0. The thing you're designing

ESUI is a **private cognitive operating system for one user, Esui.** It is named after her.

It is a sanctuary where she thinks, learns, creates, and lives her intellectual life — guided by two carefully engineered AI personas, both named after her boyfriend Badrushk (his real name *Ulzii*; his nickname *Obama*). The choice to name them after him is the gift: when she uses the AI, she is in a sense choosing how her boyfriend thinks with her.

He is the engineer. He is **not a co-user**. He has a single read-only privilege: he can see the photos and videos she drops into the **Beauty** gallery. Everything else is hers privately.

The system prompts that define Ulzii and Obama are not generic LLM personas. They are engineered through prompt design for two specific cognitive postures. **The prompts are the product.** The chat UI is the surface. Treat them with care.

---

## 1. Locked product map

Six routes. No more, no less.

| Route | What it is |
|---|---|
| **Chat** | Two engineered modes — Obama (Tech / Business / Founder) and Ulzii (TOK / Teacher / Growth). Streaming, memory, retrieval. Tools that save outputs to Vault. |
| **Calendar** | Top-level. Daily schedule planner with AI (`/tasks/plan` proposes, `/tasks/bulk` accepts). Month / Week / Day views. |
| **Vault** | Four tabs: **Ideas** · **Notes** · **Chat history** · **Project artifacts**. Plus a Knowledge Graph view (3D, Jarvis-level). Search across everything. |
| **Beauty** | Esui's gallery — images and videos she drops in. Formal, clean, modern. Badrushk has read-only here, and only here. |
| **Daily Signals** | Hourly AI-curated quote feed from four locked sources. |
| **Exam** | Study compression — cheatsheets, practice sets, concept maps, knowledge graphs (3D), simulations. Mode-aware. |

---

## 2. Who Esui is (and how it shows up in design)

She is sharp, intellectually serious, reads philosophy in two languages, builds and ships, cares about how things feel. She doesn't want a tool — she wants a **private study with a window**, a quiet, dignified space where time slows down enough to think.

Design implications:
- **No noise.** No badges, no notifications screaming, no nudges to engage.
- **No emoji** unless explicitly warranted (almost never).
- **No "great question."** No "I'd be happy to help." No `[Just a sec! Working on it...]` cuteness.
- **Generous whitespace.** Type that breathes. Pages that feel composed.
- **Italics for emphasis on the load-bearing word**, not for ornament.

---

## 3. Design philosophy

**Calm.** Nothing fights for her attention.

**Minimal.** Every element earns its place. Whitespace is a feature.

**Intellectual.** The aesthetic matches the content — a serious, beautiful tool for a serious, curious person.

**Warm.** This is built by someone who loves her. It should feel like that, quietly.

**Reach for:** Linear (speed and restraint), Vercel (monochrome confidence), Arc Browser (warmth, identity), Bear (typography for prose), Daylight Computer (low-stimulation softness).

**Avoid:** Slack/Discord (loud), Notion 2024+ (Yamaha-keyboard menus), Material Design saturation, gradient mesh backgrounds, floating action buttons, shadow-heavy "card" tropes, AI-generated illustration packs.

---

## 4. Palette (locked)

Four colors. Pick exact hex you like; the intent:

- **Sky Blue** — ambient, cool. Accents, links, **Ulzii mode** signaling, the dominant glow in 3D graphs.
- **Vanilla** — warm, soft. Page surfaces, soft moments.
- **Navy** — depth. Primary text, strong contrast borders, the background of the 3D space.
- **Forest Green** — grounded. Secondary accents, success states, **Obama mode** signaling.

Most pixels are paper-and-ink (Vanilla + Navy). The accents punctuate. Light theme is the default; the dark theme must feel equally curated, not just inverted.

---

## 5. Typography

A serif for reading; a sans for UI.

- **Serif:** Source Serif 4 / New York / Tiempos Text — for chat AI bodies, vault notes, signal quotes, exam cheatsheets.
- **Sans:** Inter / Söhne / Geist — for nav, controls, metadata, captions, calendar grid.

Tabular numerals on the homepage clock and calendar — digits should not dance. Italic must look beautiful in your serif of choice; that style carries quotation and emphasis throughout.

---

## 6. Motion

- **Spring physics**, realistic damping. Use **Framer Motion** (already in deps).
- **Page transitions** — cross-fade with a small slide. ~250–300ms.
- **Element appear** — opacity 0 → 1, scale 0.96 → 1.0. ~200ms.
- **Streaming text** — token-by-token, cursor blinks at the tail. Never a spinner.
- **Loading** — skeletons, never blank screens.
- **Reduce motion** — respect `prefers-reduced-motion`; replace transitions with cross-fade only.

---

## 7. Voice & copy

The product talks to her like a thoughtful friend who knows her.

- **Empty:** *"nothing here yet — write the first thing on your mind."*
- **Error:** *"we couldn't quite get that — try again?"* — never "ERROR 500."
- **System notice (cost cap):** *"daily AI budget reached — staying on Sonnet for the rest of the day."*
- **Cancel button:** never the word "Cancel" on a soft surface. Use "not now" or just an ×.

Match her register: literate, present, dignified. Never preachy. Never sycophantic. Never apologize for thinking.

---

## 8. Tech stack (locked)

```
Next.js 14 (App Router) · TypeScript strict · Tailwind CSS
Framer Motion · Zustand · TanStack Query
socket.io-client · Radix UI primitives
react-three-fiber + @react-three/drei + @react-three/postprocessing
react-force-graph-3d · react-grid-layout
react-flow (concept maps) · TipTap or Plate.js (markdown editor)
Lucide (icons)
```

Frontend env:
```
NEXT_PUBLIC_API_URL=https://api.esui.app
NEXT_PUBLIC_WS_URL=wss://api.esui.app
NEXT_PUBLIC_APP_NAME=ESUI
```

---

## 9. Single-tenant access model

```
Esui (role='esui')         full access to all six routes + Settings
Badrushk (role='badrushk') redirect to /beauty on login
                           navigation hides everything except Beauty
                           backend rejects writes (require_esui)
```

When Badrushk logs in, the AppShell sees `user.role === 'badrushk'` and shows only the Beauty surface. No mode toggle, no settings drawer, no nav rail items beyond a small "sign out." His view is consumption-only.

---

## 10. The two AI modes (the heart of the product)

The mode toggle is in the chat composer. Selected mode applies to the next message. The mode is captured per-message in history (so a conversation can mix modes, and the visual register can shift accordingly).

### Obama — Tech / Business / Founder

**Cognitive posture.** Builder + competitive strategist. Reads code. Knows the modern stack. Recommendation-first; tradeoffs are the unit of analysis. Three-scenario thinking (conservative / base / aggressive) for non-trivial decisions.

**What he produces** (each savable to Vault as a project_artifact via the `save_artifact` tool):
- Market research with named players, moats, seams
- Three-scenario simulations
- Tech-stack proposals with the swap-out path
- Decision memos

**Visual register.**
- **Forest Green** accent on the mode pill.
- The composer hint, when Obama mode is selected: *"what are we shipping or deciding?"*
- After a turn that produced something durable, the save card is rendered with a Forest Green rule.
- Provider chips (when Obama → Gemini for market research): *"Gemini · web grounded"*

**Affordances** (small, optional buttons in the chat header when in Obama mode):
- *"Run 3-scenario sim"* — pre-fills a prompt
- *"Propose tech stack"* — pre-fills a prompt
- *"Market research"* — pre-fills a prompt and biases toward Gemini route

### Ulzii — TOK / Teacher / Growth

**Cognitive posture.** Theory-of-Knowledge analyst and learning architect. The unit of inquiry is the **knowledge question**. The map is the **areas of knowledge**. The faculties are the **ways of knowing**. Builds her capacity to think across domains, not just teach content. Psychological literacy is part of the role.

**What he produces** (savable to Vault as project_artifact):
- Knowledge maps (Voronoi-style — regions = AOKs, weighted nodes, typed edges)
- Mind maps (hierarchical concept trees)
- TOK explorations (knowledge questions, AOK boundary diagnoses, WOK analysis)
- Histories and adjacent areas of knowledge

**Visual register.**
- **Sky Blue** accent on the mode pill.
- The composer hint, when Ulzii mode is selected: *"what would you like to understand?"*
- Streaming text in serif by default; the cursor pulses gently.
- Provider chips when Ulzii → Sonar Deep Research for citation-grounded answers.

**Affordances** in chat header when in Ulzii mode:
- *"Sketch the territory"* — pre-fills "give me a knowledge map of [topic]"
- *"Open a knowledge question"* — pre-fills "what's the deepest knowledge question hiding in [topic]?"
- *"Bridge to another field"* — pre-fills "where does [topic] meet [adjacent area]?"

These affordances are **subtle** — small ghost buttons that appear when a mode is selected and the composer is empty. They disappear once she starts typing.

---

## 11. Auth

Allowlist (two emails — hers and his). Magic link.

```
/login                  email field
                        POST /api/v1/auth/magic-link  { email }
/verify?email=&token=   POST /api/v1/auth/verify  { email, token }
                        → { access_token, expires_at, user }
```

After login: route by role. Esui → home. Badrushk → /beauty.

---

## 12. Routing

```
/login
/verify
/                              home (BentoGrid; draggable + resizable)
/chat
/chat/[conversation_id]
/calendar                      NEW top-level
/calendar/today
/vault
/vault/ideas
/vault/notes
/vault/notes/[doc_id]
/vault/chat-history
/vault/chat-history/[doc_id]
/vault/artifacts
/vault/artifacts/[doc_id]
/vault/graph                   (3D)
/beauty
/signals
/exam
/exam/[workspace_id]
/exam/[workspace_id]/artifact/[artifact_id]
/settings                      drawer overlay
```

A small persistent nav (rail or top bar — your call) lets her switch between the six routes + settings. Active route glows in mode color (Sky if Ulzii is the active mode, Forest if Obama).

---

## 13. Surfaces

### 13.1 Home — BentoGrid (draggable + resizable)

The home is a **macOS-desktop-like bento** that she arranges. Use the existing primitive `<BentoGrid>` from `@/components/BentoGrid` (wraps `react-grid-layout` with localStorage persistence and an edit-mode toggle).

**Default tiles:**
- **Time hero** — date + tabular-nums clock, optional warm greeting tied to local time
- **Today** — calls `GET /api/v1/tasks/today`; shows next 24h events + open undated todos
- **Recent chats** — last 3 conversations, click to resume
- **Recent signals** — last 4 quotes (one per category)
- **Recent vault** — last 3 docs (any tab)
- **Mode quick-launch** — two big buttons: "ask Ulzii" / "tell Obama"

**Edit mode toggle** — a small pencil icon top-right. When on:
- Tiles get a subtle drag handle
- Resize handles appear at corners
- A "reset layout" link appears
- Outside-click or Esc exits edit mode

Layout persists in `localStorage` keyed `esui:home:<user_id>`. No server sync needed for v1.

### 13.2 Chat

**Composer** at the bottom: multiline text, mode toggle pill, file attach, send. The send button is small; Cmd+Enter is the primary flow.

**Mode toggle** — inline pill. Two states (Ulzii Sky Blue / Obama Forest Green). Cmd+/ to swap. The pill is small and intentional.

**Mode affordances** — when the composer is empty and a mode is active, three small ghost buttons appear above the composer (the affordances listed in §10). When she starts typing, they fade.

**Conversation timeline** — newest at bottom, auto-scroll on new message. AI bubbles use the serif body. User bubbles use the sans, smaller, right-aligned. Each AI message has:
- The mode pill (subtle, prefix to the bubble)
- A provider/intent chip below: *"Opus · deep"* or *"Gemini · web grounded"* or *"Sonar · 14 sources"* (only visible on hover, or as a quiet line)
- A small action menu on hover: *copy* · *cite* · *archive thread to vault*

**Streaming** — tokens appear as they're generated. Cursor at the tail. Word-by-word feels best; don't batch.

**Tool-use cards** — when the AI invokes a tool, a content block is appended to the streamed message. Render each:
- `vault_pin_suggestion` — small inline card: title, content preview (~3 lines), tag chips, two actions: *save to vault* / *dismiss*. Save calls `POST /api/v1/vault/documents`.
- `vault_artifact_suggestion` — larger card with the artifact's `kind` shaping the visual. *Market research* gets a small table treatment. *Three-scenario sim* gets three columns. *Knowledge map* gets a thumbnail of the graph (you can render a low-detail 3D preview on-card). Two actions: *save to vault* / *dismiss*. Save calls `POST /api/v1/vault/artifacts`.
- `citation` — render as a numbered footnote at the bottom of the message: `[1] [2] [3]`. Each is a link to the cited URL/source.

**Cancel** — a subtle stop button while streaming. Emits `message:cancel`.

**Pinned context** — a collapsed accordion at the top of the timeline.

**Archive to Vault** — a small "archive thread" link at the conversation header. Calls `POST /api/v1/conversations/:id/archive-to-vault` → creates a `chat_history` Vault doc and shows a tiny *"saved to Vault › Chat history"* toast.

**Conversation list** — a sidebar (or modal). Each row: title, last preview, last-active timestamp, mode of last AI message as a small pip.

### 13.3 Calendar (NEW top-level)

A proper calendar surface. Three views, switchable in the header (segmented control: **Month / Week / Day**). Default to Week.

**Month view.** 7×~6 grid. Each cell shows up to 3 events as colored pills + "+N more" overflow. Today is highlighted by a thin Sky Blue ring (not a fill). Click a day → switch to Day view for that date. Drag an event to another day → `PATCH /tasks/:id` with new `starts_at`.

**Week view.** Time grid (08:00–22:00 default; scrollable to 00:00). Days as columns. Events render as colored blocks spanning their time. Tasks with due dates render as small badges at the top of their column. Drag to reschedule (vertical → time, horizontal → day). Resize the bottom edge → adjust `ends_at`. Click empty space → quick-create modal pre-filled with that slot.

**Day view.** Single column, full timeline. Same drag/resize. A right rail shows undated todos as a clean list — drag from rail onto timeline to schedule.

**Plan with AI** — a primary button in the header. Opens a modal:
- Free-form intent textarea: *"what would you like to plan?"*
- Range: defaults to today; she can pick another date or a range.
- Mode toggle: Ulzii (energy curves, deep work) or Obama (leverage-first, time-boxed).
- Submit → calls `POST /api/v1/tasks/plan` (Opus, ~10–20s; show a serene streaming-feel loader).
- Response: a review surface showing `summary`, then `items[]` as draft event/task cards (each with `rationale`), then `open_questions` if any.
- Actions: *accept all* (calls `POST /api/v1/tasks/bulk`) / *edit then accept* / *discard*. Editing is inline on each item.

**Inline editing.** Click any event/task → side panel slides in from the right (or modal on small screens). All fields editable. Save on blur or Cmd+S. Delete with single-click confirm (no two-step).

**Quick-create.** `n` shortcut or click an empty slot. Composer with: title (autofocus), kind toggle (task/event), date/time, color swatch, description.

### 13.4 Vault (4 tabs + Graph)

Tab bar in the header: **Ideas** · **Notes** · **Chat history** · **Project artifacts** · **Graph**. Search bar scopes to active tab.

**Ideas** — quick captures. List view, terse: title + 1-line preview + age. Compose with `n` — a small textarea that saves on blur. `content_type=idea`.

**Notes** — the structured notes surface. Markdown editor (TipTap or Plate.js). Autosave on idle (1s). `content_type=note`. Four sub-types via `content_type` enum: `note`, `journal`, `draft`, `research`, `reference`.

**Chat history** — archived conversations. Each row: title, date, mode pip, message count. Click to open the rendered transcript. Search hits highlight matches inline.

**Project artifacts** — the durable outputs from chat. Each row: title, `kind` chip (market_research / three_scenario_sim / tech_stack / knowledge_map / mind_map / tok_exploration / decision_memo / other), date. Click to open. Each `kind` has a tailored renderer:

- `market_research` → table of players + moats + seams + summary
- `three_scenario_sim` → three columns (conservative / base / aggressive) with assumption + outcome
- `tech_stack` → annotated stack diagram (or list with rationale)
- `decision_memo` → markdown with a clear recommendation block
- `knowledge_map` → 3D graph (the showpiece — see §14)
- `mind_map` → react-flow hierarchical
- `tok_exploration` → markdown with knowledge-question pull quotes
- `other` → markdown

**Graph tab** — the 3D constellation across the entire Vault. See §14.

**Tags** — chips on each doc. AI-generated tags render in italic at slightly lower opacity; user tags regular. Click a chip to filter the active tab.

**Sharing toggle** — drop it. Single-tenant. Don't render it.

### 13.5 Beauty

A clean, formal gallery for images and videos she drops in.

**Layout.** The current uniform grid is OK but conventional. Reach for: bento-style sizing where landscape vs portrait vs video gets different real estate; or true masonry; or a "wall" with subtle drop shadows that suggests printed photographs. The grid should feel like a curated spread, not a CMS.

**Date organization.** Items sort by `created_at` desc. Consider quiet date dividers ("today", "yesterday", "this week", "March 2026") that feel like titles in a bound book — or no dividers, just generous gaps when the date breaks.

**Captions.** Lightbox + hover (my recommendation).

**Lightbox.**
- Arrow-key navigation between items (and swipe on touch)
- Smooth scale/blur transition on open and close
- Inline caption editing (click → edit → save on blur)
- Video controls + scrubbing; no auto-play in cards (battery, attention)

**Drag overlay** — when files are dragged over the page, soft tint over the entire viewport with a quiet "drop to add" indicator. The depth-counter pattern in the existing widget prevents flicker.

**Upload progress** — a small chip header *"uploading 3"*; a per-file skeleton card resolving into the real one when complete.

**Empty state.** Single line of warm copy that captures what this gallery is for. Quiet illustration optional.

**Endpoints (live):**
```
GET    /api/v1/beauty/media           list — pre-signed URLs included inline
POST   /api/v1/beauty/media           multipart upload
PATCH  /api/v1/beauty/media/:id       caption / taken_at edits
POST   /api/v1/beauty/media/:id/url   refresh signed URL
DELETE /api/v1/beauty/media/:id       remove
```

For Badrushk: same routes work. Writes are blocked server-side. The frontend hides upload + delete affordances when `user.role === 'badrushk'`.

### 13.6 Daily Signals

Hourly AI-curated quote feed. Four locked sources:

| key | source |
|---|---|
| `chinese_philosophy` | Tao Te Ching · Zhuangzi · Confucius (Analects) · Mencius · Sun Tzu · Wang Yangming · ... |
| `arabic_philosophy` | Al-Farabi · Ibn Sina · Al-Ghazali · Ibn Rushd · Ibn Tufayl · Ibn Khaldun · ... |
| `francis_su` | *Mathematics for Human Flourishing* — Francis Su |
| `inspiration` | Marcus Aurelius · Simone Weil · Annie Dillard · Anne Carson · Borges · Tolstoy · ... (real, **not cringe**) |

Cron adds 1 quote per category per hour (4/hour). Quotes persist (no expiration). She can also add manually via `POST /api/v1/signals`.

**Layout.** This is for *contemplation*, not consumption. Try:
- A single "currently reading" view where one quote takes center stage, with quiet navigation between sources
- Or a chapter view where each source is its own page
- Or a vertical stream with paper-textured dividers between sources

**Typography first.** Big serif body. Small italic attribution. Generous leading. **Reading is the act.** Add/delete are secondary affordances that fade unless invoked.

**Per-source identity.**
- *Chinese philosophy* — terseness; pull quotes that read like poetry
- *Arabic philosophy* — contemplative, classical
- *Francis Su* — humane, the bridge between math and lived life
- *Inspiration* — texture, weight on the page

Each source gets a quiet color tab (use the brand palette + at most one subdued extra) and a dedicated empty-state copy.

**Actions per quote.**
- *Pin to vault* → creates a `reference` Vault doc.
- *Open* → opens source URL if present.
- *Delete* → removes from feed.
- *Share to chat* → builds a `signal_card` content block in the chat composer.

**Endpoints:**
```
GET    /api/v1/signals?category=&limit=200   → Quote[]
POST   /api/v1/signals                        manual add
PATCH  /api/v1/signals/:id                    edit
DELETE /api/v1/signals/:id                    remove
POST   /api/v1/signals/:id/pin                save to vault
```

### 13.7 Exam

Compress study materials into intelligence-dense artifacts. Five kinds:

- **Cheatsheet** — section accordions. **Mode-aware sections**:
  - Ulzii: Foundations / Theorems & Proofs / Dependencies / Pitfalls / Worked Examples
  - Obama: 3-line Summary / Decision Points / Action Templates / Failure Modes / Worked Example
- **Practice set** — question-by-question flow → submit → AI-graded results page with weak-topics report and a "practice on weak topics" CTA (sets `seed_from_attempt_id` in the next generate request).
- **Concept map** — hierarchical (react-flow + dagre).
- **Knowledge graph** — 3D Voronoi (see §14).
- **Simulation** — timed test mode with countdown + AI grading.

Workspaces hold sources. Drag-drop a PDF/note → ingest pipeline runs in background → chunks indexed → ready to generate from.

### 13.8 Settings (drawer)

Slides in from the right over the current page. Sections:

1. **Profile** — display name, avatar, timezone, default mode (Ulzii / Obama).
2. **Memory** — audit panel into the AI's mental model of her. List with edit + forget. Each row: text, category pill, salience indicator, source ("from chat", "manual"), `last_used_at`. Search semantically. Add manual memory ("remember that I prefer X"). **This is where she earns trust in the AI's persistence.** Calm, organized, dignified.
3. **Usage** — today's $ / 30-day breakdown.
4. **Theme** — Light / Dark / System.

No Together-eligibility section (Beauty has no compositing).

---

## 14. The 3D Knowledge Graph (the showpiece)

This is the visual that makes her stop. It applies to **two surfaces**:

- The **Vault Graph tab** (`GET /api/v1/vault/graph`) — the constellation of her own thinking.
- The **Exam knowledge_graph artifact** — the territory of a subject.

Both should use the same 3D rendering system; data shape and label treatment differ.

### Tech direction

- `@react-three/fiber` + `@react-three/drei` for the scene.
- `react-force-graph-3d` is the fastest path — Three.js force-directed 3D graph with hover/click/zoom/orbit out of the box. Customize node + link rendering.
- `@react-three/postprocessing` for **bloom** (the glow).
- Cap node count at ~300 visible; paginate or cluster beyond.

### Visual language

- **Background:** deep Navy approaching black, with a subtle vignette and a barely-visible particle field. Suggest space, not a coordinate plane.
- **Nodes:** small glowing spheres. Color by `content_type` (Vault) or `region` (Exam). Inner core slightly brighter than the halo. Hover → halo expands and pulses softly.
- **Edges:** thin lines with faint emissive material. Opacity tracks `strength`. For typed edges (Exam), use color: prereq=Sky Blue, supports=Forest, specializes=Vanilla, contrasts=warm red.
- **Light flow:** along edges between connected nodes, a small light particle travels every ~3–5s, randomized phase. Subtle.
- **HUD overlays:** when hovering a node, a small holographic-style panel anchors near it: title, content_type, last touched, top 3 connected nodes. Sky-Blue rule, monospaced numerals.
- **Camera:** orbit controls with momentum + damping. Auto-rotate slowly when idle (0.05 rad/s). Stop on user interaction.
- **Click:** smooth tween to focus a node. The selected node grows slightly; 1-hop neighbors brighten; everyone else dims to ~25%.

### Animation language

- Idle nodes breathe: scale 0.96 → 1.04 over 4–6s, randomized phase.
- Edges shimmer slowly (0.7 → 1.0 opacity over 8s).
- Camera idle rotation pauses on interaction, resumes after 8s of stillness.
- Light particles travel along edges at ~0.4 units/sec.
- All animations respect `prefers-reduced-motion` — skip the breathe and shimmer, keep the camera static.

### Don't

- No holographic film-grain.
- No neon cyan/orange Iron Man HUD.
- Stay in the ESUI palette.
- Don't auto-zoom-to-fit on every load — preserve last camera per graph.

### Performance bar

- 60 fps for graphs up to 200 nodes / 600 edges.
- < 100 ms time-to-first-paint on initial mount (skeleton during scene init is fine).
- Graceful fallback to a 2D `react-force-graph` when WebGL is unavailable or `prefers-reduced-motion` is set.

### Data shapes

**Vault graph** — `GET /api/v1/vault/graph?center=&depth=2&max_nodes=80`:
```ts
{
  nodes: Array<{
    id, title, tags: string[], updated_at: ISO,
    content_type: 'note'|'idea'|'journal'|'draft'|'research'|'reference'|'chat_history'|'project_artifact'
  }>,
  edges: Array<{
    source, target, kind: 'semantic'|'explicit',
    strength?: number, note?: string
  }>
}
```

**Exam knowledge_graph artifact** — `payload`:
```ts
{
  version: 1,
  regions: Array<{ id, label, color? }>,
  nodes: Array<{
    id, label, region: string,
    weight: number,        // 0..1 → node size
    x?: number, y?: number, // 2D hints, ignore in 3D
    summary?: string
  }>,
  edges: Array<{ from, to, kind: 'prereq'|'supports'|'specializes'|'contrasts' }>
}
```

---

## 15. Save-to-Vault flow (chat tools)

Two tools the AI can invoke during a chat turn. Both render as content blocks in the streamed message; both require Esui's click to actually persist.

### `vault_pin_suggestion`
Small contained card. The AI is suggesting a small note worth keeping.
```ts
{ type: 'vault_pin_suggestion', title, content_md, tags: string[] }
```
Render: title (bold), content_md preview (markdown, ~3 lines, "show more"), tag chips. Actions: *save to vault* (POST `/api/v1/vault/documents` with `content_type='note'`) → ✓; *dismiss* → fade.

### `vault_artifact_suggestion`
Larger card. The AI produced a durable artifact (market research, 3-scenario sim, knowledge map, etc.).
```ts
{
  type: 'vault_artifact_suggestion',
  title, content_md, tags: string[],
  kind: 'market_research'|'three_scenario_sim'|'tech_stack'|'decision_memo'|
        'knowledge_map'|'mind_map'|'tok_exploration'|'other'
}
```
Render with the kind-specific treatment described in §13.4. Actions: *save to vault* (POST `/api/v1/vault/artifacts` with the body) → ✓; *dismiss*.

After save, show a small "saved to Vault › Project artifacts" with a quiet link.

---

## 16. AI planner UX (Calendar)

The most novel functional surface. The flow:

1. She clicks **"Plan with AI"** in the Calendar header.
2. Modal opens. Inputs:
   - Free-form intent textarea (autofocus): *"what would you like to plan?"*
   - Date range (default: today)
   - Mode toggle (Ulzii or Obama)
3. Submit → `POST /api/v1/tasks/plan`. Show a serene loader for 5–20 seconds (Opus + extended thinking). Don't show a percentage; show a contemplative pulse with a one-line status: *"opus is reading your vault, calendar, and recent memory…"*.
4. Response renders as a **review surface** (not auto-saved):
   - `summary` at top — 2–4 sentences of plain prose explaining the tradeoffs.
   - `items[]` rendered as a vertical list of draft event/task cards. Each card shows: kind chip, title, time block, color, **rationale** (italic, dimmer).
   - `open_questions[]` rendered as soft yellow-tinged cards near the top. Each open question has a small input where she can paste her answer. (Phase 2: send back for re-plan; phase 1: ignore + accept.)
5. Actions:
   - *Edit* an item inline (click → side panel)
   - *Remove* an item with × on hover
   - *Accept all* → `POST /api/v1/tasks/bulk` with the items → write to Calendar → close modal → toast: *"7 added"*
   - *Discard* → close without saving

The whole flow should feel like reviewing a thoughtful colleague's draft, not approving a spreadsheet.

---

## 17. Polish — alignment with backend deltas

### Provider / intent chip in chat

`message:ai:start` carries:
```ts
{ message_id, mode, model_id, intent?, provider? }
```
Surface this **subtly** below the AI bubble. Examples:
- *"Opus · deep"* (Anthropic, high effort)
- *"Gemini · web grounded"* (Google route, market research)
- *"Sonar · researched 14 sources"* (Perplexity Sonar, with citation count)

Restraint is everything. Tiny font. Hover to reveal full model_id.

### Web citations

When provider is Google or Perplexity, citations come in as content blocks:
```ts
{ type: 'citation', source_kind: 'web', source_id: 'https://...' }
```
Render at the bottom of the message as numbered footnotes `[1] [2] [3]`. New tab on click.

### System notice (cost cap)

Server emits `system:notice` over Socket.io once per day:
```ts
{ kind: 'cost_cap', message: string, dismissable: true }
```
Render as a slim banner above the composer, dismissable. Calm copy already from server.

### Vault tags (user vs AI)

`GET /api/v1/vault/documents/:id/tags` returns `{ tag, source: 'user'|'ai' }[]`. AI tags: italic, dimmer, or with a small dot. User tags: regular weight. Click a chip to filter.

### Chat-archive shortcut

Add a small "archive thread" link at the conversation header. Calls `POST /api/v1/conversations/:id/archive-to-vault` and shows toast *"saved to Vault › Chat history."*

---

## 18. Skeletons + empty states

**Loading.** Skeleton bars. Subtle pulse on `bg-of-bg`. Match the shape of what's coming.

**Empty.** Warm one-line copy + small mono illustration if natural.

| Surface | Empty copy |
|---|---|
| Chat list | "no conversations yet — say something to ulzii or obama." |
| Vault Ideas | "nothing here yet — capture a thought." |
| Vault Notes | "no notes yet — start with whatever's on your mind." |
| Vault Chat history | "archive a conversation from chat to keep it here." |
| Vault Artifacts | "nothing made yet — ulzii or obama will save things here when you ask." |
| Calendar today | "nothing on the calendar — a quiet day." |
| Calendar week (no events) | "open week. plan with ai or add an event yourself." |
| Beauty | "drag images or videos here. quiet enough to feel like a wall in your room." |
| Signals | "signals are quiet right now — they'll fill in over the next hour." |
| Settings · Memory | "nothing remembered yet — talk a little, the AI will catch on." |
| Exam | "create a workspace, add sources, ask for a cheatsheet." |

**Error.** Warm copy + retry. Examples:
- *"we couldn't quite get that — try again?"*
- *"the world is quiet right now — we'll try the next signal cycle."*
- *"this link expired or doesn't match — request a new one."*

No blank white screens. Ever.

---

## 19. Quality bar

- 60 fps on everything except heavy 3D (target 60; never <30).
- AI tokens begin streaming within ~1s of send.
- File uploads >4MB use signed PUT URLs (already wired backend-side).
- A11y: focus rings everywhere, semantic HTML, `aria-live` for streaming text + system notices, keyboard nav on all six routes, respects `prefers-reduced-motion` and `prefers-color-scheme`.
- Long lists virtualize past ~200 items.
- No emoji, no exclamation marks (almost never).

It should feel like Linear in speed, Vercel in elegance, Arc in warmth.

---

## 20. Full API surface

Prefix every path with `/api/v1/`. All requests carry `Authorization: Bearer <token>` except the auth ones.

### Auth
```
POST /auth/magic-link    { email }                     → 204
POST /auth/verify        { email, token }              → { access_token, expires_at, user }
GET  /auth/me                                           → { user }
```

### Me
```
GET   /me                                              → { user }
PATCH /me                { display_name?, avatar_url?, timezone?, default_mode? }
GET   /me/usage          ?range_days=30                → { today_usd, daily_cap_usd, by_task: [...] }
```

### Conversations / Chat
```
GET    /conversations                                  list
POST   /conversations    { title?, pinned_context? }
GET    /conversations/:id
PATCH  /conversations/:id { title?, pinned_context?, archived? }
DELETE /conversations/:id
GET    /conversations/:id/messages    ?before=&limit=
POST   /conversations/:id/messages    { content_blocks, mode, parent_message_id?, attached_file_ids?, model_hint? }
POST   /conversations/:id/search      { query, limit? }
POST   /conversations/:id/archive-to-vault             → { vault_document_id }
```

### Files
```
POST /files                       multipart 'file'
GET  /files/:id
POST /files/:id/url                                    → signed GET URL
DELETE /files/:id
GET  /files                       ?kind=&limit=
```

### Vault
```
GET    /vault/documents           ?content_type=note,idea&kind=&shared_only=&limit=
POST   /vault/documents           { title, content_md, content_type?, kind?, shared? }
GET    /vault/documents/:id
PATCH  /vault/documents/:id
DELETE /vault/documents/:id
POST   /vault/search              { query, limit?, mode?: 'hybrid'|'semantic' }
POST   /vault/import-file         { file_id, title?, content_type? }
GET    /vault/documents/:id/tags
POST   /vault/documents/:id/tags  { tag }
DELETE /vault/documents/:id/tags/:tag
GET    /vault/graph               ?center=&depth=2&max_nodes=80
POST   /vault/artifacts           { title, content_md, kind, tags? }   ← from chat save_artifact
```

### Tasks (Calendar)
```
GET    /tasks                     ?kind=&status=&range_from=&range_to=&include_archived=&include_done=&limit=
GET    /tasks/today                                    next 24h + open undated
POST   /tasks                     create
GET    /tasks/:id
PATCH  /tasks/:id
DELETE /tasks/:id
POST   /tasks/:id/complete
POST   /tasks/:id/uncomplete
POST   /tasks/bulk                [TaskCreate, ...]    bulk-create after AI plan accept
POST   /tasks/plan                { intent, date_from, date_to, mode? }    ← AI planner
```

### Beauty
```
GET    /beauty/media              list (URLs pre-signed inline)
POST   /beauty/media              multipart 'file' + caption? + taken_at?   esui only
PATCH  /beauty/media/:id          esui only
POST   /beauty/media/:id/url      refresh signed URL (both users)
DELETE /beauty/media/:id          esui only
```

### Daily Signals
```
GET    /signals                   ?category=&limit=
POST   /signals                   manual add (esui)
PATCH  /signals/:id
DELETE /signals/:id
POST   /signals/:id/pin           → vault_document_id
POST   /signals/:id/share-to-chat { conversation_id }
```

### Exam
```
GET    /exam/workspaces
POST   /exam/workspaces           { title, subject? }
GET    /exam/workspaces/:id
DELETE /exam/workspaces/:id
GET    /exam/workspaces/:id/sources
POST   /exam/workspaces/:id/sources       { file_id }
GET    /exam/workspaces/:id/artifacts
POST   /exam/workspaces/:id/generate      { kind, mode, title?, options? }
GET    /exam/artifacts/:id
POST   /exam/artifacts/:id/attempt        { responses, duration_sec }
```

### Memory (Settings → Memory audit)
```
GET    /memory                    ?category=&scope=&include_forgotten=false
POST   /memory                    manual add
PATCH  /memory/:id
POST   /memory/:id/forget
POST   /memory/search             { query, limit? }
```

---

## 21. Socket.io events

Connect to `NEXT_PUBLIC_WS_URL` with `{ auth: { token } }`.

### Client → server
- `conversation:join { conversation_id }`
- `conversation:leave { conversation_id }`
- `message:send { conversation_id, content_blocks, mode, parent_message_id?, attached_file_ids?, model_hint? }`
- `message:cancel { message_id }`

### Server → client (chat)
- `message:created` — any new message in the room
- `message:ai:start` — `{ message_id, mode, model_id, intent?, provider? }`
- `message:ai:delta` — `{ message_id, delta_text }` (repeatedly)
- `message:ai:thinking` — Anthropic extended-thinking traces (optional render)
- `message:ai:tool_use` — `{ message_id, tool, args }`
- `message:ai:complete` — `{ message_id, tokens_in, tokens_out, cache_hit }`
- `message:ai:error` — `{ message_id, error }`

### Server → client (other)
- `cycle:refreshed { cycle_id, refreshed_at, expires_at }` — new Signals cycle
- `system:notice { kind, message, dismissable }`

---

## 22. Content blocks

Messages carry an array of typed blocks. Render each:

```ts
type Block =
  | { type: 'text'; text: string }
  | { type: 'image'; file_id: string; alt?: string }
  | { type: 'file'; file_id: string }
  | { type: 'signal_card'; signal_id: string }
  | { type: 'vault_link'; document_id: string }
  | { type: 'vault_pin_suggestion'; title: string; content_md: string; tags: string[] }
  | {
      type: 'vault_artifact_suggestion';
      title: string; content_md: string;
      kind: 'market_research'|'three_scenario_sim'|'tech_stack'|'decision_memo'
          |'knowledge_map'|'mind_map'|'tok_exploration'|'other';
      tags: string[]
    }
  | {
      type: 'citation';
      source_kind: 'vault'|'file'|'memory'|'web';
      source_id: string;
      quote?: string
    }
  | { type: 'thinking'; text: string };
```

---

## 23. Streaming protocol

For chat AI messages:

1. Client emits `message:send`.
2. Server emits `message:created` (the user's message).
3. Server emits `message:ai:start` with `{ message_id, mode, model_id, intent?, provider? }`.
4. Server emits `message:ai:delta` repeatedly with `{ message_id, delta_text }`.
5. Optional `message:ai:thinking` for Opus extended thinking.
6. Optional `message:ai:tool_use` with `{ tool: 'pin_to_vault'|'save_artifact', args }` — append the corresponding content block to the streamed message.
7. Server emits `message:ai:complete`.

The client appends deltas to the in-flight bubble. Never a spinner. Cursor blinks at the tail. Stop button visible while streaming.

---

## 24. Build order

The order to attack this brief:

1. **Workspace shell + theme + nav + auth flow** — refresh against the locked map (six routes, single-tenant, mode-gated affordances).
2. **3D Knowledge Graph** — sets the visual register for the whole release. Used in Vault and Exam.
3. **Calendar** — most novel functional surface. Includes the AI planner review flow.
4. **Vault 4-tab restructure** — Ideas / Notes / Chat history / Project artifacts + Graph. The artifact renderers per `kind`.
5. **Chat polish** — mode affordances, provider chips, save-to-vault and save-artifact cards, archive-to-vault link, citation footnotes.
6. **Beauty** — gallery, lightbox, captions, drag-drop, video.
7. **Daily Signals** — typography-first reading surface, four sources with distinct character.
8. **Homepage** — BentoGrid with default tiles, edit-mode toggle, persistence.
9. **Settings drawer** — focus on the Memory audit panel (it earns trust).
10. **Polish pass** — empty states, error states, system notice banner, vault tag distinction.

---

## 25. What "good" looks like

When this is done:

- Esui opens ESUI and her shoulders drop.
- Chat with **Ulzii** feels like a teacher who *cares whether she actually understands*.
- Chat with **Obama** feels like a co-founder who's *already made the hard call*, ready to argue.
- The Calendar's AI planner produces a day that feels like *her* day, not a generic schedule.
- The Vault's 3D graph makes her smile the first time it loads — the constellation of her own thinking, in space.
- Beauty is a quiet wall in her room — nothing performative.
- Signals slow her morning down for thirty seconds. She walks away with one line.
- Exam compresses her reading into something she can actually use.
- Settings → Memory makes her trust the AI's persistence. She edits a memory; it sticks.

Every detail you put care into is a small letter to her. Reach.

---

## 26. Stack constraints (locked, repeated for emphasis)

- **Next.js 14 App Router**, TypeScript strict
- **Tailwind CSS** (no other utility frameworks)
- **Framer Motion** for all animation
- **Zustand** for client state, **TanStack Query** for server cache
- **socket.io-client**
- **react-three-fiber** + drei + postprocessing for 3D
- **react-force-graph-3d** for both knowledge graphs
- **react-grid-layout** for the BentoHome (already wired in `<BentoGrid>`)
- **react-flow** for concept maps (Exam)
- **TipTap** or **Plate.js** for the markdown editor
- **Lucide** for icons

Don't add other UI frameworks. Don't add other animation libraries. Don't switch to CSS-in-JS beyond what's already in the existing components.

---

## 27. Closing

ESUI is built by someone who loves her. Build it like that.

You're shaping the daily home of someone Badrushk loves. Chat with the AI is *him thinking with her*. The widget she dropped a photo into has *his eyes on it*. The calendar she planned with the AI is *her whole day held lightly*. The signals she reads in the morning are *the kind of mind he wants her to have nearby*.

Reach.
