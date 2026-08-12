import json
import logging
from dataclasses import dataclass
from datetime import datetime
from datetime import timedelta

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import AnalyticsEventDedupe, GrowthEvent, ProductionSession, PushToken, User, UserSubscription, utcnow
from app.contracts.outcomes import KpiDashboardPublic, KpiSummaryPublic, KpiTrendPointPublic

_log = logging.getLogger(__name__)


@dataclass(frozen=True)
class DashboardCounts:
    users_total: int
    users_new: int
    sessions_completed: int
    active_users: int
    growth_events: int
    active_trials: int
    premium_users: int
    active_push_tokens: int
    inactive_push_tokens: int


def track_event(db: Session, event_name: str, user_id: int | None = None, props: dict | None = None) -> None:
    row = GrowthEvent(
        user_id=user_id,
        event_name=event_name,
        event_props_json=json.dumps(props or {}),
    )
    db.add(row)


def track_event_deduped(
    db: Session,
    *,
    user_id: int,
    bucket_key: str,
    event_name: str,
    props: dict | None = None,
) -> bool:
    """
    Record a growth event at most once per (user_id, bucket_key) for this DB transaction chain.
    Returns True if a new row was recorded, False if this bucket was already claimed.
    """
    try:
        with db.begin_nested():
            db.add(
                AnalyticsEventDedupe(
                    user_id=user_id,
                    bucket_key=bucket_key[:192],
                    created_at=utcnow(),
                )
            )
            db.flush()
    except IntegrityError:
        _log.debug("analytics dedupe skip user_id=%s bucket=%s", user_id, bucket_key)
        return False
    track_event(db, event_name, user_id, props)
    return True


def _safe_div(n: float, d: float) -> float:
    return round(n / d, 4) if d > 0 else 0.0


def kpi_summary(db: Session) -> KpiSummaryPublic:
    users_total = _count(db, select(func.count()).select_from(User))
    seven_days_ago = utcnow() - timedelta(days=7)
    sessions_completed_last_7d = _completed_session_count(db, seven_days_ago)
    d7_active_users = _active_user_count(db, seven_days_ago)
    sessions_per_week_per_user = round(
        _safe_div(sessions_completed_last_7d, max(d7_active_users, 1)),
        3,
    )
    d1_users = _active_user_count(db, utcnow() - timedelta(days=1))
    trials = _subscription_count(db, UserSubscription.trial_active == 1)
    paid = _subscription_count(db, UserSubscription.entitlement == "premium")
    return KpiSummaryPublic(
        d1_retention_rate=_safe_div(d1_users, users_total),
        d7_retention_rate=_safe_div(d7_active_users, users_total),
        sessions_per_week_per_user=sessions_per_week_per_user,
        trial_start_rate=_safe_div(trials, users_total),
        trial_to_paid_conversion_rate=_safe_div(paid, max(trials, 1)),
        invites_sent=_growth_event_count(db, "invite_sent"),
        challenge_participation=_growth_event_count(db, "challenge_joined"),
    )


def kpi_dashboard(db: Session, window_days: int = 7) -> KpiDashboardPublic:
    now = utcnow()
    since = now - timedelta(days=window_days)
    counts = _dashboard_counts(db, since)
    return KpiDashboardPublic(
        generated_at=now,
        window_days=window_days,
        totals=kpi_summary(db),
        users_total=counts.users_total,
        users_new_7d=counts.users_new,
        sessions_completed_7d=counts.sessions_completed,
        active_users_7d=counts.active_users,
        growth_events_7d=counts.growth_events,
        trial_active_total=counts.active_trials,
        premium_total=counts.premium_users,
        push_tokens_active=counts.active_push_tokens,
        push_tokens_inactive=counts.inactive_push_tokens,
        trend=_dashboard_trend(db, since, window_days),
    )


def _dashboard_counts(db: Session, since: datetime) -> DashboardCounts:
    return DashboardCounts(
        users_total=_count(db, select(func.count()).select_from(User)),
        users_new=_count(db, select(func.count()).select_from(User).where(User.created_at >= since)),
        sessions_completed=_completed_session_count(db, since),
        active_users=_active_user_count(db, since),
        growth_events=_count(db, select(func.count()).select_from(GrowthEvent).where(GrowthEvent.created_at >= since)),
        active_trials=_subscription_count(db, UserSubscription.trial_active == 1),
        premium_users=_subscription_count(db, UserSubscription.entitlement == "premium"),
        active_push_tokens=_push_token_count(db, active=True),
        inactive_push_tokens=_push_token_count(db, active=False),
    )


def _dashboard_trend(db: Session, since: datetime, window_days: int) -> list[KpiTrendPointPublic]:
    trend: list[KpiTrendPointPublic] = []
    for offset in range(window_days):
        day_start = (since + timedelta(days=offset)).replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(days=1)
        trend.append(
            KpiTrendPointPublic(
                date=day_start.date().isoformat(),
                sessions_completed=_completed_session_count(db, day_start, day_end),
                active_users=_active_user_count(db, day_start, day_end),
                growth_events=_growth_event_count_between(db, day_start, day_end),
            )
        )
    return trend


def _completed_session_count(db: Session, since: datetime, until: datetime | None = None) -> int:
    query = select(func.count()).select_from(ProductionSession).where(
        ProductionSession.duration_seconds.is_not(None),
        ProductionSession.started_at >= since,
    )
    if until is not None:
        query = query.where(ProductionSession.started_at < until)
    return _count(db, query)


def _active_user_count(db: Session, since: datetime, until: datetime | None = None) -> int:
    query = select(func.count(func.distinct(ProductionSession.user_id))).where(
        ProductionSession.duration_seconds.is_not(None),
        ProductionSession.started_at >= since,
    )
    if until is not None:
        query = query.where(ProductionSession.started_at < until)
    return _count(db, query)


def _growth_event_count(db: Session, event_name: str) -> int:
    return _count(
        db,
        select(func.count()).select_from(GrowthEvent).where(GrowthEvent.event_name == event_name),
    )


def _growth_event_count_between(db: Session, since: datetime, until: datetime) -> int:
    return _count(
        db,
        select(func.count()).select_from(GrowthEvent).where(
            GrowthEvent.created_at >= since,
            GrowthEvent.created_at < until,
        ),
    )


def _subscription_count(db: Session, condition) -> int:
    return _count(db, select(func.count()).select_from(UserSubscription).where(condition))


def _push_token_count(db: Session, *, active: bool) -> int:
    return _count(
        db,
        select(func.count()).select_from(PushToken).where(PushToken.is_active == int(active)),
    )


def _count(db: Session, query) -> int:
    return int(db.scalar(query) or 0)
