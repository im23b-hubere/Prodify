import logging
from pathlib import Path

from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy import inspect, text

from app.config import is_sqlite_database_url, settings
from app.database import engine


logger = logging.getLogger(__name__)

REQUIRED_TABLES = {
    "users",
    "sessions",
    "streaks",
    "friendships",
    "push_tokens",
    "refresh_tokens",
    "user_goals",
    "user_achievements",
    "streak_reminder_dispatch_log",
    "user_subscriptions",
    "user_progression",
    "xp_ledger",
    "growth_events",
    "weekly_review_snapshots",
    "public_goals",
    "weekly_challenges",
    "challenge_participants",
    "weekly_checkins",
    "buddy_relationships",
    "checkin_plans",
    "checkin_logs",
    "social_comments",
    "social_reactions",
    "social_challenges",
    "social_challenge_members",
    "social_commitments",
    "streak_rescues",
    "streak_break_notify_dedupe",
    "analytics_event_dedupe",
    "notification_read_states",
}
REQUIRED_COLUMNS = {
    "streaks": {"frozen_day_keys", "freezes_remaining", "billing_month"},
    "sessions": {
        "session_type",
        "deleted_at",
        "mood_level",
        "tags",
        "paused_duration_seconds",
        "pause_started_at",
        "focus_score",
        "track_outcome",
        "track_title",
    },
    "push_tokens": {"is_active", "last_used_at"},
    "users": {
        "profile_picture_url",
        "is_premium",
        "premium_until",
        "bonus_rescues",
        "bonus_challenge_slots",
        "access_token_version",
    },
}


def validate_schema() -> None:
    inspector = inspect(engine)
    table_names = set(inspector.get_table_names())
    _require_tables(table_names)
    _require_columns(inspector, "streaks", REQUIRED_COLUMNS["streaks"])
    _require_columns(inspector, "sessions", REQUIRED_COLUMNS["sessions"])
    _require_push_token_columns(inspector)
    _require_columns(inspector, "users", REQUIRED_COLUMNS["users"])
    _require_production_revision_table(table_names)


def validate_alembic_head_matches() -> None:
    inspector = inspect(engine)
    if "alembic_version" not in inspector.get_table_names():
        return
    config = Config(str(Path(__file__).resolve().parents[2] / "alembic.ini"))
    expected_head = ScriptDirectory.from_config(config).get_current_head()
    with engine.connect() as connection:
        current_revision = connection.execute(
            text("SELECT version_num FROM alembic_version LIMIT 1")
        ).scalar_one_or_none()
    if current_revision and expected_head and current_revision != expected_head:
        _schema_guard(
            f"Alembic database revision is '{current_revision}' but code expects "
            f"'{expected_head}'. Run `alembic upgrade head` before starting."
        )


def _require_tables(table_names: set[str]) -> None:
    missing = REQUIRED_TABLES.difference(table_names)
    if missing:
        names = ", ".join(sorted(missing))
        raise RuntimeError(
            f"Database schema is missing required tables: {names}. Run Alembic migrations."
        )


def _require_columns(inspector, table_name: str, required: set[str]) -> None:
    column_names = {column["name"] for column in inspector.get_columns(table_name)}
    missing = required.difference(column_names)
    if missing:
        names = ", ".join(sorted(missing))
        _schema_guard(
            f"Database schema is missing columns on '{table_name}': {names}. "
            "Run Alembic migrations before starting the API."
        )


def _require_push_token_columns(inspector) -> None:
    column_names = {column["name"] for column in inspector.get_columns("push_tokens")}
    if "channel" not in column_names:
        raise RuntimeError(
            "Database schema is missing column 'channel' on 'push_tokens'. Run Alembic migrations."
        )
    _require_columns(inspector, "push_tokens", REQUIRED_COLUMNS["push_tokens"])


def _require_production_revision_table(table_names: set[str]) -> None:
    is_server_production = settings.environment == "production" and not is_sqlite_database_url(
        settings.database_url
    )
    if is_server_production and "alembic_version" not in table_names:
        raise RuntimeError(
            "Production database has no alembic_version table. Apply migrations before "
            "starting the API: alembic upgrade head"
        )


def _schema_guard(message: str) -> None:
    if settings.startup_schema_strict:
        raise RuntimeError(message)
    logger.warning("startup schema check downgraded to warning: %s", message)
