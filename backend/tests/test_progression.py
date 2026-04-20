from datetime import timedelta

from app.database import SessionLocal
from app.models import UserProgression, XpLedger, utcnow


def _register_token(client, email: str, username: str) -> str:
    res = client.post(
        "/auth/register",
        json={"email": email, "username": username, "password": "strong-pass-123"},
    )
    assert res.status_code == 201
    return res.json()["access_token"]


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
