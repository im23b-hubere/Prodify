"""Delete a user and all data owned by or connected to that user."""

from sqlalchemy import delete, or_, select
from sqlalchemy.orm import Session

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


def delete_user_account(db: Session, user: User) -> None:
    session_ids = list(
        db.scalars(select(ProductionSession.id).where(ProductionSession.user_id == user.id)).all()
    )
    if session_ids:
        db.execute(delete(SessionSkillFocus).where(SessionSkillFocus.session_id.in_(session_ids)))
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
    db.commit()
