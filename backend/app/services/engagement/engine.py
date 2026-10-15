"""
The one decision per producer and run: send the best candidate, or deliberately send nothing.

Every candidate keeps its score breakdown and the reason it did or did not win, so each
decision can be explained in logs and the debug view.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime

from sqlalchemy.orm import Session

from app.models import UserNotificationPreferences
from app.services.engagement.candidates import Candidate, CandidateType, generate_candidates
from app.services.engagement.context import EngagementContext, load_engagement_context
from app.services.engagement.deliveries import TRANSACTIONAL_TYPES
from app.services.engagement.limits import LimitReason, is_send_allowed
from app.services.engagement.preferences import load_preferences
from app.services.engagement.scoring import (
    DEFAULT_WEIGHTS,
    SEND_THRESHOLD,
    ScoreBreakdown,
    ScoringSignals,
    ScoringWeights,
    score,
)
from app.services.engagement.timing import (
    ProductionWindow,
    is_send_moment,
    next_send_time,
    production_window,
)
from app.timeutil import as_utc_aware

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class ScoredCandidate:
    candidate: Candidate
    breakdown: ScoreBreakdown
    limit: LimitReason
    waits_for_send_moment: bool

    @property
    def total(self) -> int:
        return self.breakdown.total

    @property
    def is_eligible(self) -> bool:
        return self.total >= SEND_THRESHOLD and self.limit == LimitReason.OK and not self.waits_for_send_moment

    @property
    def verdict(self) -> str:
        if self.total < SEND_THRESHOLD:
            return f"below the send threshold of {SEND_THRESHOLD}"
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
    window = production_window(context.profile)
    signals = _signals(context, window, now)
    at_send_moment = is_send_moment(window, now, context.zone)
    scored = sorted(
        (
            ScoredCandidate(
                candidate=candidate,
                breakdown=score(candidate, signals, now, weights),
                limit=is_send_allowed(
                    context.recent_deliveries, now, prefs, context.zone, category=candidate.category
                ).reason,
                waits_for_send_moment=not candidate.is_time_sensitive and not at_send_moment,
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
        scheduled_at=next_send_time(window, now, context.zone) if best.waits_for_send_moment else None,
    )


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
        if delivery.notification_type not in TRANSACTIONAL_TYPES
    ]
    return ScoringSignals(
        window=window,
        zone=context.zone,
        days_since_last_session=context.profile.days_since_last_session(now),
        last_smart_sent_at=max(smart_sent, default=None),
        motivation=context.motivation,
        fatigue_score=context.fatigue_score,
    )


def _chosen_reason(chosen: ScoredCandidate) -> str:
    return f"{chosen.candidate.type.value} scored {chosen.total} ({chosen.breakdown.priority.value}): {chosen.candidate.reason}"
