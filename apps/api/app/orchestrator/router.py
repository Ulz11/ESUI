"""Task → model routing (Anthropic-only for v1 MVP).

The architecture docs cover Gemini and Kimi for v2; v1 keeps a single provider
to minimize moving parts. Sonnet is the workhorse; Opus for high-stakes
generation (cheatsheets); Haiku for cheap classification jobs.
"""

from __future__ import annotations

from typing import Literal

from app.integrations.anthropic import ModelAlias

TaskKind = Literal[
    "chat",
    "exam.cheatsheet",
    "exam.practice_set",
    "exam.grade",
    "vault.tag",
    "vault.title",
    "vault.summarize",
    "signals.distill",
    "memory.classify",
    "together.scene_prompt",
    "chat.auto_title",
]


_TASK_DEFAULT: dict[TaskKind, ModelAlias] = {
    "chat": "sonnet",
    "exam.cheatsheet": "opus",
    "exam.practice_set": "sonnet",
    "exam.grade": "sonnet",
    "vault.tag": "haiku",
    "vault.title": "haiku",
    "vault.summarize": "sonnet",
    "signals.distill": "sonnet",
    "memory.classify": "haiku",
    "together.scene_prompt": "sonnet",
    "chat.auto_title": "haiku",
}


def select_model(task: TaskKind, *, hint: ModelAlias | None = None) -> ModelAlias:
    if hint is not None:
        return hint
    return _TASK_DEFAULT[task]
