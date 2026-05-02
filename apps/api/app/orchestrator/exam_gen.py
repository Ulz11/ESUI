"""Exam artifact generation prompts.

MVP supports two kinds: cheatsheet and practice_set. Output is structured
JSON via Anthropic tool-use (forced JSON schema).
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.integrations.anthropic import MODEL_IDS, ModelAlias, get_client
from app.models import ExamSource, FileChunk

# Conservative chunk budget for prompts.
MAX_SOURCE_CHARS = 60_000


# ---------- helpers ----------


async def collect_workspace_text(
    session: AsyncSession, workspace_id: UUID, char_budget: int = MAX_SOURCE_CHARS
) -> str:
    """Concatenate all source-file chunks for a workspace, trimmed to budget."""
    sources = (await session.execute(
        select(ExamSource).where(ExamSource.workspace_id == workspace_id)
    )).scalars().all()
    if not sources:
        return ""

    file_ids = [s.file_id for s in sources]
    rows = (await session.execute(
        select(FileChunk)
        .where(FileChunk.file_id.in_(file_ids))
        .order_by(FileChunk.file_id, FileChunk.chunk_index)
    )).scalars().all()

    pieces: list[str] = []
    used = 0
    for c in rows:
        sec = f"[{c.section_path}]\n" if c.section_path else ""
        block = sec + c.text + "\n\n"
        if used + len(block) > char_budget:
            break
        pieces.append(block)
        used += len(block)
    return "".join(pieces)


# ---------- cheatsheet ----------


CHEATSHEET_TOOL = {
    "name": "emit_cheatsheet",
    "description": "Emit the structured cheatsheet for the user.",
    "input_schema": {
        "type": "object",
        "properties": {
            "sections": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "title": {"type": "string"},
                        "items": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "name": {"type": "string"},
                                    "body_md": {"type": "string"},
                                },
                                "required": ["name", "body_md"],
                            },
                        },
                    },
                    "required": ["title", "items"],
                },
            },
            "density_score": {"type": "number"},
        },
        "required": ["sections"],
    },
}


CHEATSHEET_SYSTEM_ULZII = """You produce intelligence-dense cheatsheets for a
sharp student studying for understanding, not memorization.

Structure around EPISTEMIC SHAPE. Default sections:
  - Foundations         (the load-bearing definitions / axioms)
  - Theorems & Proofs   (statement → intuition → proof sketch)
  - Dependencies        (what depends on what; the prerequisite map)
  - Pitfalls            (where students mistake X for Y)
  - Worked Examples     (one or two that exercise the structure)

Each item is a tight markdown blurb. Use *italics* for the load-bearing word.
Quote primary sources when precision matters. Do not invent citations."""


CHEATSHEET_SYSTEM_OBAMA = """You produce intelligence-dense cheatsheets for a
practitioner who needs to ACT on the material — not just understand it.

Structure around APPLIED LEVERAGE. Default sections:
  - The 3-line summary  (what this is, why it matters, what to do)
  - Decision Points     (when to apply X vs Y; tradeoff per option)
  - Action Templates    (concrete steps / checklists / ready-to-use snippets)
  - Failure Modes       (how this breaks in practice; what to watch for)
  - Worked Example      (one realistic application, end-to-end)

