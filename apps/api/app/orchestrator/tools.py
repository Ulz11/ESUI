"""Tool palette exposed to chat AI calls.

Two tools available to both modes (Ulzii and Obama):

  pin_to_vault    — suggest a small insight be saved as a Vault note.
                    Renders inline as a save affordance.

  save_artifact   — propose saving a richer durable output as a project
                    artifact in Vault. Used when one of the modes
                    produces something Esui will want to keep:
                      * Obama: market research, 3-scenario sim,
                        tech-stack proposal, decision memo.
                      * Ulzii: knowledge map (Voronoi), mind map,
                        TOK exploration, area-bridge.

Both render as content_blocks in the streamed message; both require
Esui's click to actually persist (the AI cannot bypass).
"""

from __future__ import annotations

from typing import Any


PIN_TO_VAULT_TOOL = {
    "name": "pin_to_vault",
    "description": (
        "Suggest the user save this insight as a small Vault note. The user "
        "must confirm in the UI; you cannot bypass. Use sparingly — only "
        "when the insight is genuinely worth keeping."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "title": {"type": "string", "description": "Short title (≤60 chars)."},
            "content_md": {"type": "string", "description": "Markdown body of the note."},
            "tags": {
                "type": "array",
                "items": {"type": "string"},
                "description": "0–3 short, lowercase, hyphenated tags.",
            },
        },
        "required": ["title", "content_md"],
    },
}


SAVE_ARTIFACT_TOOL = {
    "name": "save_artifact",
    "description": (
        "Propose saving a durable, structured output from this chat as a "
        "project artifact in Vault. Use this when you've produced something "
        "Esui will want again — a market research, a 3-scenario simulation, "
        "a tech-stack proposal, a knowledge map, a mind map. The user must "
        "confirm; you cannot bypass."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "title": {"type": "string", "description": "Concise title (≤80 chars)."},
            "content_md": {
                "type": "string",
                "description": (
                    "The artifact body in markdown. Include any structured "
                    "JSON (e.g. a knowledge graph) inside a fenced code block."
                ),
            },
            "kind": {
                "type": "string",
                "enum": [
                    "market_research",
                    "three_scenario_sim",
                    "tech_stack",
                    "decision_memo",
                    "knowledge_map",
                    "mind_map",
                    "tok_exploration",
                    "other",
                ],
                "description": "Subkind for visual treatment in Vault.",
            },
            "tags": {
                "type": "array",
                "items": {"type": "string"},
                "description": "0–5 short tags.",
            },
        },
        "required": ["title", "content_md", "kind"],
    },
}


CHAT_TOOLS: list[dict[str, Any]] = [PIN_TO_VAULT_TOOL, SAVE_ARTIFACT_TOOL]


def render_pin_suggestion(args: dict[str, Any]) -> dict[str, Any]:
    """Convert pin_to_vault args into a content_block the UI can render."""
    return {
        "type": "vault_pin_suggestion",
        "title": str(args.get("title", ""))[:60],
        "content_md": str(args.get("content_md", "")),
        "tags": [str(t) for t in args.get("tags", [])][:3],
    }


def render_save_artifact(args: dict[str, Any]) -> dict[str, Any]:
    """Convert save_artifact args into a content_block the UI renders as
    an artifact-save card. Includes a `kind` so the renderer can pick the
    right visual treatment (Voronoi, scenario columns, market table, etc.).
    """
    valid_kinds = {
        "market_research", "three_scenario_sim", "tech_stack",
        "decision_memo", "knowledge_map", "mind_map",
        "tok_exploration", "other",
    }
    kind = str(args.get("kind", "other"))
    if kind not in valid_kinds:
        kind = "other"
    return {
        "type": "vault_artifact_suggestion",
        "title": str(args.get("title", ""))[:80],
        "content_md": str(args.get("content_md", "")),
        "kind": kind,
        "tags": [str(t) for t in args.get("tags", [])][:5],
    }
