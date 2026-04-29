# ESUI — Project Brief for Claude Code

---

## What is ESUI

ESUI is a private, web-based AI workspace built for one primary user: **Esui**. It is named after her.

It is not a productivity tool. It is a personal cognitive operating system — a private sanctuary where she can think, learn, create, and live her intellectual life, powered by the best AI available.

The product is built by her boyfriend, **Badrushk** (real name Ulzii, nickname Obama). They are a long-distance couple. The two AI model personas inside ESUI are named after him — **Ulzii** and **Obama** — so when she uses the AI, she is in a sense choosing how her boyfriend thinks with her.

---

## Users

**Esui** is the primary user. She uses every part of the workspace.

**Badrushk** also has access. It is a shared private workspace for the two of them — private chat, shared documents, shared photos, shared knowledge. But the experience is designed around Esui.

There are exactly two accounts. No one else can access this system.

---

## AI Model System

When Esui interacts with AI anywhere in the workspace — in Chat, in Exam, in Vault — she can choose between two AI model modes:

**Obama Mode**
Named after Badrushk's nickname. This is the business and technology thinking style. When she activates Obama Mode, the AI thinks like a founder and strategist. It produces market research, competitive analysis, system architecture, tech stack recommendations, and three-scenario simulations (conservative, base, aggressive). It is a co-pilot for building things and making decisions.

**Ulzii Mode**
Named after Badrushk's real name. This is the intellectual and philosophical thinking style. When she activates Ulzii Mode, the AI thinks like a Theory of Knowledge analyst and learning architect. It produces epistemic maps, structured understanding, quality reasoning paths, and concept visualizations. It is a co-pilot for understanding things deeply and learning the right way.

She switches between them with a simple toggle. The mode she selects applies to the current session. Both modes use intelligent model routing under the hood — the system selects the best AI model (Anthropic, Gemini, Kimi) based on the task, automatically.

---

## The Five Widgets

### Chat

The heart of the workspace. A persistent, private conversation between Esui, Badrushk, and AI.

The chat has memory. It remembers everything across sessions — past conversations, decisions, ideas, files. When she opens a new conversation, the AI already knows the context of her life and work. She never has to repeat herself.

She can import files — PDFs, documents, images — directly into the conversation. The AI reads and reasons over them.

Conversations are organized in a timeline, day by day. She can search across all history. She can branch any conversation in a new direction without losing the original. She can pin a project context so the AI always has that project in mind.

Both Esui and Badrushk can chat together in real time, with the AI as a third participant. When Badrushk is typing, she sees it. When the AI is thinking, she sees it. Everything happens live.

### Exam

A learning compression engine. Esui uploads her lecture notes, reading materials, topic outlines, or exercises — and the AI transforms them into intelligence-dense study artifacts.

What it produces:
- Cheat sheets — maximum information, minimum noise, exactly what she needs for an exam
- Concept maps — visual diagrams showing how ideas connect and depend on each other
- Practice questions — adaptive, calibrated to her knowledge gaps, getting harder as she improves
- Knowledge graphs — Voronoi-style visualizations of the conceptual territory she is covering
- Full exam simulations — timed, realistic, with scoring and analysis of weak areas

The goal is not to study more. It is to study smarter. Every uploaded document becomes a structured intelligence artifact she can use immediately.

### Vault

Her private knowledge repository. Everything she wants to keep, think about, or return to lives here.

Notes. Research. Journals. Drafts. Ideas. Shared documents. Anything.

The Vault is not a folder system. It has a semantic search engine — she searches by meaning, not by filename. She types a thought and the system finds everything related to it, across all her documents, instantly.

The AI organizes her documents automatically — tagging, clustering related ideas, detecting connections between things she wrote months apart. There is a knowledge graph view that shows her documents as a network of ideas. She can see how her thinking is connected.

The Vault feeds into Chat and Exam. When she is chatting or studying, the AI draws from her Vault automatically. Her own knowledge becomes part of the AI's context.

### Together Photos

The most personal feature. Built specifically because Esui and Badrushk are long-distance — they rarely get to take photos together.

While Esui is working in the workspace, a soft moment prompt occasionally appears. It says something like: *"Badrushk wants to take a photo with you today."* She can skip it — and if she does, the system shows a gentle, warm message and disappears. She is never interrupted or pressured.

If she uploads a photo, the system takes that photo and one of Badrushk's photos from the gallery and uses AI image compositing to make it look like they are together in the same scene. Real background removal, lighting matching, perspective alignment, and scene generation — the result looks like an actual photograph of them together.

