# ESUI — Design Pass V2

This is a follow-up handoff. You built v1; it works. **Read `docs/DESIGN_BRIEF.md` first** for foundational context (the product, the people, palette, typography, motion language, voice). This brief covers only what changed and what needs new or better design.

Don't redo what works. Login flow, AppShell, TopNav, BentoHome, ChatWidget composer skeleton, VaultWidget editor, ExamWidget shell — all good. Touch them only where this brief calls for it.

---

## Two scope changes since v1

### Together — pivoted to a plain gallery

The compositing feature was removed. There is no longer:
- The Moment Prompt slide-in card (component deleted)
- The 4-warm-message skip pool
- AI image compositing (Remove.bg + Stability)
- The prompt scheduler
- The "Esui-only" gating

What it is now: **a shared drag-drop gallery for images and videos.** That's the entire feature. Either user can drop in. Both see all items. Either can delete. Optional caption per item. The user described it as **"formal and clean modern format. That's it."**

### Signals — pivoted to a user-curated quote feed

The RSS pull, AI topic curation (Perplexity Sonar), 6-hour refresh cycle, ephemeral expiration, drops, dismisses, engagement personalization — all removed. The 6 categories collapsed to 4, locked.

What it is now: **a commonplace book.** Esui pastes in quotes from her reading. Four sources, locked:

| key | source |
|---|---|
| `mathematics` | Mathematics for Human Flourishing — Francis Su |
| `arabic_philosophy` | Arabian / Arabic philosophy (Al-Farabi, Ibn Sina, Ibn Rushd, etc.) |
| `chinese_philosophy` | Chinese philosophy (Tao Te Ching, Zhuangzi, Sun Tzu, etc.) |
| `elements_of_ai` | Elements of AI course · elementsofai.com |

Quotes persist. No expiration. No AI involvement. She can edit, delete, pin to vault.

This widget is for **contemplation, not consumption.** Different design language than a news feed.

---

## Priority 1 — TogetherWidget redesign

I (Claude Code) wrote a functional gallery. It works. It's not a *design*. Take it further.

### Endpoints (locked)
```
GET    /api/v1/together/media           → MediaOut[]   (pre-signed urls included)
POST   /api/v1/together/media           → MediaOut     (multipart 'file', optional 'caption', 'taken_at')
PATCH  /api/v1/together/media/:id       → MediaOut     ({caption?, taken_at?})
POST   /api/v1/together/media/:id/url   → { url, expires_in }   (refresh url if expired)
DELETE /api/v1/together/media/:id       → 204
```

### MediaOut shape
```ts
{
  id, file_id,
  kind: 'image' | 'video',
  mime, filename,
  width?, height?, duration_sec?,
  caption: string | null,
  taken_at: ISO | null,
  added_by: string,           // user id
  created_at: ISO,
  url?: string | null,        // pre-signed (10 min); already present in list/upload responses
  url_expires_in?: number | null,
}
```

### Design directions to explore

**Layout.** The current uniform grid is conventional. Consider:
- Bento-style sizing: landscape vs portrait vs video get different real estate.
- True masonry (different aspect ratios stack naturally).
- A "wall" layout with subtle drop shadows that suggests printed photographs.
The grid should feel like a curated spread, not a CMS.

**Date organization.** Items currently sort by `created_at` desc with no grouping. Consider quiet date dividers ("today", "yesterday", "earlier this week", "March 2026") that read like titles in a bound book — or no dividers, just generous gaps when the date breaks. Pick one and commit.

**Captions.** Where do they live? Always under the photo (caption-first), only on hover (photo-first), or only in the lightbox (cleanest)? My instinct: lightbox + hover. You decide.

**Lightbox.** Current version has a close + remove button. Add:
- Arrow-key navigation between items (and swipe on touch).
- Smooth scale/blur transition on open and close.
- Inline caption editing (click caption → edit → save on blur).
- Video controls + scrubbing; subtle loading state.

