import pytest

from app.config import settings
from app.database import SessionLocal
from app.models import User
from app.services import content_report_service, moderation_service
from tests.auth_helpers import DEFAULT_PASSWORD, auth_headers
from tests.test_social import _complete_long_session, _make_friends
from tests.test_social_auth import FAKE_TOKEN, apple_identity  # noqa: F401 - pytest fixture


def _user_id(client, headers: dict[str, str]) -> int:
    return client.get("/auth/me", headers=headers).json()["id"]


def _comment(client, headers: dict[str, str], session_id: int, body: str = "nice one") -> int:
    response = client.post(f"/social/feed/{session_id}/comments", headers=headers, json={"body": body})
    assert response.status_code == 200, response.text
    return response.json()["id"]


def _comment_bodies(client, headers: dict[str, str], session_id: int) -> list[str]:
    return [comment["body"] for comment in client.get(f"/social/feed/{session_id}/comments", headers=headers).json()]


@pytest.fixture
def pushes(monkeypatch) -> list[dict]:
    sent: list[dict] = []

    def record(_settings, user_id, title, body, data, *, label):
        sent.append({"user_id": user_id, "title": title, "body": body, "data": data, "label": label})

    monkeypatch.setattr(content_report_service, "schedule_push_to_user", record)
    return sent


@pytest.fixture
def moderator(client, monkeypatch) -> dict[str, str]:
    headers = auth_headers(client, "mod@example.com", "mod-team")
    monkeypatch.setattr(settings, "moderator_user_ids", [_user_id(client, headers)])
    return headers


@pytest.fixture
def thread(client):
    """A session by `host` with a comment by `guest`; `other` is another friend of the host."""
    host = auth_headers(client, "thread-host@example.com", "thread-host")
    guest = auth_headers(client, "thread-guest@example.com", "thread-guest")
    other = auth_headers(client, "thread-other@example.com", "thread-other")
    _make_friends(client, host, guest, "thread-guest")
    _make_friends(client, host, other, "thread-other")
    session_id = _complete_long_session(client, host)
    comment_id = _comment(client, guest, session_id, "from guest")
    return {"host": host, "guest": guest, "other": other, "session_id": session_id, "comment_id": comment_id}


# --- content filter at the edges ---------------------------------------------------------------


