from app.database import Base
from app.models import (
    BuddyStatus,
    SocialChallenge,
    User,
    UserProgression,
    WeeklyReviewSnapshot,
)
from app.models_growth import UserProgression as GrowthUserProgression
from app.models_growth import WeeklyReviewSnapshot as GrowthWeeklyReviewSnapshot
from app.models_social import BuddyStatus as SocialBuddyStatus
from app.models_social import SocialChallenge as SocialSocialChallenge


def test_legacy_model_registry_reexports_capability_models() -> None:
    assert UserProgression is GrowthUserProgression
    assert WeeklyReviewSnapshot is GrowthWeeklyReviewSnapshot
    assert BuddyStatus is SocialBuddyStatus
    assert SocialChallenge is SocialSocialChallenge


def test_model_registry_registers_core_growth_and_social_tables() -> None:
    assert User.__table__.metadata is Base.metadata
    assert {"users", "user_progression", "weekly_review_snapshots", "social_challenges"} <= set(
        Base.metadata.tables
    )
