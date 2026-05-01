"""beauty rename + vault artifact content_types

Revision ID: 0007
Revises: 0006
Create Date: 2026-05-02

- Renames `together_media` → `beauty_media` (matches the user-facing
  widget name; previous schema is preserved structurally).
- Extends `vault_documents.content_type` to include the new tabs:
  - 'idea'              quick captures
  - 'chat_history'      archived chat transcripts
  - 'project_artifact'  durable outputs from Obama / Ulzii (market
                        research, 3-scenario sim, knowledge map,
                        mind map, etc.)
"""

from typing import Sequence, Union

from alembic import op

revision: str = "0007"
down_revision: Union[str, None] = "0006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # together_media → beauty_media
    op.execute("ALTER TABLE together_media RENAME TO beauty_media")
    # Rename indexes too so they match the new table name (PG keeps the old
    # names by default; rename keeps the schema legible).
    op.execute("ALTER INDEX IF EXISTS ix_together_media_created RENAME TO ix_beauty_media_created")
    op.execute("ALTER INDEX IF EXISTS ix_together_media_added_by RENAME TO ix_beauty_media_added_by")

    # Extend vault content_type CHECK
    op.execute("ALTER TABLE vault_documents DROP CONSTRAINT IF EXISTS vault_content_type_check")
    op.execute("""
        ALTER TABLE vault_documents ADD CONSTRAINT vault_content_type_check
        CHECK (content_type IN (
            'note','journal','draft','research','reference',
            'idea','chat_history','project_artifact'
        ))
    """)

    # Optional: add a `kind` column on vault_documents for project_artifact subkinds
    # (market_research / three_scenario_sim / tech_stack / knowledge_map / mind_map / other).
    op.execute("""
        ALTER TABLE vault_documents
        ADD COLUMN IF NOT EXISTS kind text
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_vault_documents_kind ON vault_documents (kind) WHERE kind IS NOT NULL")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_vault_documents_kind")
    op.execute("ALTER TABLE vault_documents DROP COLUMN IF EXISTS kind")

    op.execute("ALTER TABLE vault_documents DROP CONSTRAINT IF EXISTS vault_content_type_check")
    op.execute("""
        ALTER TABLE vault_documents ADD CONSTRAINT vault_content_type_check
        CHECK (content_type IN ('note','journal','draft','research','reference'))
    """)

    op.execute("ALTER INDEX IF EXISTS ix_beauty_media_added_by RENAME TO ix_together_media_added_by")
    op.execute("ALTER INDEX IF EXISTS ix_beauty_media_created RENAME TO ix_together_media_created")
    op.execute("ALTER TABLE beauty_media RENAME TO together_media")
