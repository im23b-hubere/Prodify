from app.database import SessionLocal
from app.models import User

DEFAULT_PASSWORD = "strong-pass-123"


def register_token(
    client,
    email: str,
    username: str,
    password: str = DEFAULT_PASSWORD,
    *,
    subscriber: bool = True,
) -> str:
    response = client.post(
        "/auth/register",
        json={"email": email, "username": username, "password": password},
    )
    assert response.status_code == 201, response.text
    token = response.json()["access_token"]
    if subscriber:
        grant_subscriber(client, token)
    return token


def auth_headers(
    client,
    email: str,
    username: str,
    password: str = DEFAULT_PASSWORD,
    *,
    subscriber: bool = True,
) -> dict[str, str]:
    token = register_token(client, email, username, password, subscriber=subscriber)
    return {"Authorization": f"Bearer {token}"}


def grant_subscriber(client, token: str) -> None:
    me = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    with SessionLocal() as db:
        user = db.get(User, me.json()["id"])
        assert user is not None
        user.is_premium = 1
        user.premium_until = None
        db.commit()
