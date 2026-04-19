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
    def can_use_feature(user: User, feature: str) -> bool:
        if EntitlementService.is_premium(user):
            return True
        free_features = {
            "basic_stats": True,
            "weekly_review": False,
            "export_data": False,
            "custom_themes": False,
        }
        return bool(free_features.get(feature, False))

    @staticmethod
    def get_streak_freeze_limit(user: User) -> int:
        return 999 if EntitlementService.is_premium(user) else 1
