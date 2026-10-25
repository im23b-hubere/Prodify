"""Delete a user and all data owned by or connected to that user."""

import json

from sqlalchemy import delete, or_, select
from sqlalchemy.orm import Session

from app.services.object_storage import delete_by_public_url

from app.models import (
    AnalyticsEventDedupe,
    BuddyRelationship,
    ChallengeParticipant,
    CheckinLog,
    CheckinPlan,
    ContentReport,
    FriendNudge,
    Friendship,
    GrowthEvent,
    LeaderboardSnapshot,
    NotificationDelivery,
    NotificationReadState,
    ProductionSession,
    PublicGoal,
    PushToken,
    RefreshToken,
    SessionAreaWeight,
    SessionSkillFocus,
    SocialChallenge,
    SocialChallengeMember,
    SocialComment,
    SocialCommitment,
    SocialReaction,
    Streak,
    StreakBreakNotifyDedupe,
    StreakReminderDispatchLog,
    StreakRescue,
    User,
    UserAchievement,
    UserBlock,
    UserGoal,
    UserEngagementProfile,
    UserIdentity,
    UserNotificationPreferences,
    UserProgression,
    UserSubscription,
    WeeklyCheckin,
    WeeklyReviewSnapshot,
    XpLedger,
)

USER_OWNED_MODELS = (
    AnalyticsEventDedupe,
    RefreshToken,
    UserIdentity,
    PushToken,
    NotificationReadState,
    NotificationDelivery,
    UserNotificationPreferences,
    UserEngagementProfile,
    LeaderboardSnapshot,
    ProductionSession,
    Streak,
    StreakBreakNotifyDedupe,
    UserGoal,
    UserAchievement,
    UserSubscription,
    UserProgression,
    XpLedger,
    GrowthEvent,
    WeeklyReviewSnapshot,
    PublicGoal,
    WeeklyCheckin,
    CheckinPlan,
    CheckinLog,
    SocialReaction,
    SocialChallengeMember,
    SocialCommitment,
    StreakReminderDispatchLog,
    ChallengeParticipant,
)


def delete_review_share_images(db: Session, user_id: int) -> None:
    """Remove weekly-review images before the account row is deleted."""
    urls = db.scalars(
        select(WeeklyReviewSnapshot.share_image_url).where(
            WeeklyReviewSnapshot.user_id == user_id,
            WeeklyReviewSnapshot.share_image_url.is_not(None),
        )
    ).all()
    for url in urls:
        delete_by_public_url(url, required=True)


def delete_user_account(db: Session, user: User) -> None:
    purge_user(db, user)
    db.commit()


def purge_user(db: Session, user: User) -> None:
    """Remove the user and everything tied to them; the caller owns the transaction."""
    _delete_anonymous_events_about(db, user)
    session_ids = list(
        db.scalars(select(ProductionSession.id).where(ProductionSession.user_id == user.id)).all()
    )
    if session_ids:
        db.execute(delete(SessionSkillFocus).where(SessionSkillFocus.session_id.in_(session_ids)))
        db.execute(delete(SessionAreaWeight).where(SessionAreaWeight.session_id.in_(session_ids)))
        db.execute(
            delete(SocialComment).where(
                SocialComment.target_type == "session",
                SocialComment.target_id.in_(session_ids),
            )
        )
        db.execute(
            delete(SocialReaction).where(
                SocialReaction.target_type == "session",
                SocialReaction.target_id.in_(session_ids),
            )
        )

    owned_challenge_ids = list(
        db.scalars(select(SocialChallenge.id).where(SocialChallenge.owner_id == user.id)).all()
    )
    if owned_challenge_ids:
        db.execute(
            delete(SocialChallengeMember).where(
                SocialChallengeMember.challenge_id.in_(owned_challenge_ids)
            )
        )
        db.execute(delete(SocialChallenge).where(SocialChallenge.id.in_(owned_challenge_ids)))

    for model in USER_OWNED_MODELS:
        db.execute(delete(model).where(model.user_id == user.id))

    db.execute(delete(Friendship).where(or_(Friendship.user_id == user.id, Friendship.friend_id == user.id)))
    db.execute(delete(SocialComment).where(SocialComment.author_id == user.id))
    db.execute(
        delete(BuddyRelationship).where(
            or_(BuddyRelationship.requester_id == user.id, BuddyRelationship.addressee_id == user.id)
        )
    )
    db.execute(
        delete(StreakRescue).where(
            or_(StreakRescue.rescued_user_id == user.id, StreakRescue.rescuer_user_id == user.id)
        )
    )
    db.execute(
        delete(FriendNudge).where(
            or_(FriendNudge.sender_user_id == user.id, FriendNudge.recipient_user_id == user.id)
        )
    )
    db.execute(
        delete(UserBlock).where(or_(UserBlock.blocker_id == user.id, UserBlock.blocked_id == user.id))
    )
    db.execute(
        delete(ContentReport).where(
            or_(ContentReport.reporter_id == user.id, ContentReport.reported_user_id == user.id)
        )
    )
    db.delete(user)
    db.flush()


def _delete_anonymous_events_about(db: Session, user: User) -> None:
    """Drop growth rows that lost their user id but still name this account."""
    email = (user.email or "").strip().lower()
    username = (user.username or "").strip()
    if not email and not username:
        return
    rows = db.scalars(select(GrowthEvent).where(GrowthEvent.user_id.is_(None))).all()
    for row in rows:
        if _props_name_user(row.event_props_json, email=email, username=username):
            db.delete(row)


def _props_name_user(raw: str, *, email: str, username: str) -> bool:
    try:
        props = json.loads(raw or "{}")
    except json.JSONDecodeError:
        text = raw or ""
        return bool(email and email in text.lower()) or bool(username and username in text)
    return _value_names_user(props, email=email, username=username)


def _value_names_user(value: object, *, email: str, username: str) -> bool:
    if isinstance(value, dict):
        return any(_value_names_user(item, email=email, username=username) for item in value.values())
    if isinstance(value, list):
        return any(_value_names_user(item, email=email, username=username) for item in value)
    if isinstance(value, str):
        if email and value.strip().lower() == email:
            return True
        if username and value.strip() == username:
            return True
    return False
