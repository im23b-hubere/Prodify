from app.contracts.auth import TokenPair as TokenPairContract
from app.contracts.auth import UserCreate as UserCreateContract
from app.schemas import TokenPair, UserCreate


def test_legacy_schema_exports_reference_auth_contracts():
    assert TokenPair is TokenPairContract
    assert UserCreate is UserCreateContract


def test_auth_contract_normalizes_identity_fields():
    body = UserCreateContract(
        email="  USER@Example.com ",
        username="  Producer ",
        password="strong-pass-123",
    )

    assert body.email == "user@example.com"
    assert body.username == "producer"
