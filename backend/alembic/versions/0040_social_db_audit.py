"""Social DB audit: friendship constraints and query indexes

Revision ID: 0040_social_db_audit
Revises: 0039_notification_slots
Create Date: 2026-10-19
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0040_social_db_audit"
down_revision: Union[str, None] = "0039_notification_slots"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    _purge_invalid_friendships(bind)

    with op.batch_alter_table("friendships") as batch:
        batch.create_check_constraint("ck_friendship_no_self", "user_id <> friend_id")

    pair_expr = (
        "LEAST(user_id, friend_id), GREATEST(user_id, friend_id)"
        if bind.dialect.name == "postgresql"
        else "min(user_id, friend_id), max(user_id, friend_id)"
    )
    op.execute(
        sa.text(
            "CREATE UNIQUE INDEX IF NOT EXISTS uq_friendship_canonical_pair "
            f"ON friendships ({pair_expr})"
        )
    )
    op.create_index("idx_friendships_status_user", "friendships", ["status", "user_id"])
    op.create_index("idx_friendships_status_friend", "friendships", ["status", "friend_id"])
    op.create_index("idx_sessions_user_stopped", "sessions", ["user_id", "stopped_at"])

    # Replaced by the status+user / status+friend composites above.
    friendship_indexes = {index["name"] for index in sa.inspect(bind).get_indexes("friendships")}
    if "idx_friendships_status" in friendship_indexes:
        op.drop_index("idx_friendships_status", table_name="friendships")


def downgrade() -> None:
    op.create_index("idx_friendships_status", "friendships", ["status"])
    op.drop_index("idx_sessions_user_stopped", table_name="sessions")
    op.drop_index("idx_friendships_status_friend", table_name="friendships")
    op.drop_index("idx_friendships_status_user", table_name="friendships")
    op.execute(sa.text("DROP INDEX IF EXISTS uq_friendship_canonical_pair"))
    with op.batch_alter_table("friendships") as batch:
        batch.drop_constraint("ck_friendship_no_self", type_="check")


def _purge_invalid_friendships(bind) -> None:
    """Remove rows that would violate the new self/canonical constraints."""
    bind.execute(sa.text("DELETE FROM friendships WHERE user_id = friend_id"))
    bind.execute(
        sa.text(
            """
            DELETE FROM friendships
            WHERE id IN (
                SELECT f2.id
                FROM friendships AS f1
                INNER JOIN friendships AS f2
                    ON f1.user_id = f2.friend_id
                   AND f1.friend_id = f2.user_id
                   AND f1.id < f2.id
            )
            """
        )
    )
