from app.contracts.notifications import PushTokenRegister as PushTokenContract
from app.schemas import PushTokenRegister


def test_legacy_schema_exports_reference_notification_contracts():
    assert PushTokenRegister is PushTokenContract


def test_push_contract_normalizes_provider_values():
    body = PushTokenContract(token="  ExponentPushToken[value] ", platform=" IOS ")

    assert body.token == "ExponentPushToken[value]"
    assert body.platform == "ios"


def test_push_contract_falls_back_for_unknown_platform():
    body = PushTokenContract(token="valid-token", platform="desktop")

    assert body.platform == "unknown"