Each item is a tight markdown blurb. Recommendation-first. Skip preamble.
Quantify when it sharpens; hand-wave when premature precision is fake."""


async def generate_cheatsheet(
    *,
    model: ModelAlias,
    source_text: str,
    title: str,
    mode: str = "ulzii",
) -> dict[str, Any]:
    sys_prompt = CHEATSHEET_SYSTEM_OBAMA if mode == "obama" else CHEATSHEET_SYSTEM_ULZII
    section_target = "5 sections" if mode == "ulzii" else "5 sections"
    user = (
        f"Title: {title}\n\nProduce a cheatsheet from these sources:\n\n{source_text}\n\n"
        f"Use {section_target}. Each section has 3–8 items. Keep it tight."
    )
    client = get_client()
    resp = await client.messages.create(
        model=MODEL_IDS[model],
        max_tokens=8000,
        temperature=0.3,
        system=sys_prompt,
        tools=[CHEATSHEET_TOOL],
        tool_choice={"type": "tool", "name": "emit_cheatsheet"},
        messages=[{"role": "user", "content": user}],
    )
    for b in resp.content:
        if getattr(b, "type", "") == "tool_use" and b.name == "emit_cheatsheet":
            return {"version": 1, **b.input, "tokens_in": resp.usage.input_tokens,
                    "tokens_out": resp.usage.output_tokens}
    raise RuntimeError("no cheatsheet emitted")


# ---------- practice set ----------


PRACTICE_TOOL = {
    "name": "emit_practice_set",
    "description": "Emit a structured practice question set.",
    "input_schema": {
        "type": "object",
        "properties": {
            "questions": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "id": {"type": "string"},
                        "type": {"type": "string", "enum": ["short_answer", "mcq"]},
                        "prompt": {"type": "string"},
                        "choices": {
                            "type": "array", "items": {"type": "string"},
                        },
                        "correct_index": {"type": "integer"},
                        "expected": {"type": "string"},
                        "rubric": {"type": "string"},
                        "difficulty": {"type": "number"},
                        "topic": {"type": "string"},
                    },
                    "required": ["id", "type", "prompt", "topic", "difficulty"],
                },
            },
            "topics_covered": {
                "type": "array", "items": {"type": "string"},
            },
        },
        "required": ["questions"],
    },
}


PRACTICE_SYSTEM = """You write calibrated practice questions from study material.
Mix short-answer and MCQ. Difficulty 0.0–1.0 (0=warm-up, 1=hard). Cover the
material's range; don't cluster on one topic. Provide model rubric or correct_index."""


async def generate_practice_set(
    *,
    model: ModelAlias,
    source_text: str,
    title: str,
    n_questions: int = 10,
    weak_topics: list[str] | None = None,
) -> dict[str, Any]:
    weak_hint = (
        f"\n\nBias 60% of questions toward these weak topics: {', '.join(weak_topics)}."
        if weak_topics
        else ""
    )
    user = (
        f"Title: {title}\n\nGenerate {n_questions} practice questions from "
        f"these sources:\n\n{source_text}{weak_hint}"
    )
    client = get_client()
    resp = await client.messages.create(
        model=MODEL_IDS[model],
        max_tokens=6000,
        temperature=0.5,
        system=PRACTICE_SYSTEM,
        tools=[PRACTICE_TOOL],
        tool_choice={"type": "tool", "name": "emit_practice_set"},
        messages=[{"role": "user", "content": user}],
    )
    for b in resp.content:
        if getattr(b, "type", "") == "tool_use" and b.name == "emit_practice_set":
            return {
                "version": 1, **b.input,
                "tokens_in": resp.usage.input_tokens,
                "tokens_out": resp.usage.output_tokens,
            }
    raise RuntimeError("no practice set emitted")


# ---------- concept map ----------


CONCEPT_MAP_TOOL = {
    "name": "emit_concept_map",
    "description": "Emit a concept map of the material.",
    "input_schema": {
        "type": "object",
        "properties": {
            "nodes": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "id": {"type": "string"},
                        "label": {"type": "string"},
                        "kind": {"type": "string", "enum": ["concept", "definition", "theorem", "method"]},
                        "depth": {"type": "integer", "description": "0=foundational"},
                        "summary": {"type": "string"},
                    },
                    "required": ["id", "label", "kind", "depth"],
                },
            },
            "edges": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "from": {"type": "string"},
                        "to": {"type": "string"},
                        "label": {"type": "string"},
                    },
                    "required": ["from", "to", "label"],
                },
            },
            "layout_hint": {"type": "string", "enum": ["hierarchical", "radial", "force"]},
        },
        "required": ["nodes", "edges"],
    },
}


CONCEPT_MAP_SYSTEM = """You build concept maps that show STRUCTURE: what's
foundational, what builds on what, where the load-bearing assumptions live.
Use depth=0 for foundational, increasing as ideas build. Edges are typed:
'implies', 'specializes', 'requires', 'contrasts', 'supports'."""


async def generate_concept_map(
    *, model: ModelAlias, source_text: str, title: str
) -> dict[str, Any]:
    user = (
        f"Title: {title}\n\nProduce a concept map from these sources. Aim for "
        f"15-30 nodes; clarity over completeness.\n\n{source_text}"
    )
    client = get_client()
    resp = await client.messages.create(
        model=MODEL_IDS[model],
        max_tokens=6000,
        temperature=0.3,
        system=CONCEPT_MAP_SYSTEM,
        tools=[CONCEPT_MAP_TOOL],
        tool_choice={"type": "tool", "name": "emit_concept_map"},
        messages=[{"role": "user", "content": user}],
    )
    for b in resp.content:
        if getattr(b, "type", "") == "tool_use" and b.name == "emit_concept_map":
            return {
                "version": 1, **b.input,
                "tokens_in": resp.usage.input_tokens,
                "tokens_out": resp.usage.output_tokens,
            }
    raise RuntimeError("no concept map emitted")


# ---------- knowledge graph (Voronoi-style) ----------


KNOWLEDGE_GRAPH_TOOL = {
    "name": "emit_knowledge_graph",
    "description": "Emit a Voronoi-friendly knowledge graph of the territory.",
    "input_schema": {
        "type": "object",
        "properties": {
            "regions": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "id": {"type": "string"},
                        "label": {"type": "string"},
                        "color": {"type": "string"},
                    },
                    "required": ["id", "label"],
                },
            },
            "nodes": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "id": {"type": "string"},
                        "label": {"type": "string"},
                        "region": {"type": "string"},
                        "weight": {
                            "type": "number",
                            "description": "0-1, where larger = more central/important",
                        },
                        "x": {"type": "number", "description": "0-1 hint"},
                        "y": {"type": "number", "description": "0-1 hint"},
                        "summary": {"type": "string"},
                    },
                    "required": ["id", "label", "region", "weight"],
                },
            },
            "edges": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "from": {"type": "string"},
                        "to": {"type": "string"},
                        "kind": {
                            "type": "string",
                            "enum": ["prereq", "supports", "specializes", "contrasts"],
                        },
                    },
                    "required": ["from", "to", "kind"],
                },
            },
        },
        "required": ["regions", "nodes", "edges"],
    },
}


KNOWLEDGE_GRAPH_SYSTEM = """You map the conceptual territory of a subject. Group
related concepts into 3–5 regions; place 20–60 nodes across them with weights
reflecting centrality. Provide x/y hints in [0,1] for layout. Edges are typed:
'prereq', 'supports', 'specializes', 'contrasts'."""


async def generate_knowledge_graph(
    *, model: ModelAlias, source_text: str, title: str
) -> dict[str, Any]:
    user = (
        f"Title: {title}\n\nMap the territory of these sources. Use 3-5 regions, "
        f"20-60 nodes, weights ∈ [0,1].\n\n{source_text}"
    )
    client = get_client()
    resp = await client.messages.create(
        model=MODEL_IDS[model],
        max_tokens=8000,
        temperature=0.3,
        system=KNOWLEDGE_GRAPH_SYSTEM,
        tools=[KNOWLEDGE_GRAPH_TOOL],
        tool_choice={"type": "tool", "name": "emit_knowledge_graph"},
        messages=[{"role": "user", "content": user}],
    )
    for b in resp.content:
        if getattr(b, "type", "") == "tool_use" and b.name == "emit_knowledge_graph":
            return {
                "version": 1, **b.input,
                "tokens_in": resp.usage.input_tokens,
                "tokens_out": resp.usage.output_tokens,
            }
    raise RuntimeError("no knowledge graph emitted")


# ---------- simulation (timed test) ----------


SIMULATION_TOOL = {
    "name": "emit_simulation",
    "description": "Emit a realistic timed test simulation.",
    "input_schema": {
        "type": "object",
        "properties": {
            "config": {
                "type": "object",
                "properties": {
                    "duration_min": {"type": "integer"},
                    "n_questions": {"type": "integer"},
                    "rubric_mode": {"type": "string", "enum": ["ai-grade", "self"]},
                },
                "required": ["duration_min", "n_questions", "rubric_mode"],
            },
            "instructions": {"type": "string"},
            "questions": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "id": {"type": "string"},
                        "type": {
                            "type": "string",
                            "enum": ["short_answer", "mcq", "proof_sketch", "essay"],
                        },
                        "prompt": {"type": "string"},
                        "choices": {"type": "array", "items": {"type": "string"}},
                        "correct_index": {"type": "integer"},
                        "expected": {"type": "string"},
                        "rubric": {"type": "string"},
                        "points": {"type": "integer"},
                        "topic": {"type": "string"},
                        "difficulty": {"type": "number"},
                    },
                    "required": ["id", "type", "prompt", "topic", "points"],
                },
            },
        },
        "required": ["config", "questions"],
    },
}


SIMULATION_SYSTEM = """You construct realistic timed test simulations. Spread
difficulty intentionally (start gentle, peak in the middle, end with a big
applied question). Vary question types. Provide rubric for short_answer/proof
questions; correct_index for MCQ. Keep total points coherent (e.g., 100)."""


async def generate_simulation(
    *,
    model: ModelAlias,
    source_text: str,
    title: str,
    duration_min: int = 90,
    n_questions: int = 12,
    rubric_mode: str = "ai-grade",
) -> dict[str, Any]:
    user = (
        f"Title: {title}\n\nGenerate a {duration_min}-minute simulation with "
        f"{n_questions} questions ({rubric_mode}).\n\n{source_text}"
    )
    client = get_client()
    resp = await client.messages.create(
        model=MODEL_IDS[model],
        max_tokens=8000,
        temperature=0.5,
        system=SIMULATION_SYSTEM,
        tools=[SIMULATION_TOOL],
        tool_choice={"type": "tool", "name": "emit_simulation"},
        messages=[{"role": "user", "content": user}],
    )
    for b in resp.content:
        if getattr(b, "type", "") == "tool_use" and b.name == "emit_simulation":
            return {
                "version": 1, **b.input,
                "tokens_in": resp.usage.input_tokens,
                "tokens_out": resp.usage.output_tokens,
            }
    raise RuntimeError("no simulation emitted")


# ---------- summary (drop-to-files) ----------


SUMMARY_TOOL = {
    "name": "emit_summary",
    "description": "Emit a narrative summary of the dropped material.",
    "input_schema": {
        "type": "object",
        "properties": {
            "headline": {
                "type": "string",
                "description": "One-line distilled thesis of the material.",
            },
            "sections": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "title": {"type": "string"},
                        "body_md": {"type": "string"},
                    },
                    "required": ["title", "body_md"],
                },
                "description": "3-6 narrative sections, in reading order.",
            },
            "key_terms": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "term": {"type": "string"},
                        "gloss": {"type": "string"},
                    },
                    "required": ["term", "gloss"],
                },
                "description": "5-15 load-bearing terms, briefly defined.",
            },
            "open_questions": {
                "type": "array",
                "items": {"type": "string"},
                "description": "0-5 questions the source doesn't answer cleanly.",
            },
        },
        "required": ["headline", "sections"],
    },
}


SUMMARY_SYSTEM_ULZII = """You write study summaries that respect the
*epistemic shape* of the material — what's foundational vs. derived,
what's contested, where the load-bearing definitions live.

