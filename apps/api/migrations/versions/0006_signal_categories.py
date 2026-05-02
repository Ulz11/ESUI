"""signals categories: francis_su + inspiration

Revision ID: 0006
Revises: 0005
Create Date: 2026-05-02

The four daily-signal sources locked in:
  - chinese_philosophy
  - arabic_philosophy
  - francis_su             (Mathematics for Human Flourishing)
  - inspiration            (real wisdom, not cringe)

Old categories ('mathematics', 'elements_of_ai', etc.) are dropped from
existing rows since they're no longer surfaced.
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0006"
down_revision: str | None = "0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Migrate existing rows: 'mathematics' → 'francis_su',
    # 'elements_of_ai' → 'inspiration', drop unrecognized.
    op.execute("UPDATE signals SET category = 'francis_su' WHERE category = 'mathematics'")
    op.execute("UPDATE signals SET category = 'inspiration' WHERE category = 'elements_of_ai'")
    op.execute("""
        DELETE FROM signals
        WHERE category NOT IN
              ('chinese_philosophy','arabic_philosophy','francis_su','inspiration')
    """)

    op.execute("ALTER TABLE signals DROP CONSTRAINT IF EXISTS signals_category_check")
    op.execute("""
        ALTER TABLE signals ADD CONSTRAINT signals_category_check
        CHECK (category IN
            ('chinese_philosophy','arabic_philosophy','francis_su','inspiration'))
    """)


def downgrade() -> None:
    op.execute("ALTER TABLE signals DROP CONSTRAINT IF EXISTS signals_category_check")
    op.execute("""
        ALTER TABLE signals ADD CONSTRAINT signals_category_check
        CHECK (category IN
            ('mathematics','arabic_philosophy','chinese_philosophy','elements_of_ai'))
    """)
