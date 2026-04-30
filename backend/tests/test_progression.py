from datetime import timedelta

import pytest
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from app.database import SessionLocal
from app.models import UserProgression, XpLedger, utcnow
from app.services.progression_service import grant_xp, xp_for_completed_session


def _register_token(client, email: str, username: str) -> str:
    res = client.post(
        "/auth/register",
        json={"email": email, "username": username, "password": "strong-pass-123"},
    )
    assert res.status_code == 201
    return res.json()["access_token"]


def test_grant_xp_idempotent_session_complete_source(client):
    token = _register_token(client, "xp-idem@example.com", "xp-idem")
    me = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    user_id = me.json()["id"]

    with SessionLocal() as db:
        grant_xp(db, user_id, 10, "session_complete", source_id="42", meta={})
        grant_xp(db, user_id, 10, "session_complete", source_id="42", meta={})
        db.commit()
        n = int(
            db.scalar(
                select(func.count()).select_from(XpLedger).where(
                    XpLedger.user_id == user_id,
                    XpLedger.source_type == "session_complete",
                    XpLedger.source_id == "42",
                )
            )
            or 0
        )
        assert n == 1
        row = db.scalar(select(UserProgression).where(UserProgression.user_id == user_id))
        assert int(row.xp_total or 0) == 10


def test_progression_me_applies_inactivity_decay_once(client):
    token = _register_token(client, "progression-decay@example.com", "progression-decay")
    me = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    user_id = me.json()["id"]

    with SessionLocal() as db:
        row = UserProgression(
            user_id=user_id,
            xp_total=250,
            current_level=3,
            xp_to_next_level=200,
            updated_at=utcnow(),
        )
        db.add(row)
        db.flush()
        db.add(
            XpLedger(
                user_id=user_id,
                source_type="session_stop",
                source_id="seed",
                xp_delta=80,
                meta_json="{}",
                created_at=utcnow() - timedelta(days=5),
            )
        )
        db.commit()

    first = client.post("/progression/sync", headers={"Authorization": f"Bearer {token}"})
    assert first.status_code == 200
    body = first.json()
    # 5 inactive days with 2 grace days => 3 * 12 XP decay = 36.
    assert body["xp_total"] == 214
    assert body["decay_grace_days"] == 2
    assert body["decay_xp_per_day"] == 12

    second = client.post("/progression/sync", headers={"Authorization": f"Bearer {token}"})
    assert second.status_code == 200
    assert second.json()["xp_total"] == 214


def test_progression_levels_catalog(client):
    token = _register_token(client, "progression-levels@example.com", "progression-levels")
    res = client.get("/progression/levels", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    levels = res.json()
    assert len(levels) >= 10
    assert levels[0]["level"] == 1
    assert levels[0]["xp_start"] == 0
    assert levels[0]["xp_end_exclusive"] > levels[0]["xp_start"]

    deep = client.get("/progression/levels?max_level=25", headers={"Authorization": f"Bearer {token}"})
    assert deep.status_code == 200
    deep_levels = deep.json()
    assert len(deep_levels) == 25
    assert deep_levels[-1]["level"] == 25


def test_xp_for_completed_session_respects_floor_and_rewards_duration():
    assert xp_for_completed_session(4 * 60) == 0
    assert xp_for_completed_session(5 * 60) > 0

    xp_10 = xp_for_completed_session(10 * 60)
    xp_25 = xp_for_completed_session(25 * 60)
    xp_45 = xp_for_completed_session(45 * 60)
    xp_75 = xp_for_completed_session(75 * 60)

    assert xp_25 > xp_10
    assert xp_45 > xp_25
    assert xp_75 > xp_45


def test_xp_for_completed_session_not_too_fast_for_short_medium_sessions():
    # Guardrails against very fast leveling from only a couple of normal sessions.
    assert xp_for_completed_session(30 * 60) <= 20
    assert xp_for_completed_session(60 * 60) <= 40


def test_xp_ledger_unique_index_blocks_duplicate_idempotent_source(client):
    token = _register_token(client, "xp-unique@example.com", "xp-unique")
    me = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    user_id = me.json()["id"]

    with SessionLocal() as db:
        db.add(
            XpLedger(
                user_id=user_id,
                source_type="session_complete",
                source_id="same-source",
                xp_delta=10,
                meta_json="{}",
            )
        )
        db.commit()
        with pytest.raises(IntegrityError):
            db.add(
                XpLedger(
                    user_id=user_id,
                    source_type="session_complete",
                    source_id="same-source",
                    xp_delta=10,
                    meta_json="{}",
                )
            )
            db.commit()
        db.rollback()


def test_xp_ledger_unique_index_allows_multiple_inactivity_decay_entries(client):
    token = _register_token(client, "xp-decay-dup@example.com", "xp-decay-dup")
    me = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    user_id = me.json()["id"]

    with SessionLocal() as db:
        db.add(
            XpLedger(
                user_id=user_id,
                source_type="inactivity_decay",
                source_id="since:2026-01-01",
                xp_delta=-12,
                meta_json="{}",
            )
        )
        db.add(
            XpLedger(
                user_id=user_id,
                source_type="inactivity_decay",
                source_id="since:2026-01-01",
                xp_delta=-24,
                meta_json="{}",
            )
        )
        db.commit()

        count = int(
            db.scalar(
                select(func.count()).select_from(XpLedger).where(
                    XpLedger.user_id == user_id,
                    XpLedger.source_type == "inactivity_decay",
                    XpLedger.source_id == "since:2026-01-01",
                )
            )
            or 0
        )
        assert count == 2