Voice: a thoughtful tutor narrating the material to a sharp student.
Use *italics* for the load-bearing word in a sentence. Quote primary
sources only when precision matters. Don't invent citations."""


SUMMARY_SYSTEM_OBAMA = """You write study summaries that orient a busy
practitioner: what's the thesis, what's the structure, what should I take
away, what would change my mind.

Voice: a sharp briefer. Recommendation-first. Skip preamble. Use
*italics* for the load-bearing word. Quantify when it sharpens."""


async def generate_summary(
    *,
    model: ModelAlias,
    source_text: str,
    title: str,
    mode: str = "ulzii",
) -> dict[str, Any]:
    sys_prompt = SUMMARY_SYSTEM_OBAMA if mode == "obama" else SUMMARY_SYSTEM_ULZII
    user = (
        f"Title: {title}\n\nSummarize this material. 3–6 sections, "
        f"5–15 key terms, 0–5 open questions:\n\n{source_text}"
    )
    client = get_client()
    resp = await client.messages.create(
        model=MODEL_IDS[model],
        max_tokens=4000,
        temperature=0.3,
        system=sys_prompt,
        tools=[SUMMARY_TOOL],
        tool_choice={"type": "tool", "name": "emit_summary"},
        messages=[{"role": "user", "content": user}],
    )
    for b in resp.content:
        if getattr(b, "type", "") == "tool_use" and b.name == "emit_summary":
            return {
                "version": 1,
                **b.input,
                "tokens_in": resp.usage.input_tokens,
                "tokens_out": resp.usage.output_tokens,
            }
    raise RuntimeError("no summary emitted")


