"""Outcome events of social challenges, so callers decide how participants hear about them."""

from __future__ import annotations

from typing import Protocol


class ChallengeEvents(Protocol):
    def challenge_finished(self, challenge_id: int) -> None: ...

    def challenge_cancelled(self, challenge_id: int) -> None: ...


class IgnoredChallengeEvents:
    def challenge_finished(self, challenge_id: int) -> None:
        return None

    def challenge_cancelled(self, challenge_id: int) -> None:
        return None


IGNORED_CHALLENGE_EVENTS: ChallengeEvents = IgnoredChallengeEvents()
