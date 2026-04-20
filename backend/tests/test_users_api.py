from tests.test_friends import _register
from app.database import SessionLocal
from app.models import GrowthEvent, PushToken, User, UserGoal, utcnow


def test_upload_profile_picture_updates_me(client):
    token = _register(client, "pic-me@example.com", "picuser")
    uploaded = client.post(
        "/users/me/profile-picture",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("avatar.png", b"\x89PNG\r\n\x1a\nfakepngcontent", "image/png")},
    )
    assert uploaded.status_code == 200
    body = uploaded.json()
    assert body["profile_picture_url"]
    assert "/uploads/profile_pictures/" in body["profile_picture_url"]

    me = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json()["profile_picture_url"]


def test_upload_profile_picture_rejects_non_image_content(client):
    token = _register(client, "pic-bad@example.com", "picbad")
    uploaded = client.post(
        "/users/me/profile-picture",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("avatar.png", b"not-an-image", "image/png")},
    )
    assert uploaded.status_code == 400
    assert uploaded.json()["error"]["message"] == "Unsupported image format"


def test_upload_profile_picture_rejects_oversize_image(client):
    token = _register(client, "pic-big@example.com", "picbig")
    oversized_png = b"\x89PNG\r\n\x1a\n" + (b"x" * (5 * 1024 * 1024 + 1))
    uploaded = client.post(
        "/users/me/profile-picture",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("big.png", oversized_png, "image/png")},
    )
    assert uploaded.status_code == 413
    assert uploaded.json()["error"]["message"] == "Image exceeds 5MB limit"


def test_delete_me_removes_account(client):
    token = _register(client, "delete-me@example.com", "deleteme")
    me = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200

    deleted = client.delete("/users/me", headers={"Authorization": f"Bearer {token}"})
    assert deleted.status_code == 204

    stale = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert stale.status_code == 401

    relogin = client.post(
        "/auth/login",
        json={"email": "delete-me@example.com", "password": "strong-pass-123"},
    )
    assert relogin.status_code == 401


def test_delete_me_purges_related_rows_and_profile_picture_file(client):
    token = _register(client, "delete-deep@example.com", "deepdelete")
    me = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    user_id = me.json()["id"]

    uploaded = client.post(
        "/users/me/profile-picture",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("avatar.png", b"\x89PNG\r\n\x1a\nfakepngcontent", "image/png")},
    )
    assert uploaded.status_code == 200
    profile_url = uploaded.json()["profile_picture_url"]
    assert "/uploads/profile_pictures/" in profile_url
    file_name = profile_url.split("/uploads/profile_pictures/", 1)[1]

    with SessionLocal() as db:
        db.add(UserGoal(user_id=user_id, goal_type="weekly_sessions", target_value=4, week_start="2026-04-20"))
        db.add(
            PushToken(
                user_id=user_id,
                token="ExponentPushToken[delete-check]",
                platform="ios",
                channel="expo",
                is_active=1,
                created_at=utcnow(),
                last_used_at=utcnow(),
            )
        )
        db.add(GrowthEvent(user_id=user_id, event_name="invite_sent", event_props_json="{}"))
        db.commit()

    deleted = client.delete("/users/me", headers={"Authorization": f"Bearer {token}"})
    assert deleted.status_code == 204

    with SessionLocal() as db:
        assert db.query(User).filter(User.id == user_id).first() is None
        assert db.query(UserGoal).filter(UserGoal.user_id == user_id).first() is None
        assert db.query(PushToken).filter(PushToken.user_id == user_id).first() is None
        assert db.query(GrowthEvent).filter(GrowthEvent.user_id == user_id).first() is None

    from app.routers.users import PROFILE_UPLOAD_DIR

    assert not (PROFILE_UPLOAD_DIR / file_name).exists()


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
