"""exam: allow summary + flashcard_deck artifact kinds

Revision ID: 0008
Revises: 0007
Create Date: 2026-05-02

The drop-to-files / auto-summary / flashcard-deck flow needs two new
ExamArtifact kinds:

- summary        — a narrative summary of the dropped material
- flashcard_deck — flip-card Q/A pairs with per-card RNN scheduler state
                   stored inside payload.review_state[card_idx].

The check constraint is widened. No table changes.
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0008"
down_revision: str | None = "0007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("ALTER TABLE exam_artifacts DROP CONSTRAINT IF EXISTS exam_artifacts_kind_check")
    op.execute("""
        ALTER TABLE exam_artifacts ADD CONSTRAINT exam_artifacts_kind_check
        CHECK (kind IN (
            'cheatsheet','concept_map','practice_set',
            'knowledge_graph','simulation',
            'summary','flashcard_deck'
        ))
    """)


def downgrade() -> None:
    op.execute("ALTER TABLE exam_artifacts DROP CONSTRAINT IF EXISTS exam_artifacts_kind_check")
    op.execute("""
        ALTER TABLE exam_artifacts ADD CONSTRAINT exam_artifacts_kind_check
        CHECK (kind IN (
            'cheatsheet','concept_map','practice_set',
            'knowledge_graph','simulation'
        ))
    """)
