from datetime import timedelta

from app.security import create_access_token


def _auth_headers(client, email: str, username: str, password: str = "strong-pass-123") -> dict[str, str]:
    register = client.post(
        "/auth/register",
        json={"email": email, "username": username, "password": password},
    )
    assert register.status_code == 201
    token = register.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_session_start_while_active(client):
    headers = _auth_headers(client, "edge-active@example.com", "edge-active-user")

    first_start = client.post(
        "/sessions/start",
        json={"session_type": "beat_making"},
        headers=headers,
    )
    assert first_start.status_code == 201

    second_start = client.post(
        "/sessions/start",
        json={"session_type": "mixing"},
        headers=headers,
    )
    assert second_start.status_code == 409
    detail = second_start.json().get("detail", {})
    assert "already exists" in str(detail).lower()


def test_session_stop_with_invalid_id(client):
    headers = _auth_headers(client, "edge-stop@example.com", "edge-stop-user")

    response = client.post(
        "/sessions/stop",
        headers=headers,
        json={"session_id": 999999},
    )
    assert response.status_code == 404


def test_session_with_expired_token(client):
    headers = _auth_headers(client, "edge-expired@example.com", "edge-expired-user")
    me = client.get("/auth/me", headers=headers)
    assert me.status_code == 200
    user_id = str(me.json()["id"])

    expired_token = create_access_token(user_id, expires_delta=timedelta(seconds=-5))
    response = client.post(
        "/sessions/start",
        json={"session_type": "beat_making"},
        headers={"Authorization": f"Bearer {expired_token}"},
    )
    assert response.status_code == 401
