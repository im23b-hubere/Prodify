from datetime import datetime, timezone

import pytest

from app.services.subscription_service import _webhook_entitlement, _webhook_expiration


@pytest.mark.parametrize(
    ("event", "expected"),
    [
        ({"type": "INITIAL_PURCHASE"}, "premium"),
        ({"type": "RENEWAL"}, "premium"),
        ({"type": "CANCELLATION", "is_active": True}, "free"),
        ({"type": "EXPIRATION"}, "free"),
        ({"type": "INITIAL_PURCHASE", "is_trial_period": True}, "free"),
        ({"type": "UNKNOWN", "is_active": False}, "free"),
    ],
)
def test_webhook_entitlement_is_fail_closed(event, expected):
    assert _webhook_entitlement(event) == expected


def test_webhook_expiration_parses_iso_and_epoch_milliseconds():
    iso = _webhook_expiration({"expires_at": "2026-08-10T12:30:00Z"})
    epoch = _webhook_expiration({"expiration_at_ms": 1786365000000})

    assert iso == datetime(2026, 8, 10, 12, 30, tzinfo=timezone.utc)
    assert epoch == datetime.fromtimestamp(1786365000, tz=timezone.utc)


@pytest.mark.parametrize("value", ["not-a-date", 10**30, None])
def test_webhook_expiration_rejects_invalid_values(value):
    assert _webhook_expiration({"expires_at": value}) is None
