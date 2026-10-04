"""Push delivery for challenge outcome events."""

from __future__ import annotations

import logging

from sqlalchemy.orm import Session

from app.config import Settings
from app.services.push_dispatch import schedule_push_to_user
from app.services.push_links import push_data_challenge_update
from app.services.social_challenge_messages import challenge_messages

logger = logging.getLogger(__name__)


class PushChallengeEvents:
    """Sends every affected participant a push once a challenge finishes or is cancelled."""

    def __init__(self, db: Session, settings: Settings) -> None:
        self._db = db
        self._settings = settings

    def challenge_finished(self, challenge_id: int) -> None:
        self._notify(challenge_id, label="challenge-finished")

    def challenge_cancelled(self, challenge_id: int) -> None:
        self._notify(challenge_id, label="challenge-cancelled")

    def _notify(self, challenge_id: int, *, label: str) -> None:
        for recipient_id, message in challenge_messages(self._db, challenge_id):
            data = push_data_challenge_update(challenge_id, path=message.route, kind=message.kind)
            try:
                schedule_push_to_user(
                    self._settings, recipient_id, message.title, message.body, data, label=label
                )
            except Exception:
                logger.exception("schedule %s push failed challenge_id=%s", label, challenge_id)
