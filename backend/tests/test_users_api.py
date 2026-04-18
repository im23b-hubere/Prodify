from tests.test_friends import _register


def test_friend_status_and_user_profile(client):
    t_a = _register(client, "g1@example.com", "galuser")
    t_b = _register(client, "g2@example.com", "haluser")

    ra = client.get("/auth/me", headers={"Authorization": f"Bearer {t_a}"})
    rb = client.get("/auth/me", headers={"Authorization": f"Bearer {t_b}"})
    assert ra.status_code == 200
    assert rb.status_code == 200
    id_a = ra.json()["id"]
    id_b = rb.json()["id"]

    st = client.get(f"/friends/status/{id_b}", headers={"Authorization": f"Bearer {t_a}"})
    assert st.status_code == 200
    assert st.json()["status"] == "none"

    req = client.post(
        "/friends/request",
        headers={"Authorization": f"Bearer {t_a}"},
        json={"username": "haluser"},
    )
    assert req.status_code == 201
    fid = req.json()["id"]

    st2 = client.get(f"/friends/status/{id_b}", headers={"Authorization": f"Bearer {t_a}"})
    assert st2.json()["status"] == "pending"

    acc = client.post(f"/friends/{fid}/accept", headers={"Authorization": f"Bearer {t_b}"})
    assert acc.status_code == 200

    st3 = client.get(f"/friends/status/{id_b}", headers={"Authorization": f"Bearer {t_a}"})
    assert st3.json()["status"] == "accepted"

    prof = client.get(f"/users/{id_a}/profile", headers={"Authorization": f"Bearer {t_b}"})
    assert prof.status_code == 200
    body = prof.json()
    assert body["username"] == "galuser"
    assert "total_sessions" in body

    t_c = _register(client, "g3@example.com", "patuser")
    rc = client.get("/auth/me", headers={"Authorization": f"Bearer {t_c}"})
    id_c = rc.json()["id"]
    denied = client.get(f"/users/{id_c}/profile", headers={"Authorization": f"Bearer {t_a}"})
    assert denied.status_code == 403

    stranger = client.get("/users/99999/profile", headers={"Authorization": f"Bearer {t_a}"})
    assert stranger.status_code == 404
