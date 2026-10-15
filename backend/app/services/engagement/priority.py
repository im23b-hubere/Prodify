"""What a candidate's total score means for sending it."""

from __future__ import annotations

from enum import StrEnum

SEND_THRESHOLD = 35
GOOD_THRESHOLD = 50
HIGH_THRESHOLD = 70


class Priority(StrEnum):
    DO_NOT_SEND = "do_not_send"
    LOW = "low"
    GOOD = "good"
    HIGH = "high"


def priority_of(total: int) -> Priority:
    if total >= HIGH_THRESHOLD:
        return Priority.HIGH
    if total >= GOOD_THRESHOLD:
        return Priority.GOOD
    if total >= SEND_THRESHOLD:
        return Priority.LOW
    return Priority.DO_NOT_SEND