**Drag overlay.** When files are being dragged over the page, the current overlay is a centered dashed-border card. Consider a soft tint over the entire page with a subtle vignette, or an animated "ready" state. Make it feel intentional, not generic.

**Upload progress.** Multiple files can upload simultaneously. The current "uploading 3…" header chip is OK; consider a per-file skeleton card that resolves into the real one when complete, so you can see *which* photo is being added.

**Empty state.** Currently "nothing here yet — drag images or videos in". This is the first impression. Consider a single line of warm copy that captures what this gallery is for, plus a quiet illustration or single-frame visual that hints at the feeling.

**Video.** Don't auto-play in cards (battery, attention). Show a single representative frame with a small play affordance. Auto-play in the lightbox when opened.

**Aesthetic intent:** Esui's photo wall in a private studio. Generous whitespace. Soft borders. **No like buttons, no comments, no view counts, no share buttons.** This is just for them.

---

## Priority 2 — SignalsWidget redesign

I wrote a 4-column form-driven feed. Functional. Not contemplative. The user pivoted the entire feature toward reading and reflection, not consumption — the design needs to follow.

### Endpoints (locked)
```
GET    /api/v1/signals?category=&limit=200   → Quote[]
POST   /api/v1/signals                        → Quote     ({ category, body, title?, source_url?, source_name? })
GET    /api/v1/signals/:id                    → Quote
PATCH  /api/v1/signals/:id                    → Quote     ({ body?, title?, category?, source_url?, source_name? })
DELETE /api/v1/signals/:id                    → 204
POST   /api/v1/signals/:id/pin                → { vault_document_id }   (saves quote into Vault as a permanent note)
```

### Quote shape
```ts
{
  id,
  category: 'mathematics' | 'arabic_philosophy' | 'chinese_philosophy' | 'elements_of_ai',
  title: string,           // server-derived from body if user didn't supply
  body: string,            // the quote itself
  source_url: string | null,
  source_name: string | null,
  created_at: ISO,
}
```

### Design directions to explore

**Layout.** The current 4-column grid treats this like a feed. It probably shouldn't be. Consider:
- A **single "currently reading" view** where one quote takes center stage, with quiet navigation between sources and dates.
- A **chapter view** where each source has its own page-turn navigation.
- A **vertical stream** sorted by source with paper-textured dividers.
- Or some combination: a list-mode + a reading-mode toggle.

**Typography first.** A quote should feel like text on a page, not a card. Big serif body. Small italic attribution. Generous leading. Make *reading* the primary act. Make adding/deleting secondary affordances that fade unless invoked.

**Source identity.** Each of the 4 sources has its own character — give each a distinct visual signature without veering into theme-park territory. Color accent (already there is a start), maybe a subtle paper texture, maybe a dedicated empty-state copy. Restraint over flair.

| Source | Character |
|---|---|
| Francis Su (Mathematics for Human Flourishing) | Humane, warm, bridge between math and lived life |
| Arabian / Arabic philosophy | Contemplative, classical, sometimes theological |
| Chinese philosophy | Paradox, metaphor, rivers and stones |
| Elements of AI course | Modern, course-like, structured |

**Adding a quote.** The current popover form feels like a CRUD interface. Consider:
- A quiet inline composer that opens with a keypress (`n` for new).
- A dedicated "drop a quote" surface that's a reading-aware modal — feels like writing in a notebook, not filling a form.
- Markdown-friendly textarea where pasting a URL auto-fills `source_url` and lets her type the source manually.
- Auto-detect category from URL (elementsofai.com → `elements_of_ai`, etc.) when possible.

**Pin to vault.** It's a side action today. Pinning is Esui saying "I want to think about this for longer" — the affordance should reflect that intent without becoming dominant.

