"""Tool palette exposed to chat AI calls.

For v1: a single tool — `pin_to_vault` — lets the AI suggest saving the
current insight as a Vault note. The AI cannot bypass user confirmation;
it only emits a tool_use whose result we surface to the UI as a save
affordance ("save?"), recorded as a content_block.

retrieve_more / cite are deferred — the retrieval block we already inject
is rich enough for v1, and citation rendering is a UI concern Claude-Design
can layer in once the basics are running.
"""

from __future__ import annotations

from typing import Any


PIN_TO_VAULT_TOOL = {
    "name": "pin_to_vault",
    "description": (
        "Suggest the user save this insight as a Vault note. The user must "
        "confirm in the UI; you cannot bypass. Use sparingly — only when "
        "the insight is genuinely worth keeping."
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


CHAT_TOOLS: list[dict[str, Any]] = [PIN_TO_VAULT_TOOL]


def render_pin_suggestion(args: dict[str, Any]) -> dict[str, Any]:
    """Convert tool_use args into a content_block the UI can render."""
    return {
        "type": "vault_pin_suggestion",
        "title": str(args.get("title", ""))[:60],
        "content_md": str(args.get("content_md", "")),
        "tags": [str(t) for t in args.get("tags", [])][:3],
    }
