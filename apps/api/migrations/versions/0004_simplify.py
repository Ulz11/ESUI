"""simplify together + signals

Revision ID: 0004
Revises: 0003
Create Date: 2026-04-28

Together becomes a plain drag-drop gallery (images + videos).
Signals becomes a user-entered quote feed, four categories:
  - mathematics            (Mathematics for Human Flourishing — Francis Su)
  - arabic_philosophy      (Arabic / Arabian philosophy)
  - chinese_philosophy     (Chinese philosophy)
  - elements_of_ai         (Elements of AI course)

Removes nothing destructively — old tables stay so dev data isn't lost,
but the application stops touching them. Adds:
  - files.kind allows 'video'
  - signals.category restricted to the 4 new buckets; expires_at + cycle_id nullable
  - together_media table for the gallery
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0004"
down_revision: str | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # files.kind: add 'video'
    op.execute("ALTER TABLE files DROP CONSTRAINT IF EXISTS files_kind_check")
    op.execute("""
        ALTER TABLE files ADD CONSTRAINT files_kind_check
        CHECK (kind IN ('pdf','image','doc','audio','video','other'))
    """)

    # signals: nullable expires_at + cycle_id (quotes don't expire / don't cycle)
    op.execute("ALTER TABLE signals ALTER COLUMN expires_at DROP NOT NULL")
    op.execute("ALTER TABLE signals ALTER COLUMN cycle_id DROP NOT NULL")

    # signals.category: restrict to the new four; remove old auto-curated values
    op.execute("""
        DELETE FROM signals
        WHERE category NOT IN
              ('mathematics','arabic_philosophy','chinese_philosophy','elements_of_ai')
    """)
    op.execute("ALTER TABLE signals DROP CONSTRAINT IF EXISTS signals_category_check")
    op.execute("""
        ALTER TABLE signals ADD CONSTRAINT signals_category_check
        CHECK (category IN
            ('mathematics','arabic_philosophy','chinese_philosophy','elements_of_ai'))
    """)

    # together_media: the new gallery
    op.execute("""
        CREATE TABLE together_media (
            id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            file_id     uuid NOT NULL REFERENCES files(id) ON DELETE CASCADE,
            caption     text,
            taken_at    timestamptz,
            added_by    uuid NOT NULL REFERENCES users(id),
            created_at  timestamptz NOT NULL DEFAULT now()
        )
    """)
    op.execute("CREATE INDEX ix_together_media_created ON together_media (created_at DESC)")
    op.execute("CREATE INDEX ix_together_media_added_by ON together_media (added_by)")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS together_media")
    op.execute("ALTER TABLE signals DROP CONSTRAINT IF EXISTS signals_category_check")
    op.execute("""
        ALTER TABLE signals ADD CONSTRAINT signals_category_check
        CHECK (category IN
            ('global','tech','mathematics','arabic_philosophy',
             'chinese_philosophy','research'))
    """)
    op.execute("ALTER TABLE files DROP CONSTRAINT IF EXISTS files_kind_check")
    op.execute("""
        ALTER TABLE files ADD CONSTRAINT files_kind_check
        CHECK (kind IN ('pdf','image','doc','audio','other'))
    """)
