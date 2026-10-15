"""
The one decision per producer and run: send the best candidate, or deliberately send nothing.

Every candidate keeps its score breakdown and the reason it did or did not win, so each
decision can be explained in logs and the debug view.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, replace
from datetime import datetime

from sqlalchemy.orm import Session

from app.models import UserNotificationPreferences
from app.services.engagement.candidates import Candidate, CandidateType, generate_candidates
from app.services.engagement.context import EngagementContext, load_engagement_context
from app.services.engagement.deliveries import TRANSACTIONAL_TYPES
from app.services.engagement.limits import LimitReason, is_send_allowed
from app.services.engagement.preferences import load_preferences
from app.services.engagement.priority import SEND_THRESHOLD
from app.services.engagement.scoring import (
    DEFAULT_WEIGHTS,
    ScoreBreakdown,
    ScoringSignals,
    ScoringWeights,
    score,
)
from app.services.engagement.fatigue import fatigue_gate
from app.services.engagement.segments import SEGMENT_CATEGORY_MULTIPLIERS, Segment
from app.services.engagement.timing import (
    ProductionWindow,
    is_learned_send_moment,
    is_send_moment,
    next_learned_send_time,
    next_send_time,
    production_window,
    send_hour_for,
)
from app.timeutil import as_utc_aware, in_zone

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class ScoredCandidate:
    candidate: Candidate
    breakdown: ScoreBreakdown
    limit: LimitReason
    waits_for_send_moment: bool
    # Raised above the send threshold while the producer keeps ignoring pushes.
    min_score: int = SEND_THRESHOLD

    @property
    def total(self) -> int:
        return self.breakdown.total

    @property
    def is_eligible(self) -> bool:
        return self.total >= self.min_score and self.limit == LimitReason.OK and not self.waits_for_send_moment

    @property
    def verdict(self) -> str:
        if self.total < self.min_score:
            return f"below the send threshold of {self.min_score}"
        if self.limit != LimitReason.OK:
            return f"held back: {self.limit.value}"
        if self.waits_for_send_moment:
            return "waits for the producer's send moment"
        return "eligible"


@dataclass(frozen=True)
class EngagementDecision:
    should_send: bool
    reason: str
    candidates: tuple[ScoredCandidate, ...]
    chosen: ScoredCandidate | None = None
    scheduled_at: datetime | None = None

    @property
    def type(self) -> CandidateType | None:
        return self.chosen.candidate.type if self.chosen else None

    @property
    def score(self) -> int:
        return self.chosen.total if self.chosen else 0

    @property
    def variables(self) -> dict[str, str]:
        return self.chosen.candidate.variables if self.chosen else {}


def evaluate_notification_opportunity(
    db: Session, user_id: int, now: datetime, weights: ScoringWeights = DEFAULT_WEIGHTS
) -> EngagementDecision:
    context = load_engagement_context(db, user_id, now)
    return decide(context, load_preferences(db, user_id), now, weights)


def decide(
    context: EngagementContext,
    prefs: UserNotificationPreferences,
    now: datetime,
    weights: ScoringWeights = DEFAULT_WEIGHTS,
) -> EngagementDecision:
    weights = weights_for_segment(context.segment, weights)
    window = production_window(context.profile)
    signals = _signals(context, window, now)
    timing = _send_timing(context, window, now)
    fatigue = fatigue_gate(context.ignored_streak, signals.last_smart_sent_at)

    def limit_for(candidate: Candidate) -> LimitReason:
        if fatigue.is_paused(now):
            return LimitReason.FATIGUE_PAUSE
        return is_send_allowed(context.recent_deliveries, now, prefs, context.zone, category=candidate.category).reason

    scored = sorted(
        (
            ScoredCandidate(
                candidate=candidate,
                breakdown=score(candidate, signals, now, weights),
                limit=limit_for(candidate),
                waits_for_send_moment=not candidate.is_time_sensitive and not timing.is_now,
                min_score=fatigue.min_score,
            )
            for candidate in generate_candidates(context, now)
        ),
        key=lambda scored_candidate: -scored_candidate.total,
    )
    if not scored:
        return EngagementDecision(should_send=False, reason="no trigger applies", candidates=())
    chosen = next((scored_candidate for scored_candidate in scored if scored_candidate.is_eligible), None)
    if chosen is not None:
        return EngagementDecision(
            should_send=True,
            reason=_chosen_reason(chosen),
            candidates=tuple(scored),
            chosen=chosen,
            scheduled_at=now,
        )
    best = scored[0]
    return EngagementDecision(
        should_send=False,
        reason=f"best candidate {best.candidate.type.value} ({best.total}) {best.verdict}",
        candidates=tuple(scored),
        scheduled_at=timing.next_at if best.waits_for_send_moment else None,
    )


@dataclass(frozen=True)
class _SendTiming:
    is_now: bool
    next_at: datetime


def _send_timing(context: EngagementContext, window: ProductionWindow, now: datetime) -> _SendTiming:
    """A learned send hour replaces the slot before the production window once there is one."""
    zone = context.zone
    local = in_zone(now, zone)
    base = context.preferred_notification_slots.get(local.weekday(), context.preferred_notification_hour)
    if base is None:
        return _SendTiming(is_send_moment(window, now, zone), next_send_time(window, now, zone))
    hour = send_hour_for(base, context.user_id, local.date(), window)
    if hour != base:
        logger.info(
            "[EngagementEngine] user_id=%s exploring send hour %s instead of %s",
            context.user_id,
            hour,
            base,
        )
    return _SendTiming(is_learned_send_moment(hour, now, zone), next_learned_send_time(hour, now, zone))


def log_decision(user_id: int, decision: EngagementDecision) -> None:
    logger.info(
        "[EngagementEngine] user_id=%s action=%s reason=%r candidates=%s",
        user_id,
        "send" if decision.should_send else "skip",
        decision.reason,
        [
            {
                "type": scored.candidate.type.value,
                "total": scored.total,
                "parts": {name: value for name, value in scored.breakdown.parts.items() if value},
                "verdict": scored.verdict,
            }
            for scored in decision.candidates
        ],
    )


def _signals(context: EngagementContext, window: ProductionWindow, now: datetime) -> ScoringSignals:
    smart_sent = [
        as_utc_aware(delivery.sent_at)
        for delivery in context.recent_deliveries
        if delivery.notification_type not in TRANSACTIONAL_TYPES and getattr(delivery, "delivered_count", 1) > 0
    ]
    return ScoringSignals(
        window=window,
        zone=context.zone,
        days_since_last_session=context.profile.days_since_last_session(now),
        last_smart_sent_at=max(smart_sent, default=None),
        motivation=context.motivation,
        fatigue_score=context.fatigue_score,
        return_probability=context.return_probability,
    )


def weights_for_segment(segment: Segment | None, weights: ScoringWeights) -> ScoringWeights:
    adjustments = SEGMENT_CATEGORY_MULTIPLIERS.get(segment, {}) if segment else {}
    if not adjustments:
        return weights
    multipliers = dict(weights.category_multipliers)
    for category, factor in adjustments.items():
        multipliers[category] = multipliers.get(category, 1.0) * factor
    return replace(weights, category_multipliers=multipliers)


def _chosen_reason(chosen: ScoredCandidate) -> str:
    return f"{chosen.candidate.type.value} scored {chosen.total} ({chosen.breakdown.priority.value}): {chosen.candidate.reason}"
