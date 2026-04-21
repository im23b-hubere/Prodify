"""Streak entitlement behavior (freeze limits)."""

from sqlalchemy import select

from app.database import SessionLocal
from app.models import Streak, User


def _token(client, email: str, user: str) -> str:
    r = client.post(
        "/auth/register",
        json={"email": email, "username": user, "password": "strong-pass-123"},
    )
    assert r.status_code == 201
    return r.json()["access_token"]


def test_premium_user_gets_high_freeze_allowance_on_month_reset(client):
    token = _token(client, "freeze-prem@example.com", "freeze-prem-user")
    me = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    uid = me.json()["id"]

    with SessionLocal() as db:
        u = db.get(User, uid)
        assert u is not None
        u.is_premium = 1
        u.premium_until = None
        st = db.scalar(select(Streak).where(Streak.user_id == uid))
        assert st is not None
        st.billing_month = "1999-01"
        st.freezes_remaining = 0
        db.commit()

    client.post("/streak/reconcile", headers={"Authorization": f"Bearer {token}"})

    with SessionLocal() as db:
        st2 = db.scalar(select(Streak).where(Streak.user_id == uid))
        assert st2 is not None
        assert int(st2.freezes_remaining or 0) >= 2
