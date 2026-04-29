"""signal_drops + signals.topic

Revision ID: 0003
Revises: 0002
Create Date: 2026-04-28

Per-user "drop" record so a user can permanently remove a signal from their
view (separate from the soft-feedback `dismiss` engagement). Also adds a
`topic` column on signals to track which curated topic produced a signal —
useful for next-cycle dedup and for the AI-topic rotation.
"""

from typing import Sequence, Union

from alembic import op

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        ALTER TABLE signals
        ADD COLUMN IF NOT EXISTS topic text,
        ADD COLUMN IF NOT EXISTS provider text  -- 'rss' | 'ai_topic'
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_signals_topic ON signals (topic)")

    op.execute("""
        CREATE TABLE signal_drops (
            id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            signal_id   uuid NOT NULL REFERENCES signals(id) ON DELETE CASCADE,
            user_id     uuid NOT NULL REFERENCES users(id),
            embedding   vector(1024),  -- snapshot of dropped signal's embedding
            topic       text,
            created_at  timestamptz NOT NULL DEFAULT now(),
            UNIQUE (signal_id, user_id)
        )
    """)
    op.execute("CREATE INDEX ix_signal_drops_user ON signal_drops (user_id, created_at DESC)")
    op.execute(
        "CREATE INDEX ix_signal_drops_hnsw ON signal_drops "
        "USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64)"
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS signal_drops CASCADE")
    op.execute("ALTER TABLE signals DROP COLUMN IF EXISTS provider")
    op.execute("ALTER TABLE signals DROP COLUMN IF EXISTS topic")