**Browse vs read.** Two modes: index/thumbnails (browse what she's saved) and single-quote reading (focus on one). A small, quiet switch between them.

**Aesthetic intent:** A reading lamp in the corner of a quiet room. Cream paper. Black ink. Time slows down here.

---

## Priority 3 — 3D knowledge graph (the showpiece)

The user's directive: **"Iron Man Jarvis level."** Professional, high-tech, glowing, in real 3D space — not the flat 2D force graph from v1.

This applies to **two graphs**:
- The **Vault knowledge graph** (`GET /api/v1/vault/graph`) — the constellation of Esui's own thinking.
- The **Exam knowledge_graph artifact** (Voronoi-style territory map of a subject).

Both should use the same 3D rendering system; only the data shape and label treatment differ.

### Tech direction

- **`react-three-fiber`** + **`@react-three/drei`** for the scene.
- **`react-force-graph-3d`** is the fastest path — it ships a Three.js force-directed 3D graph with hover/click/zoom/orbit out of the box. Customize its node and link rendering rather than building from scratch.
- **Postprocessing bloom** (`@react-three/postprocessing`) for the glow.
- **GPU-friendly:** instance meshes for nodes; line geometry for edges; cap node count at ~300 (paginate or cluster beyond that).

### Visual language

- **Background:** deep navy approaching black, with a subtle vignette and a barely-visible particle field. Suggest space, not a coordinate plane.
- **Nodes:** small glowing spheres. Color by `content_type` (Vault) or `region` (Exam). Inner core slightly brighter than the outer halo. Hover → halo expands and pulses softly.
- **Edges:** thin lines with a faint emissive material. For semantic links, the line opacity tracks `strength` (cosine similarity). For typed edges (Exam), use color: prereq=Sky Blue, supports=Forest, specializes=Vanilla, contrasts=warm red.
- **Light flow:** along edges between connected nodes, a small light particle travels periodically (every ~3–5s, randomized) — like data moving in a network. **Subtle.** Not a christmas tree.
- **HUD overlays:** when hovering a node, a small holographic-style panel anchors near it: title, content_type, last touched, top 3 connected nodes. Fades in/out. Sky-Blue rule, monospaced numerals.
- **Camera:** orbit controls with momentum + damping. Auto-rotate slowly when idle (0.05 rad/s). Stop rotation on user interaction.
- **Click:** smooth tween to focus a node. The selected node grows slightly; its 1-hop neighbors brighten; everyone else dims to ~25% opacity.

### Color palette (the "Jarvis" register)

Stay within the brand: Sky Blue is the dominant glow. Forest Green is the secondary stroke. Vanilla appears only as the lightest accent (like a single moonbeam). Navy is the background. **No orange. No magenta. No pure white.**

```
glow primary:    Sky Blue (#7DB6E8 → emissive #9ad0ff at intensity 1.6)
glow secondary:  Forest Green
edge default:    Sky Blue at low opacity (~0.12), brightens on connect
selection ring:  Sky Blue, animated 360° rotation (~6s/rotation)
background:      Navy → near-black gradient
particle field:  Vanilla at 0.04 opacity, slow drift
```

### Animation language

- Idle nodes breathe: scale `0.96 → 1.04` over 4–6s, randomized phase per node.
- Edges have a slow shimmer (0.7 → 1.0 opacity over 8s).
- Camera idle rotation: 0.05 rad/s, pauses on user interaction, resumes after 8s of stillness.
- Light particles travel along edges at ~0.4 units/sec.
- All animations respect `prefers-reduced-motion` — skip the breathe and shimmer, keep the camera static.

### Data shapes

**Vault graph** — `GET /api/v1/vault/graph?center=&depth=2&max_nodes=80`:
```ts
{
  nodes: Array<{
    id: string, title: string,
    tags: string[], updated_at: ISO,
    content_type: 'note' | 'journal' | 'draft' | 'research' | 'reference',
  }>,
  edges: Array<{
    source: string, target: string,
    kind: 'semantic' | 'explicit',
    strength?: number, note?: string,
  }>,
}
```

**Exam knowledge_graph artifact** — `payload`:
```ts
{
  version: 1,
  regions: Array<{ id, label, color? }>,
  nodes: Array<{
    id, label, region: string, weight: number,  // weight ∈ [0,1] → node size
    x?: number, y?: number,                     // 2D hints, ignore in 3D layout
    summary?: string,
  }>,
  edges: Array<{ from, to, kind: 'prereq'|'supports'|'specializes'|'contrasts' }>,
}
```

### Don't

- **Don't ship the holographic film-grain trope.** It looks dated. Reach for clarity.
- **Don't use neon cyan/orange Iron Man HUD overlays.** Stay in the ESUI palette.
- **Don't auto-zoom to fit on every load** — preserve the user's last camera position per graph.
- **Don't skip the empty state.** When the graph is < 3 nodes, show a single calm line: *"the constellation begins when you add a few notes."*

### Performance bar

- 60 fps for graphs up to 200 nodes / 600 edges.
- < 100 ms time to first paint on initial mount (skeleton during scene init is fine).
- Graceful fallback to the existing 2D `react-force-graph` when WebGL is unavailable or `prefers-reduced-motion` is set.

This is the moment. Make it land.

---

## Priority 4 — Vault calendar & task management (Google-Calendar-grade)

The user wants a proper scheduling environment **inside Vault**: tasks (todos) and events (timed blocks), with month/week/day views. Treat it as a sibling tab alongside the existing Vault notes — same widget shell, different surface.

### Endpoints (live, ready to wire)

```
GET    /api/v1/tasks                                      → TaskOut[]
       query params: kind=task|event, status=pending|in_progress|done|cancelled,
                     range_from=ISO, range_to=ISO, include_archived=bool,
                     include_done=bool, limit=int
GET    /api/v1/tasks/today                                → TaskOut[]   (next 24h + open undated)
POST   /api/v1/tasks                                      → TaskOut
PATCH  /api/v1/tasks/:id                                  → TaskOut
DELETE /api/v1/tasks/:id                                  → 204
POST   /api/v1/tasks/:id/complete                         → TaskOut
POST   /api/v1/tasks/:id/uncomplete                       → TaskOut
```

### TaskOut shape

```ts
{
  id, owner_id,
  kind: 'task' | 'event',
  title: string,
  description: string | null,
  status: 'pending' | 'in_progress' | 'done' | 'cancelled',
  starts_at: ISO | null,    // due date for tasks; start time for events
  ends_at: ISO | null,      // events only
  all_day: boolean,
  color: string | null,     // hex or palette token
  shared: boolean,          // visible to partner when true
  recurrence_rule: string | null,  // optional iCal RRULE
  location: string | null,
  completed_at: ISO | null,
  created_at: ISO,
  updated_at: ISO,
}
```

### Surfaces (build all)

**4.1 — Vault tab system.** Add a tab bar to the existing VaultWidget header: **Notes** (existing) | **Calendar** | **Tasks** | **Graph**. Active tab swaps the body. Keep the same search bar; it scopes to the active tab.

**4.2 — Calendar views**

Three views, switchable in the calendar tab header (segmented control: Month / Week / Day). Default to Week.

- **Month view.** Standard 7×~6 grid. Each cell shows up to 3 events as colored pills + "more" overflow link. Today is highlighted by a thin Sky Blue ring, not a fill. Click a day → switch to Day view for that date. Drag an event to another day → `PATCH starts_at` (and `ends_at` if event has duration).

- **Week view.** Time grid (08:00–22:00 default; scrollable to 00:00–24:00). Days as columns. Events render as colored blocks spanning their time. Tasks with due dates render as small badges at the top of their day column. Drag to reschedule (vertical → time, horizontal → day). Resize the bottom edge → adjust `ends_at`. Click empty space → quick-create modal pre-filled with that time slot.

- **Day view.** Single column, full timeline. Same drag/resize as week. A right rail shows the day's tasks (todos) in a clean list — drag from rail onto timeline to give a todo a time.

**4.3 — Task creation flow.** A floating + button (or `n` shortcut) opens a small composer:
- Toggle: Task or Event (events require a start time)
- Title (required) — autofocus
- Date/time (single date for tasks, start+end for events; all-day toggle for events)
- Color swatch (small palette inheriting brand: Sky/Vanilla/Navy/Forest + a few extras)
- Shared toggle ("visible to Badrushk")
- Description (markdown-friendly)
- Save (Cmd+Enter) / Cancel (Esc)

**4.4 — Task list view.** A "Tasks" tab (separate from calendar) that shows undated todos as a clean list, grouped by status. Each row: checkbox (toggles complete via `POST /tasks/:id/complete`), title, optional due date, color dot, archive/delete on hover. Multi-select with Shift-click for batch operations.

**4.5 — Inline editing.** Click any event/task → side panel slides in from the right (or modal on small screens) with all fields editable. Save on blur or Cmd+S. Delete button at the bottom with single-click confirm (no two-step modal).

**4.6 — Recurrence.** Render an iCal RRULE field as a friendly select: never / daily / weekdays / weekly on \[X\] / monthly on \[Nth\] / yearly. Backend stores the raw RRULE string; you build the helper to translate the friendly choices into RRULE strings. (If this gets complex, defer recurrence — show the field but accept text input for now.)

### Aesthetic intent

It should feel like Linear's calendar, not Google's. Quieter, less saturated. Today's ring is a thread of Sky Blue. Color swatches are muted versions of the four brand colors plus a couple of warm accents. Drag handles appear on hover, not always. Selected event has a subtle outer glow (Sky Blue) — and that glow can hint at the same Jarvis aesthetic from P3 without leaning into it.

### Don't

- Don't render Google Material design.
- Don't use bright saturated event colors. Mute everything by ~40%.
- Don't add notifications/reminders (no email, no push). Pure visual.
- Don't add multi-calendar support. There's only one shared workspace here.

---

## Priority 5 — Homepage date/time + at-a-glance

A live date/time display on the BentoHome (currently 841 LOC). Plus a small "today" panel that surfaces upcoming items from the new calendar.

### What to add

**5.1 — Time hero.** A big, calm, live-updating clock/date display. Examples of treatment to consider:
- A serif "Wednesday, May 2nd" on one line, a tabular-nums time on the next.
- Single-line: "21:43 · Wednesday, May 2".
- Optional: a quiet "good evening, Esui" / "good morning, Esui" greeting tied to local time.

Use `tabular-nums` so the digits don't dance. Update once per second but only redraw the seconds digit (don't re-render the date string).

