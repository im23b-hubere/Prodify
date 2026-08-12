from app.contracts.sessions import SessionStart as SessionStartContract
from app.contracts.sessions import SessionUpdate as SessionUpdateContract
from app.schemas import SessionStart, SessionUpdate


def test_legacy_schema_exports_reference_session_contracts():
    assert SessionStart is SessionStartContract
    assert SessionUpdate is SessionUpdateContract


def test_session_contracts_share_text_and_tag_normalization():
    start = SessionStartContract(
        session_type="mixing",
        notes="  shape   the chorus ",
        tags=[" mix ", "", "focus"],
    )
    update = SessionUpdateContract(
        notes="  shape   the chorus ",
        track_title="  First   Draft ",
        tags=[" mix ", "", "focus"],
    )

    assert start.notes == update.notes == "shape the chorus"
    assert start.tags == update.tags == ["mix", "focus"]
    assert update.track_title == "First Draft"