# ---------- flashcards (Anki-style flip) ----------


FLASHCARD_TOOL = {
    "name": "emit_flashcards",
    "description": "Emit a flashcard deck (front/back pairs).",
    "input_schema": {
        "type": "object",
        "properties": {
            "cards": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "front": {
                            "type": "string",
                            "description": "Question or prompt — the side shown first.",
                        },
                        "back": {
                            "type": "string",
                            "description": "Answer — concise but complete enough to teach.",
                        },
                        "topic": {
                            "type": "string",
                            "description": "Sub-topic tag for grouping in the UI.",
                        },
                        "difficulty": {
                            "type": "number",
                            "description": "0.0 = warm-up, 1.0 = hardest.",
                        },
                    },
                    "required": ["front", "back", "topic"],
                },
                "description": "Ordered list, gentle to hard within each topic.",
            },
            "topics": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Distinct topics covered, in encounter order.",
            },
        },
        "required": ["cards"],
    },
}


FLASHCARD_SYSTEM = """You produce flashcard decks for active recall study.
Each card: ONE atomic question on the front, a concise but complete answer
on the back (1–4 sentences; longer only when proof / derivation requires).

Cover the material's RANGE — don't cluster on one topic. Mix factual recall
with reasoning prompts. Avoid trivia; favour load-bearing concepts.

Front: phrased as a clean question. Don't give away the answer.
Back: teach the concept, not just state the fact. Include a brief 'why'.
Use *italics* for the load-bearing word. Don't invent citations."""


