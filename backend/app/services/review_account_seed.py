"""Seed the demo account Apple's reviewers sign in with.

Every run rebuilds the reviewer and the demo producers from scratch, so whatever the last
reviewer blocked, reported, accepted or deleted is gone. Demo producers live on the reserved
example.com domain and have no password: nobody can sign in as them or receive their mail.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from datetime import datetime, time, timedelta, timezone

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.models import (
    BuddyRelationship,
    BuddyStatus,
    Friendship,
    FriendshipStatus,
    ProductionSession,
    SocialChallenge,
    SocialChallengeMember,
    SocialComment,
    SocialReaction,
    Streak,
    User,
    UserGoal,
    UserIdentity,
    UserProgression,
    UserSubscription,
    utcnow,
)
from app.security import hash_password
from app.services.entitlements import EntitlementService
from app.services.object_storage import ObjectStorageError
from app.services.profile_picture_service import delete_profile_picture
from app.services.progression_service import XP_LEVEL_CATALOG_MAX, level_catalog
from app.services.screenshot_seed_service import SESSION_NOTES, SESSION_TAGS, TRACK_TITLES
from app.services.social_challenge_service import session_qualifies_for_challenge
from app.services.social_week_service import current_week_start
from app.services.streak_calendar import StreakCalendar, calendar_for
from app.services.user_deletion_service import delete_review_share_images, purge_user
from app.streakutil import dump_frozen_json

_log = logging.getLogger(__name__)

DEMO_EMAIL_DOMAIN = "example.com"
# Apple App Review sits in Cupertino; seeding in that zone keeps day boundaries where the
# reviewer sees them until the device reports its own timezone.
REVIEWER_TIMEZONE = "America/Los_Angeles"
# Review usually takes one or two days, a rejection and resubmission a few more.
FROZEN_REVIEW_DAYS = 4
PREMIUM_GRANT = timedelta(days=365)
SESSION_TYPES = ("beat_making", "mixing", "sound_design", "arrangement")
DUEL_STARTED_DAYS_AGO = 3
DUEL_DURATION_DAYS = 14
DUEL_TARGET_SESSIONS = 12
INVITE_DUEL_DURATION_DAYS = 7
INVITE_DUEL_TARGET_SESSIONS = 5


@dataclass(frozen=True)
class DemoProducer:
    username: str
    streak_days: int
    # Relative to the reviewer, so the rank path keeps friends around the reviewer's node.
    level_offset: int

    @property
    def email(self) -> str:
        return f"{self.username}@{DEMO_EMAIL_DOMAIN}"


BUDDY = DemoProducer("mila.waves", streak_days=18, level_offset=0)
DUEL_OPPONENT = DemoProducer("ravi.808", streak_days=22, level_offset=3)
DUEL_INVITER = DemoProducer("ines.synth", streak_days=31, level_offset=6)
COMMENTER = DemoProducer("juna.mixes", streak_days=11, level_offset=-2)
REVIEW_FRIENDS = (
    BUDDY,
    DemoProducer("theo.bounce", streak_days=14, level_offset=0),
    DUEL_OPPONENT,
    COMMENTER,
    DemoProducer("oskar.tape", streak_days=9, level_offset=-5),
    DUEL_INVITER,
)
FRIEND_REQUESTER = DemoProducer("kai.loops", streak_days=6, level_offset=-7)
OPEN_PROFILE = DemoProducer("noah.strings", streak_days=4, level_offset=-8)
DEMO_PRODUCERS = (*REVIEW_FRIENDS, FRIEND_REQUESTER, OPEN_PROFILE)

FRIEND_COMMENTS = (
    (COMMENTER, "That low end is finally sitting right. Send me the bounce!"),
    (BUDDY, "Locked in today. See you in the duel."),
)


@dataclass(frozen=True)
class ReviewAccountSpec:
    email: str
    username: str
    password: str
    streak_days: int = 64
    level: int = 12


@dataclass(frozen=True)
class ReviewSeedResult:
    reviewer_user_id: int
    reviewer_username: str
    streak_days: int
    level: int
    friend_usernames: tuple[str, ...]
    requester_username: str
    open_profile_username: str


class DemoAccountCollisionError(Exception):
    """A real account holds an address or username the seed would have to take over."""


def seed_review_account(db: Session, spec: ReviewAccountSpec) -> ReviewSeedResult:
    _remove_previous_seed(db, spec)
    now = utcnow()
    reviewer = _create_reviewer(db, spec, now)
    reviewer_sessions = _seed_daily_sessions(db, reviewer, spec.streak_days, now)
    producers = {producer: _create_demo_producer(db, producer, spec.level, now) for producer in DEMO_PRODUCERS}
    _connect_friends(db, reviewer, [producers[friend] for friend in REVIEW_FRIENDS])
    _send_friend_request(db, producers[FRIEND_REQUESTER], reviewer)
    _pair_buddies(db, reviewer, producers[BUDDY], now)
    _start_duel(db, reviewer, producers[DUEL_OPPONENT], now)
    _invite_to_duel(db, producers[DUEL_INVITER], reviewer, now)
    _react_to_session(db, reviewer_sessions[-1], producers, now)
    db.commit()
    return ReviewSeedResult(
        reviewer_user_id=reviewer.id,
        reviewer_username=reviewer.username,
        streak_days=spec.streak_days,
        level=spec.level,
        friend_usernames=tuple(friend.username for friend in REVIEW_FRIENDS),
        requester_username=FRIEND_REQUESTER.username,
        open_profile_username=OPEN_PROFILE.username,
    )


def _remove_previous_seed(db: Session, spec: ReviewAccountSpec) -> None:
    """Checks every account first, so a collision leaves the database untouched."""
    reviewer = _previous_reviewer(db, spec)
    producers = [_previous_demo_producer(db, producer) for producer in DEMO_PRODUCERS]
    if reviewer is not None:
        _delete_stored_media(db, reviewer)
        purge_user(db, reviewer)
    for producer in producers:
        if producer is not None:
            purge_user(db, producer)


def _previous_reviewer(db: Session, spec: ReviewAccountSpec) -> User | None:
    email = _normalize(spec.email)
    holders = _accounts_holding(db, email=email, username=_normalize(spec.username))
    if any(holder.email != email for holder in holders):
        raise DemoAccountCollisionError(f"@{spec.username} belongs to another account")
    reviewer = holders[0] if holders else None
    if reviewer is not None and _has_social_sign_in(db, reviewer):
        raise DemoAccountCollisionError(f"{spec.email} signs in with Apple or Google; pick a review-only address")
    return reviewer


def _previous_demo_producer(db: Session, producer: DemoProducer) -> User | None:
    holders = _accounts_holding(db, email=producer.email, username=producer.username)
    for holder in holders:
        if holder.email != producer.email or holder.hashed_password is not None or _has_social_sign_in(db, holder):
            raise DemoAccountCollisionError(f"@{producer.username} belongs to a real account")
    return holders[0] if holders else None


def _accounts_holding(db: Session, *, email: str, username: str) -> list[User]:
    return list(db.scalars(select(User).where(or_(User.email == email, User.username == username))).all())


def _has_social_sign_in(db: Session, user: User) -> bool:
    return db.scalar(select(UserIdentity.id).where(UserIdentity.user_id == user.id).limit(1)) is not None


def _delete_stored_media(db: Session, reviewer: User) -> None:
    """Media a reviewer uploaded is best effort: a storage hiccup must not block the seed."""
    try:
        delete_profile_picture(reviewer.profile_picture_url, required=True)
        delete_review_share_images(db, reviewer.id)
    except ObjectStorageError:
        _log.warning("review_seed_media_cleanup_failed user_id=%s", reviewer.id)


def _create_reviewer(db: Session, spec: ReviewAccountSpec, now: datetime) -> User:
    reviewer = _create_user(
        db,
        email=_normalize(spec.email),
        username=_normalize(spec.username),
        hashed_password=hash_password(spec.password),
    )
    reviewer.timezone = REVIEWER_TIMEZONE
    _grant_premium(db, reviewer, now)
    calendar = calendar_for(reviewer)
    _set_progression(db, reviewer.id, spec.level)
    _set_streak(db, reviewer, spec.streak_days, frozen_days=_upcoming_day_keys(calendar))
    db.add(UserGoal(user_id=reviewer.id, goal_type="weekly_sessions", target_value=7, week_start=calendar.week_start_key))
    return reviewer


def _create_demo_producer(db: Session, producer: DemoProducer, reviewer_level: int, now: datetime) -> User:
    user = _create_user(db, email=producer.email, username=producer.username, hashed_password=None)
    _seed_daily_sessions(db, user, producer.streak_days, now)
    _set_progression(db, user.id, _clamp_level(reviewer_level + producer.level_offset))
    _set_streak(db, user, producer.streak_days, frozen_days=[])
    return user


def _create_user(db: Session, *, email: str, username: str, hashed_password: str | None) -> User:
    user = User(email=email, username=username, hashed_password=hashed_password)
    db.add(user)
    db.flush()
    return user


def _grant_premium(db: Session, reviewer: User, now: datetime) -> None:
    reviewer.is_premium = 1
    reviewer.premium_until = now + PREMIUM_GRANT
    db.add(
        UserSubscription(
            user_id=reviewer.id,
            provider="seed",
            entitlement="premium",
            trial_active=False,
            expires_at=reviewer.premium_until,
            rc_app_user_id=str(reviewer.id),
        )
    )


def _set_progression(db: Session, user_id: int, level: int) -> None:
    """XP sits inside the level's band, so the app's progression sync keeps the level."""
    band = level_catalog(max_level=level)[level - 1]
    xp_total = int(band["xp_start"]) + int(band["xp_span"]) * 2 // 5
    db.add(
        UserProgression(
            user_id=user_id,
            current_level=level,
            xp_total=xp_total,
            xp_to_next_level=int(band["xp_end_exclusive"]) - xp_total,
        )
    )


def _set_streak(db: Session, user: User, streak_days: int, *, frozen_days: list[str]) -> None:
    calendar = calendar_for(user)
    db.add(
        Streak(
            user_id=user.id,
            current_streak=streak_days,
            longest_streak=streak_days,
            frozen_day_keys=dump_frozen_json(frozen_days),
            freezes_remaining=EntitlementService.get_streak_freeze_limit(user),
            billing_month=calendar.month_key,
        )
    )


def _upcoming_day_keys(calendar: StreakCalendar) -> list[str]:
    return [(calendar.today + timedelta(days=offset)).isoformat() for offset in range(1, FROZEN_REVIEW_DAYS + 1)]


def _seed_daily_sessions(db: Session, user: User, streak_days: int, now: datetime) -> list[ProductionSession]:
    """One session per local day, ending today, oldest first."""
    calendar = calendar_for(user)
    sessions = []
    for days_ago in range(streak_days - 1, -1, -1):
        session = _demo_session(user.id, calendar, days_ago, now)
        db.add(session)
        sessions.append(session)
    db.flush()
    return sessions


def _demo_session(user_id: int, calendar: StreakCalendar, days_ago: int, now: datetime) -> ProductionSession:
    minutes = 35 + (days_ago % 5) * 8
    day = calendar.today - timedelta(days=days_ago)
    started_at = _local_time_utc(day, time(hour=12), calendar)
    if days_ago == 0:
        day_start = _local_time_utc(day, time.min, calendar)
        started_at = max(day_start, min(started_at, now - timedelta(minutes=minutes)))
    stopped_at = min(started_at + timedelta(minutes=minutes), now)
    finished = days_ago % 3 == 0
    return ProductionSession(
        user_id=user_id,
        started_at=started_at,
        stopped_at=stopped_at,
        duration_seconds=int((stopped_at - started_at).total_seconds()),
        session_type=SESSION_TYPES[days_ago % len(SESSION_TYPES)],
        notes=SESSION_NOTES[days_ago % len(SESSION_NOTES)],
        mood_level=3 + days_ago % 3,
        tags=json.dumps(SESSION_TAGS[days_ago % len(SESSION_TAGS)]),
        paused_duration_seconds=0,
        focus_score=72 + days_ago % 23,
        track_outcome="finished" if finished else "wip",
        track_title=TRACK_TITLES[days_ago % len(TRACK_TITLES)] if finished else None,
    )


def _local_time_utc(day, clock: time, calendar: StreakCalendar) -> datetime:
    return datetime.combine(day, clock, tzinfo=calendar.zone).astimezone(timezone.utc)


def _connect_friends(db: Session, reviewer: User, friends: list[User]) -> None:
    for friend in friends:
        db.add(Friendship(user_id=reviewer.id, friend_id=friend.id, status=FriendshipStatus.accepted))


def _send_friend_request(db: Session, requester: User, reviewer: User) -> None:
    db.add(Friendship(user_id=requester.id, friend_id=reviewer.id, status=FriendshipStatus.pending))


def _pair_buddies(db: Session, reviewer: User, buddy: User, now: datetime) -> None:
    db.add(
        BuddyRelationship(
            requester_id=reviewer.id,
            addressee_id=buddy.id,
            status=BuddyStatus.active,
            activated_at=now - timedelta(days=10),
        )
    )


def _start_duel(db: Session, reviewer: User, opponent: User, now: datetime) -> None:
    started_at = now - timedelta(days=DUEL_STARTED_DAYS_AGO)
    duel = SocialChallenge(
        owner_id=reviewer.id,
        challenge_kind="duel",
        title="Two-week studio duel",
        week_start=current_week_start(),
        target_sessions=DUEL_TARGET_SESSIONS,
        status="active",
        meta_json=json.dumps(
            {
                "duration_days": DUEL_DURATION_DAYS,
                "credited_sessions": {},
                "invitee_user_id": opponent.id,
                "invited_at": (started_at - timedelta(hours=2)).isoformat(),
                "started_at": started_at.isoformat(),
            }
        ),
        created_at=started_at - timedelta(hours=2),
    )
    db.add(duel)
    db.flush()
    credited = {str(member.id): _qualifying_session_ids(db, member, duel) for member in (reviewer, opponent)}
    duel.meta_json = json.dumps({**json.loads(duel.meta_json), "credited_sessions": credited})
    for member in (reviewer, opponent):
        db.add(
            SocialChallengeMember(
                challenge_id=duel.id,
                user_id=member.id,
                progress_sessions=len(credited[str(member.id)]),
            )
        )


def _qualifying_session_ids(db: Session, user: User, duel: SocialChallenge) -> list[int]:
    meta = json.loads(duel.meta_json)
    sessions = db.scalars(select(ProductionSession).where(ProductionSession.user_id == user.id)).all()
    return [
        session.id
        for session in sessions
        if session_qualifies_for_challenge(
            stopped_at=session.stopped_at,
            duration_seconds=session.duration_seconds,
            challenge=duel,
            meta=meta,
        )
    ]


def _invite_to_duel(db: Session, inviter: User, reviewer: User, now: datetime) -> None:
    invite = SocialChallenge(
        owner_id=inviter.id,
        challenge_kind="duel",
        title="Weekend beat sprint",
        week_start=current_week_start(),
        target_sessions=INVITE_DUEL_TARGET_SESSIONS,
        status="pending",
        meta_json=json.dumps(
            {
                "duration_days": INVITE_DUEL_DURATION_DAYS,
                "credited_sessions": {},
                "invitee_user_id": reviewer.id,
                "invited_at": now.isoformat(),
            }
        ),
    )
    db.add(invite)
    db.flush()
    db.add(SocialChallengeMember(challenge_id=invite.id, user_id=inviter.id, progress_sessions=0))


def _react_to_session(
    db: Session,
    session: ProductionSession,
    producers: dict[DemoProducer, User],
    now: datetime,
) -> None:
    for minutes_ago, (author, body) in enumerate(FRIEND_COMMENTS, start=1):
        db.add(
            SocialComment(
                target_type="session",
                target_id=session.id,
                author_id=producers[author].id,
                body=body,
                created_at=now - timedelta(minutes=minutes_ago),
            )
        )
    for friend in REVIEW_FRIENDS[:3]:
        db.add(SocialReaction(target_type="session", target_id=session.id, user_id=producers[friend].id, emoji="🔥"))


def _clamp_level(level: int) -> int:
    return max(1, min(XP_LEVEL_CATALOG_MAX, level))


def _normalize(value: str) -> str:
    return value.strip().lower()