def test_objectionable_comment_is_rejected(client, thread):
    response = client.post(
        f"/social/feed/{thread['session_id']}/comments", headers=thread["other"], json={"body": "fuck this beat"}
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "CONTENT_REJECTED"


def test_objectionable_username_is_rejected_at_registration(client):
    response = client.post(
        "/auth/register",
        json={"email": "slur@example.com", "username": "hitler88", "password": DEFAULT_PASSWORD},
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "USERNAME_REJECTED"


def test_social_sign_in_ignores_an_objectionable_given_name(client, apple_identity):  # noqa: F811
    response = client.post("/auth/apple", json={"identity_token": FAKE_TOKEN, "given_name": "Fuckface"})

    me = client.get("/auth/me", headers={"Authorization": f"Bearer {response.json()['access_token']}"}).json()
    assert me["username"] == "artist"


# --- deleting comments -------------------------------------------------------------------------


def test_author_can_delete_their_comment(client, thread):
    response = client.delete(
        f"/social/feed/{thread['session_id']}/comments/{thread['comment_id']}", headers=thread["guest"]
    )

    assert response.status_code == 204
    assert _comment_bodies(client, thread["host"], thread["session_id"]) == []


def test_session_owner_can_delete_any_comment_on_their_session(client, thread):
    response = client.delete(
        f"/social/feed/{thread['session_id']}/comments/{thread['comment_id']}", headers=thread["host"]
    )

    assert response.status_code == 204
    assert _comment_bodies(client, thread["host"], thread["session_id"]) == []


def test_other_viewers_cannot_delete_a_comment(client, thread):
    response = client.delete(
        f"/social/feed/{thread['session_id']}/comments/{thread['comment_id']}", headers=thread["other"]
    )

    assert response.status_code == 403
    assert _comment_bodies(client, thread["host"], thread["session_id"]) == ["from guest"]


def test_deleting_an_unknown_comment_is_not_found(client, thread):
    response = client.delete(f"/social/feed/{thread['session_id']}/comments/9999", headers=thread["host"])

    assert response.status_code == 404


# --- reporting ---------------------------------------------------------------------------------


def test_reporting_a_comment_alerts_every_moderator(client, thread, moderator, pushes):
    response = client.post(
        "/reports",
        headers=thread["other"],
        json={"target_type": "comment", "comment_id": thread["comment_id"], "reason": "harassment"},
    )

    assert response.status_code == 201
    assert [(push["user_id"], push["label"]) for push in pushes] == [(_user_id(client, moderator), "content-report")]
    assert "from guest" not in pushes[0]["body"]


def test_reported_comment_keeps_its_text_for_moderators_after_deletion(client, thread, moderator, pushes):
    client.post(
        "/reports",
        headers=thread["host"],
        json={"target_type": "comment", "comment_id": thread["comment_id"], "reason": "spam", "note": "ads"},
    )
    client.delete(f"/social/feed/{thread['session_id']}/comments/{thread['comment_id']}", headers=thread["guest"])

    [report] = client.get("/moderation/reports", headers=moderator).json()
    assert report["content_snapshot"] == "from guest"
    assert report["reported_username"] == "thread-guest"
    assert report["reporter_username"] == "thread-host"
    assert (report["reason"], report["note"], report["status"]) == ("spam", "ads", "open")


def test_reporting_a_user_snapshots_their_profile(client, moderator, pushes):
    alice = auth_headers(client, "report-a@example.com", "report-alice")
    bob = auth_headers(client, "report-b@example.com", "report-bob")

    response = client.post(
        "/reports", headers=alice, json={"target_type": "user", "user_id": _user_id(client, bob), "reason": "hate"}
    )

    assert response.status_code == 201
    [report] = client.get("/moderation/reports", headers=moderator).json()
    assert "report-bob" in report["content_snapshot"]


def test_reporting_works_without_a_subscription(client, pushes):
    alice = auth_headers(client, "report-free-a@example.com", "report-free-alice", subscriber=False)
    bob_id = _user_id(client, auth_headers(client, "report-free-b@example.com", "report-free-bob"))

    response = client.post("/reports", headers=alice, json={"target_type": "user", "user_id": bob_id, "reason": "spam"})

    assert response.status_code == 201


def test_a_comment_you_cannot_see_cannot_be_reported(client, thread, pushes):
    stranger = auth_headers(client, "report-stranger@example.com", "report-stranger")

    response = client.post(
        "/reports",
        headers=stranger,
        json={"target_type": "comment", "comment_id": thread["comment_id"], "reason": "spam"},
    )

    assert response.status_code == 404


def test_reporting_yourself_is_rejected(client, pushes):
    alice = auth_headers(client, "report-self@example.com", "report-self")

    response = client.post(
        "/reports", headers=alice, json={"target_type": "user", "user_id": _user_id(client, alice), "reason": "spam"}
    )

    assert response.status_code == 400


def test_unknown_report_reason_is_rejected(client, pushes):
    alice = auth_headers(client, "report-why-a@example.com", "report-why-alice")
    bob_id = _user_id(client, auth_headers(client, "report-why-b@example.com", "report-why-bob"))

    response = client.post("/reports", headers=alice, json={"target_type": "user", "user_id": bob_id, "reason": "meh"})

    assert response.status_code == 422


def test_reports_per_day_are_capped(client, pushes):
    alice = auth_headers(client, "report-cap-a@example.com", "report-cap-alice")
    bob_id = _user_id(client, auth_headers(client, "report-cap-b@example.com", "report-cap-bob"))
    payload = {"target_type": "user", "user_id": bob_id, "reason": "spam"}

    statuses = [client.post("/reports", headers=alice, json=payload).status_code for _ in range(21)]

    assert statuses[:20] == [201] * 20
    assert statuses[20] == 429


# --- moderation --------------------------------------------------------------------------------


def test_moderation_is_closed_to_regular_users(client, moderator):
    regular = auth_headers(client, "mod-regular@example.com", "mod-regular")

    assert client.get("/moderation/reports", headers=regular).status_code == 403


def test_resolved_reports_leave_the_open_queue(client, moderator, pushes):
    alice = auth_headers(client, "mod-res-a@example.com", "mod-res-alice")
    bob_id = _user_id(client, auth_headers(client, "mod-res-b@example.com", "mod-res-bob"))
    report_id = client.post(
        "/reports", headers=alice, json={"target_type": "user", "user_id": bob_id, "reason": "spam"}
    ).json()["id"]

    assert client.post(f"/moderation/reports/{report_id}/resolve", headers=moderator).status_code == 204

    assert client.get("/moderation/reports", headers=moderator).json() == []
    assert [r["status"] for r in client.get("/moderation/reports?status=resolved", headers=moderator).json()] == [
        "resolved"
    ]


def test_moderator_can_remove_a_comment(client, thread, moderator):
    response = client.delete(f"/moderation/comments/{thread['comment_id']}", headers=moderator)

    assert response.status_code == 204
    assert _comment_bodies(client, thread["host"], thread["session_id"]) == []


def test_moderator_can_remove_a_profile_picture(client, moderator, monkeypatch):
    removed: list[str | None] = []
    monkeypatch.setattr(moderation_service, "delete_profile_picture", removed.append)
    bob = auth_headers(client, "mod-pic-b@example.com", "mod-pic-bob")
    bob_id = _user_id(client, bob)
    with SessionLocal() as db:
        db.get(User, bob_id).profile_picture_url = "https://cdn.example.com/bob.jpg"
        db.commit()

    response = client.delete(f"/moderation/users/{bob_id}/profile-picture", headers=moderator)

    assert response.status_code == 204
    assert removed == ["https://cdn.example.com/bob.jpg"]
    assert client.get("/auth/me", headers=bob).json()["profile_picture_url"] is None


def test_suspended_user_is_signed_out_and_cannot_sign_in(client, moderator):
    bob = auth_headers(client, "mod-ban-b@example.com", "mod-ban-bob")
    bob_id = _user_id(client, bob)

    assert client.post(f"/moderation/users/{bob_id}/suspend", headers=moderator).status_code == 204

    assert client.get("/auth/me", headers=bob).status_code == 401
    login = client.post("/auth/login", json={"email": "mod-ban-b@example.com", "password": DEFAULT_PASSWORD})
    assert login.status_code == 403
    assert login.json()["error"]["code"] == "ACCOUNT_SUSPENDED"


def test_lifting_a_suspension_allows_signing_in_again(client, moderator):
    bob_id = _user_id(client, auth_headers(client, "mod-unban-b@example.com", "mod-unban-bob"))
    client.post(f"/moderation/users/{bob_id}/suspend", headers=moderator)

    assert client.delete(f"/moderation/users/{bob_id}/suspend", headers=moderator).status_code == 204

    login = client.post("/auth/login", json={"email": "mod-unban-b@example.com", "password": DEFAULT_PASSWORD})
    assert login.status_code == 200


def test_suspended_social_account_cannot_sign_in(client, moderator, apple_identity):  # noqa: F811
    first = client.post("/auth/apple", json={"identity_token": FAKE_TOKEN})
    user_id = client.get("/auth/me", headers={"Authorization": f"Bearer {first.json()['access_token']}"}).json()["id"]
    client.post(f"/moderation/users/{user_id}/suspend", headers=moderator)

    again = client.post("/auth/apple", json={"identity_token": FAKE_TOKEN})

    assert again.status_code == 403
    assert again.json()["error"]["code"] == "ACCOUNT_SUSPENDED"