**5.2 — Today panel.** A small bento card that fetches `GET /api/v1/tasks/today` on mount and shows:
- Upcoming events (next 24h) as time-prefixed rows: `14:00 · Linear algebra reading`
- Open todos with no time
- Empty state: *"nothing on the calendar — a quiet day"*

Click a row → jump to Vault → Calendar tab, focused on that item. Don't reimplement the editor here.

**5.3 — Background respect.** The time and the today panel should feel like part of the calm bento composition, not loud cards on top. Quiet typography, generous breathing room, no borders.

### Don't

- Don't add a weather widget.
- Don't add "good morning" with emoji.
- Don't show seconds prominently — the second digit can be subtle/dimmed; minutes are the hero.
- Don't use a 12-hour AM/PM unless the user's `timezone` setting hints at a US locale (and even then, prefer 24-hour for the calm intellectual register).

---

## Priority 6 — Polish pass (alignment with backend deltas)

These are smaller items. The backend changed; existing UI needs to respond.

### 3.1 — Chat: model + intent indicator

`message:ai:start` now carries:
```ts
{
  message_id: string,
  mode: 'ulzii' | 'obama',
  model_id: string,                                    // 'claude-opus-4-7' | 'claude-sonnet-4-6' | 'gemini-3.1-pro' | 'sonar-deep-research' | ...
  intent?: 'general' | 'market_research' | 'deep_research' | 'decision' | 'epistemic',
  provider?: 'anthropic' | 'google' | 'perplexity',
}
```

