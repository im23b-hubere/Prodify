def test_register_and_get_me(client):
    register = client.post(
        "/auth/register",
        json={"email": "user@example.com", "username": "producer", "password": "strong-pass-123"},
    )
    assert register.status_code == 201
    token = register.json()["access_token"]

    me = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    body = me.json()
    assert body["email"] == "user@example.com"
    assert body["username"] == "producer"


def test_register_rejects_duplicate_email(client):
    payload = {"email": "dup@example.com", "username": "name-a", "password": "strong-pass-123"}
    first = client.post("/auth/register", json=payload)
    assert first.status_code == 201

    second = client.post(
        "/auth/register",
        json={"email": "dup@example.com", "username": "name-b", "password": "strong-pass-123"},
    )
    assert second.status_code == 400
    assert second.json()["detail"] == "Email already registered"


def test_login_rejects_wrong_password(client):
    client.post(
        "/auth/register",
        json={"email": "login@example.com", "username": "login-user", "password": "strong-pass-123"},
    )

    login = client.post("/auth/login", json={"email": "login@example.com", "password": "wrong-pass"})
    assert login.status_code == 401
    assert login.json()["detail"] == "Incorrect email or password"