The composite is saved to the gallery with the date. Over time, the gallery becomes a timeline of moments they chose to be present in each other's day, even from across the world.

The AI compositing uses external APIs — [Remove.bg](http://Remove.bg) for background removal, Stability AI for scene composition. No AI model needs to be trained. It is pure API orchestration.

### Signals

A curated intelligence feed that refreshes every 6 hours.

Not a news feed. A wisdom stream. Each refresh brings a short, curated set of signals across six categories:

- Global signals — what actually matters in the world, stripped of noise
- Technology and market developments
- Mathematics for human flourishing
- Arabic philosophy and classical wisdom
- Chinese philosophy and strategic thought
- Curated research fragments

Items are ephemeral — they disappear after 24 hours unless she saves them. She can pin any signal to her Vault for permanent storage. The system learns what she engages with and refines the curation over time.

The goal is not to consume more information. It is to receive a small, curated dose of signal that she carries with her — something to think about, something to return to, something that expands the shape of her mind.

---

## Together Photos — Moment Prompt Details

The prompt appears only in Esui's session. It is a soft, non-intrusive card in the corner of the screen — not a notification, not a popup. It slides in gently.

If she skips, the system responds with a rotating pool of warm messages:
- "saved for later — he's thinking of you"
- "maybe tonight — the moment will wait"
- "no rush. the gallery will still be here."
- "another time — today is yours"

The compositing pipeline runs in the background. She does not wait. When it is ready, the result appears in her gallery. The minimum gap between prompts is 6 hours. The prompt only appears when she is in a low-intensity session — never when she is deep in an exam or focused task.

---

## Design Philosophy

**Calm.** Nothing fights for her attention. The interface is quiet and purposeful.

**Minimal.** No clutter. Every element earns its place. The design should feel like it was made by someone who cared.

**Intellectual.** The aesthetic matches the content — it feels like a serious, beautiful tool for a serious, curious person.

**Warm.** This is a private space for two people who love each other. It should feel like that.

The color system is Sky Blue, Vanilla, Navy, and Forest Green. Think of it as a private study that feels both calm and alive.

Every interaction must feel smooth. Streaming AI text appears word by word, never a spinner. Transitions between pages are fluid. Loading states are always skeletons — never blank screens. Animations are purposeful and physically accurate. The experience should feel on another level compared to any AI tool she has used before.

---

## Technical Stack

**Frontend:** Next.js 14 (App Router), TypeScript strict, Tailwind CSS, Framer Motion, Zustand, TanStack Query, [Socket.io](http://Socket.io) Client, Radix UI.

**Backend:** Python 3.12, FastAPI, Pydantic v2, SQLAlchemy async, Alembic, Celery, Redis, [Socket.io](http://Socket.io).

**Data:** PostgreSQL 16 with pgvector for semantic memory, Redis for caching and real-time, S3-compatible storage for files and photos.

**AI Models (routed automatically):**
- Anthropic Claude Opus 4.7 
- Anthropic Claude Sonnet 4.6
- Google Gemini 3.1 Pro 
- Moonshot AI Kimi 

**Image APIs:** [Remove.bg](http://Remove.bg) (background removal), Stability AI SDXL (compositing), [FAL.ai](http://FAL.ai) (fast fallback).

**Architecture:** Modular monolith for v1. Single FastAPI app with clearly separated service modules. Memory engine uses pgvector for semantic retrieval across all modules. AI router selects the best model per task — Esui never thinks about which model to use, only which mode (Ulzii or Obama).

---

## The Memory Engine

Every conversation, every document, every exam session writes to a shared memory layer. The memory is stored as vector embeddings in pgvector. Before every AI call, the system retrieves the most semantically relevant memories and injects them into context.

This means the AI gets smarter about Esui over time. It remembers what she has studied, what she cares about, what decisions she has made, what she has written. Her workspace becomes increasingly personalized and contextually aware — not because she configured anything, but because it has been paying attention.

---

## The Quality Bar

This is not a side project. It should feel like software that a small, obsessive team spent months perfecting. Reference points: Linear for speed and calm, Vercel for developer elegance, Arc for personality and warmth.

Every state has a skeleton. Every error has a human message. Every animation has correct physics. Every AI response streams. Every action feels instant. Nothing is slow. Nothing is broken. Nothing is ugly.

Build it like it matters. Because it does.