Surface this **subtly** below or beside the AI message bubble. Not a banner; a chip you only really notice if you look. It tells Esui *which mind is answering*. Examples:
- "Opus · deep" (when Anthropic + high-effort)
- "Gemini · web research" (when Google route)
- "Sonar · researched 14 sources" (when Perplexity, with citation count)

Restraint here is everything.

### 3.2 — Chat: web citations

Gemini and Perplexity routes attach citations to the message. Content blocks include:
```ts
{ type: 'citation', source_kind: 'web', source_id: 'https://...' }
```

Render these as small numbered footnotes at the bottom of the message: `[1] [2] [3]…`. Each link opens in a new tab. Clicking the number scrolls to / highlights the inline reference (if any). Don't dominate the message — these are receipts.

### 3.3 — Chat: vault pin suggestion card

When the AI invokes the `pin_to_vault` tool, this block is appended to the streamed message:
```ts
{
  type: 'vault_pin_suggestion',
  title: string,
  content_md: string,
  tags: string[],
}
```

Render it inline as a soft contained card with: title (bold), content preview (markdown, ~3 lines, "show more" if longer), tag chips, and two actions:
- **save to vault** → `POST /api/v1/vault/documents { title, content_md }`, then show a quiet ✓
- **dismiss** → just hides the card (no API call)

