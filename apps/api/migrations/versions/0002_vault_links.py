"""vault_links

Revision ID: 0002
Revises: 0001
Create Date: 2026-04-26

Adds vault_links for the knowledge-graph view + auto-linking job.
"""

from typing import Sequence, Union

from alembic import op

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE vault_links (
            id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            source_doc_id   uuid NOT NULL REFERENCES vault_documents(id) ON DELETE CASCADE,
            target_doc_id   uuid NOT NULL REFERENCES vault_documents(id) ON DELETE CASCADE,
            kind            text NOT NULL CHECK (kind IN ('semantic','explicit')),
            strength        real,
            note            text,
            created_at      timestamptz NOT NULL DEFAULT now(),
            UNIQUE (source_doc_id, target_doc_id, kind)
        )
    """)
    op.execute("CREATE INDEX ix_vault_links_source ON vault_links (source_doc_id)")
    op.execute("CREATE INDEX ix_vault_links_target ON vault_links (target_doc_id)")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS vault_links CASCADE")
