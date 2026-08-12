from app.contracts.billing import BillingSyncBody as BillingSyncContract
from app.contracts.billing import EntitlementPublic as EntitlementContract
from app.schemas import BillingSyncBody, EntitlementPublic


def test_legacy_schema_exports_reference_billing_contracts():
    assert BillingSyncBody is BillingSyncContract
    assert EntitlementPublic is EntitlementContract


def test_billing_contract_normalizes_revenuecat_user_id():
    body = BillingSyncContract(app_user_id=" 42 ")

    assert body.app_user_id == "42"
