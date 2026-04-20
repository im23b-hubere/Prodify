import json
from datetime import timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import GrowthEvent, ProductionSession, PushToken, User, UserSubscription, utcnow
from app.schemas import KpiDashboardPublic, KpiSummaryPublic, KpiTrendPointPublic


def track_event(db: Session, event_name: str, user_id: int | None = None, props: dict | None = None) -> None:
    row = GrowthEvent(
        user_id=user_id,
        event_name=event_name,
        event_props_json=json.dumps(props or {}),
    )
    db.add(row)


def _safe_div(n: float, d: float) -> float:
    return round(n / d, 4) if d > 0 else 0.0


def kpi_summary(db: Session) -> KpiSummaryPublic:
    users_total = int(db.scalar(select(func.count()).select_from(User)) or 0)
    sessions_per_week = float(
        db.scalar(
            select(func.count()).select_from(ProductionSession).where(ProductionSession.duration_seconds.is_not(None))
        )
        or 0
    )
    sessions_per_week_per_user = round(_safe_div(sessions_per_week, max(users_total, 1)), 3)

    d1_cut = utcnow() - timedelta(days=1)
    d7_cut = utcnow() - timedelta(days=7)
    d1_users = int(
        db.scalar(
            select(func.count(func.distinct(ProductionSession.user_id)))
            .where(ProductionSession.duration_seconds.is_not(None), ProductionSession.started_at >= d1_cut)
        )
        or 0
    )
    d7_users = int(
        db.scalar(
            select(func.count(func.distinct(ProductionSession.user_id)))
            .where(ProductionSession.duration_seconds.is_not(None), ProductionSession.started_at >= d7_cut)
        )
        or 0
    )
    trials = int(
        db.scalar(select(func.count()).select_from(UserSubscription).where(UserSubscription.trial_active == 1)) or 0
    )
    paid = int(
        db.scalar(select(func.count()).select_from(UserSubscription).where(UserSubscription.entitlement == "premium"))
        or 0
    )
    invites_sent = int(db.scalar(select(func.count()).select_from(GrowthEvent).where(GrowthEvent.event_name == "invite_sent")) or 0)
    challenge_participation = int(
        db.scalar(
            select(func.count()).select_from(GrowthEvent).where(GrowthEvent.event_name == "challenge_joined")
        )
        or 0
    )
    return KpiSummaryPublic(
        d1_retention_rate=_safe_div(d1_users, users_total),
        d7_retention_rate=_safe_div(d7_users, users_total),
        sessions_per_week_per_user=sessions_per_week_per_user,
        trial_start_rate=_safe_div(trials, users_total),
        trial_to_paid_conversion_rate=_safe_div(paid, max(trials, 1)),
        invites_sent=invites_sent,
        challenge_participation=challenge_participation,
    )


def kpi_dashboard(db: Session, window_days: int = 7) -> KpiDashboardPublic:
    now = utcnow()
    since = now - timedelta(days=window_days)
    totals = kpi_summary(db)

    users_total = int(db.scalar(select(func.count()).select_from(User)) or 0)
    users_new_7d = int(db.scalar(select(func.count()).select_from(User).where(User.created_at >= since)) or 0)

    sessions_completed_7d = int(
        db.scalar(
            select(func.count())
            .select_from(ProductionSession)
            .where(ProductionSession.duration_seconds.is_not(None), ProductionSession.started_at >= since)
        )
        or 0
    )
    active_users_7d = int(
        db.scalar(
            select(func.count(func.distinct(ProductionSession.user_id))).where(
                ProductionSession.duration_seconds.is_not(None),
                ProductionSession.started_at >= since,
            )
        )
        or 0
    )
    growth_events_7d = int(
        db.scalar(select(func.count()).select_from(GrowthEvent).where(GrowthEvent.created_at >= since)) or 0
    )
    trial_active_total = int(
        db.scalar(select(func.count()).select_from(UserSubscription).where(UserSubscription.trial_active == 1)) or 0
    )
    premium_total = int(
        db.scalar(select(func.count()).select_from(UserSubscription).where(UserSubscription.entitlement == "premium")) or 0
    )
    push_tokens_active = int(
        db.scalar(select(func.count()).select_from(PushToken).where(PushToken.is_active == 1)) or 0
    )
    push_tokens_inactive = int(
        db.scalar(select(func.count()).select_from(PushToken).where(PushToken.is_active == 0)) or 0
    )

    trend: list[KpiTrendPointPublic] = []
    for i in range(window_days):
        day_start = (since + timedelta(days=i)).replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(days=1)
        day_key = day_start.date().isoformat()
        day_sessions = int(
            db.scalar(
                select(func.count())
                .select_from(ProductionSession)
                .where(
                    ProductionSession.duration_seconds.is_not(None),
                    ProductionSession.started_at >= day_start,
                    ProductionSession.started_at < day_end,
                )
            )
            or 0
        )
        day_active_users = int(
            db.scalar(
                select(func.count(func.distinct(ProductionSession.user_id))).where(
                    ProductionSession.duration_seconds.is_not(None),
                    ProductionSession.started_at >= day_start,
                    ProductionSession.started_at < day_end,
                )
            )
            or 0
        )
        day_growth_events = int(
            db.scalar(
                select(func.count())
                .select_from(GrowthEvent)
                .where(GrowthEvent.created_at >= day_start, GrowthEvent.created_at < day_end)
            )
            or 0
        )
        trend.append(
            KpiTrendPointPublic(
                date=day_key,
                sessions_completed=day_sessions,
                active_users=day_active_users,
                growth_events=day_growth_events,
            )
        )

    return KpiDashboardPublic(
        generated_at=now,
        window_days=window_days,
        totals=totals,
        users_total=users_total,
        users_new_7d=users_new_7d,
        sessions_completed_7d=sessions_completed_7d,
        active_users_7d=active_users_7d,
        growth_events_7d=growth_events_7d,
        trial_active_total=trial_active_total,
        premium_total=premium_total,
        push_tokens_active=push_tokens_active,
        push_tokens_inactive=push_tokens_inactive,
        trend=trend,
    )
