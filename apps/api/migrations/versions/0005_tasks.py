"""tasks (calendar + task management)

Revision ID: 0005
Revises: 0004
Create Date: 2026-05-02

Adds a tasks table for the calendar/scheduling surface inside Vault.
A row is either a task (todo with optional due date) or an event
(scheduled block with start/end). Shared between the two users when
`shared = true`, otherwise private to owner.
"""

from typing import Sequence, Union

from alembic import op

revision: str = "0005"
down_revision: Union[str, None] = "0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE tasks (
            id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            owner_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            kind            text NOT NULL DEFAULT 'task'
                            CHECK (kind IN ('task','event')),
            title           text NOT NULL,
            description     text,
            status          text NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending','in_progress','done','cancelled')),
            starts_at       timestamptz,
            ends_at         timestamptz,
            all_day         boolean NOT NULL DEFAULT false,
            color           text,
            shared          boolean NOT NULL DEFAULT false,
            recurrence_rule text,
            location        text,
            created_at      timestamptz NOT NULL DEFAULT now(),
            updated_at      timestamptz NOT NULL DEFAULT now(),
            completed_at    timestamptz,
            archived_at     timestamptz
        )
    """)
    op.execute("CREATE INDEX ix_tasks_owner_starts ON tasks (owner_id, starts_at)")
    op.execute("CREATE INDEX ix_tasks_owner_status ON tasks (owner_id, status) WHERE archived_at IS NULL")
    op.execute("CREATE INDEX ix_tasks_shared ON tasks (shared) WHERE shared = true AND archived_at IS NULL")
    op.execute("CREATE INDEX ix_tasks_range ON tasks (starts_at, ends_at) WHERE archived_at IS NULL")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS tasks CASCADE")