async def generate_flashcards(
    *,
    model: ModelAlias,
    source_text: str,
    title: str,
    n_cards: int = 20,
) -> dict[str, Any]:
    user = (
        f"Title: {title}\n\nProduce a deck of {n_cards} flashcards from these "
        f"sources. Cover the range; gentle → hard within each topic.\n\n{source_text}"
    )
    client = get_client()
    resp = await client.messages.create(
        model=MODEL_IDS[model],
        max_tokens=8000,
        temperature=0.5,
        system=FLASHCARD_SYSTEM,
        tools=[FLASHCARD_TOOL],
        tool_choice={"type": "tool", "name": "emit_flashcards"},
        messages=[{"role": "user", "content": user}],
    )
    for b in resp.content:
        if getattr(b, "type", "") == "tool_use" and b.name == "emit_flashcards":
            cards = b.input.get("cards", [])
            # Initialize per-card RNN scheduler state at h=0.1 (new card,
            # weak memory). The frontend updates these via /flashcards/{id}/review.
            review_state = {
                str(i): {"h": 0.1, "last_review": None, "reviews": 0, "streak": 0}
                for i in range(len(cards))
            }
            return {
                "version": 1,
                **b.input,
                "review_state": review_state,
                "tokens_in": resp.usage.input_tokens,
                "tokens_out": resp.usage.output_tokens,
            }
    raise RuntimeError("no flashcards emitted")


# ---------- grading ----------


GRADE_TOOL = {
    "name": "emit_grade",
    "description": "Grade an attempt and identify weak topics.",
    "input_schema": {
        "type": "object",
        "properties": {
            "score": {"type": "number", "description": "0-100 normalized"},
            "per_question": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "id": {"type": "string"},
                        "earned": {"type": "number"},
                        "max": {"type": "number"},
                        "feedback": {"type": "string"},
                    },
                    "required": ["id", "earned", "max"],
                },
            },
            "weak_topics": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "topic": {"type": "string"},
                        "confidence": {
                            "type": "number",
                            "description": "0-1, lower means weaker",
                        },
                    },
                    "required": ["topic", "confidence"],
                },
            },
            "summary": {"type": "string"},
        },
        "required": ["score", "per_question", "weak_topics"],
    },
}


GRADE_SYSTEM = """You grade student attempts against rubrics. Be fair and
specific. Identify weak_topics (confidence < 0.6) so the next practice set
can target them. Score is normalized to 0-100."""


async def grade_attempt(
    *,
    artifact_payload: dict[str, Any],
    responses: dict[str, Any],
    duration_sec: int | None,
) -> dict[str, Any]:
    questions = artifact_payload.get("questions", [])
    items: list[str] = []
    for q in questions:
        qid = q["id"]
        ans = responses.get(qid, "")
        items.append(
            f"[{qid}] ({q['type']}) {q['prompt']}\n"
            f"  topic: {q.get('topic')}\n"
            f"  rubric: {q.get('rubric','')}\n"
            f"  expected: {q.get('expected','')}\n"
            f"  user_response: {ans}\n"
        )
    user = "Grade this attempt:\n\n" + "\n".join(items)

    client = get_client()
    resp = await client.messages.create(
        model=MODEL_IDS["sonnet"],
        max_tokens=4000,
        temperature=0.2,
        system=GRADE_SYSTEM,
        tools=[GRADE_TOOL],
        tool_choice={"type": "tool", "name": "emit_grade"},
        messages=[{"role": "user", "content": user}],
    )
    for b in resp.content:
        if getattr(b, "type", "") == "tool_use" and b.name == "emit_grade":
            return {
                **b.input,
                "tokens_in": resp.usage.input_tokens,
                "tokens_out": resp.usage.output_tokens,
            }
    raise RuntimeError("no grade emitted")
