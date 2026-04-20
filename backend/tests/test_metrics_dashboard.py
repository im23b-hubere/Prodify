from app.database import SessionLocal
from app.config import settings
from app.models import GrowthEvent, PushToken, UserSubscription, utcnow


def _auth(client, email: str, username: str) -> dict[str, str]:
    r = client.post(
        "/auth/register",
        json={"email": email, "username": username, "password": "strong-pass-123"},
    )
    assert r.status_code == 201
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def test_kpi_dashboard_contract(client):
    headers = _auth(client, "metrics@example.com", "metrics-user")

    start = client.post("/sessions/start", headers=headers, json={"session_type": "beat_making"})
    assert start.status_code == 201
    stop = client.post("/sessions/stop", headers=headers, json={"session_id": start.json()["id"]})
    assert stop.status_code == 200

    me = client.get("/auth/me", headers=headers)
    assert me.status_code == 200
    user_id = me.json()["id"]
    settings.kpi_admin_user_ids = [user_id]

    with SessionLocal() as db:
        db.add(GrowthEvent(user_id=user_id, event_name="invite_sent", event_props_json="{}"))
        db.add(
            UserSubscription(
                user_id=user_id,
                provider="revenuecat",
                entitlement="premium",
                trial_active=1,
            )
        )
        db.add(
            PushToken(
                user_id=user_id,
                token="ExponentPushToken[metrics-active]",
                platform="ios",
                channel="expo",
                is_active=1,
                created_at=utcnow(),
                last_used_at=utcnow(),
            )
        )
        db.add(
            PushToken(
                user_id=user_id,
                token="ExponentPushToken[metrics-inactive]",
                platform="ios",
                channel="expo",
                is_active=0,
                created_at=utcnow(),
                last_used_at=utcnow(),
            )
        )
        db.commit()

    response = client.get("/stats/kpi/dashboard", headers=headers)
    assert response.status_code == 200
    body = response.json()
    assert body["window_days"] == 7
    assert body["users_total"] >= 1
    assert body["sessions_completed_7d"] >= 1
    assert body["active_users_7d"] >= 1
    assert body["growth_events_7d"] >= 1
    assert body["trial_active_total"] >= 1
    assert body["premium_total"] >= 1
    assert body["push_tokens_active"] >= 1
    assert body["push_tokens_inactive"] >= 1
    assert len(body["trend"]) == 7
    assert isinstance(body["totals"]["trial_to_paid_conversion_rate"], float)


def test_kpi_dashboard_forbidden_for_non_admin(client):
    headers = _auth(client, "metrics-forbidden@example.com", "metrics-forbidden-user")
    settings.kpi_admin_user_ids = []
    response = client.get("/stats/kpi/dashboard", headers=headers)
    assert response.status_code == 403