The card should feel like a polite suggestion, not a pop-up.

### 3.4 — System notice (cost cap)

Server emits this over Socket.io once per day:
```ts
event 'system:notice'
payload { kind: 'cost_cap', message: string, dismissable: boolean }
```

Render as a slim banner above the composer or a soft toast in a corner. Calm copy already provided by server. Tap to dismiss.

### 3.5 — Settings: Memory audit

Verify (or build, if missing) the Memory section in `SettingsDrawer`. Endpoints:
```
GET    /api/v1/memory?category=&scope=&include_forgotten=false&limit=100   → Memory[]
POST   /api/v1/memory                                                       → Memory  ({ text, category?, scope? })
PATCH  /api/v1/memory/:id                                                   → Memory  ({ text?, category?, salience? })
POST   /api/v1/memory/:id/forget                                            → 204
POST   /api/v1/memory/search                                                → Memory[]  ({ query, limit? })
```

Memory shape:
```ts
{
  id, owner_id,
  scope: 'global' | 'project' | 'conversation',
  text: string,
  category: 'preference' | 'goal' | 'decision' | 'fact_about_user' | 'fact_about_world' | 'project_state' | 'relationship' | null,
  salience: number,        // 0..1
  confidence: number,
  source_kind: 'chat' | 'vault' | 'exam' | 'signal' | 'manual' | null,
  created_at: ISO,
  last_used_at: ISO | null,
}
```

This is Esui's audit panel into the AI's mental model of her. She should be able to:
- Browse all memories, filter by category, search semantically.
- Click a memory to edit its text or category.
- Hit "forget" to permanently remove + suppress re-extraction.
- See salience as a subtle indicator (depth of color, a small bar) — not a percentage.
- Add a manual memory ("remember that I prefer X").

Make it feel like flipping through a private journal someone else is keeping about her. Calm, organized, dignified.

### 3.6 — Vault: tags

**Tags:** `GET /api/v1/vault/documents/:id/tags` returns `{ tag, source: 'user'|'ai' }[]`. AI tags should be visually distinct from user tags — italic, slightly dimmer, or with a subtle dot. User can `POST` and `DELETE` tags directly.

**Knowledge graph:** see Priority 3 for the 3D treatment.

### 3.7 — Exam: mode-aware cheatsheet sections

