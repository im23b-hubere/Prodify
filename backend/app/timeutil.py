from datetime import datetime, timezone


def as_utc_aware(dt: datetime) -> datetime:
    """SQLite often returns naive datetimes; normalize to UTC-aware for arithmetic."""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)
