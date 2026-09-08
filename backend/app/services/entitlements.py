from datetime import datetime, timezone

from app.models import User


class EntitlementService:
    """Central entitlement checks for premium and feature gates."""

    @staticmethod
    def is_premium(user: User) -> bool:
        if not bool(user.is_premium):
            return False
        if user.premium_until is None:
            return True
        until = user.premium_until
        if until.tzinfo is None:
            until = until.replace(tzinfo=timezone.utc)
        return until > datetime.now(timezone.utc)

    @staticmethod
    def get_streak_freeze_limit(user: User) -> int:
        # HTTP callers are already subscribers. The free cap only remains for leftover
        # unpaid rows that a background job might still touch.
        return 999 if EntitlementService.is_premium(user) else 1