Generated cheatsheets now have different section sets per mode:

**Ulzii:**
1. Foundations
2. Theorems & Proofs
3. Dependencies
4. Pitfalls
5. Worked Examples

**Obama:**
1. The 3-line summary
2. Decision Points
3. Action Templates
4. Failure Modes
5. Worked Example

`payload.sections[].title` will be one of those. The renderer should handle both gracefully — small section icons or just typography that adapts.

### 3.8 — Exam: verify all 5 artifact kinds render

Confirm the existing widget supports:
- `cheatsheet` — accordioned sections (above)
- `practice_set` — question-by-question flow → submit → AI-graded results page with weak-topics report and a "practice on weak topics" CTA (sets `seed_from_attempt_id` in the next generate request)
- `concept_map` — hierarchical graph (react-flow + dagre layout works well)
- `knowledge_graph` — see Priority 3 for the 3D treatment
- `simulation` — timed test mode with countdown, mixed question types, AI-graded result

If any are missing or thin, build them.

---

## Existing patterns to preserve

- AppShell + TopNav layout (don't restructure)
- ChatWidget composer with mode toggle
- The light/dark theme system (CSS variables)
- AuthGuard + magic-link login flow
- Color palette (Sky Blue / Vanilla / Navy / Forest Green)
- Typography pairing (Inter sans + Source Serif 4)
- Skeleton loaders (no spinners anywhere)

---

## Stack constraints (locked)

- Next.js 14 App Router, TypeScript strict
- Tailwind CSS
- Framer Motion (already in deps)
- Zustand (client state)
- TanStack Query (already in deps)
- socket.io-client
- Use `react-flow` for concept maps, `react-force-graph` or `d3-force` for the knowledge graphs.

---

## Quality bar

- **No spinners.** Skeletons or streaming. Always.
- **No emoji** unless explicitly warranted (almost never).
- **`prefers-reduced-motion`** respected — replace transitions with cross-fade.
- **Keyboard navigation** across all surfaces. Focus rings are visible and intentional.
- **`aria-live`** regions for streaming text + system notices.
- **Empty / error / loading states** are warm, not generic. Use the voice from v1's brief.
- **60fps** target on all transitions.

---

## Reading order

1. This brief.
2. The original `docs/DESIGN_BRIEF.md` for the foundational voice, palette, motion.
3. `apps/web/components/widgets/TogetherWidget.tsx` and `apps/api/app/widgets/together.py`.
4. `apps/web/components/widgets/SignalsWidget.tsx` and `apps/api/app/widgets/signals.py`.
5. `apps/api/app/widgets/tasks.py` — for the calendar API contract.

Build order — pick what gives the largest visible delta first:

1. **P3 — 3D knowledge graph** (the showpiece — sets the visual register for the whole release)
2. **P1 — Together gallery** (most visible behavior change)
3. **P4 — Vault calendar** (largest functional addition)
4. **P2 — Signals quote feed** (emotional, contemplative; reward of the pass)
5. **P5 — Homepage date/time** (small, ties P4 into the main surface)
6. **P6 — Polish pass** (alignment items)

---

## What "good" looks like for this pass

When this is done:
- **Together** feels like a private studio wall — formal, clean, modern, generous.
- **Signals** feels like flipping through a quiet notebook. Reading is the act. Each source has a distinct character.
- **Vault calendar** holds her week without nagging her. Drag to reschedule. Today's ring of Sky Blue. Quiet color, not Google saturation.
- **Homepage** greets her with the time and a calm look at what's ahead today.
- **3D knowledge graph** makes her smile the first time it loads. The constellation of her thinking, in space. Jarvis-cool but ESUI-warm.
- **Chat** subtly tells her which mind is answering and gives her clean receipts.
- **Memory audit** earns trust. She sees the AI's notes about her and can edit or forget anything.

---

This pass is the difference between *the system works* and *the system feels like it was made for her*. Reach.
