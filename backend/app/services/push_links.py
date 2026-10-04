"""Deep-link paths for push notification payloads (Expo Router)."""

# Open dashboard (start session from there)
DASHBOARD_PATH = "/(tabs)/dashboard"
FRIENDS_PATH = "/(tabs)/friends"


def challenge_path(challenge_id: int) -> str:
    return f"/challenge/{challenge_id}"


def push_data_dashboard() -> dict[str, str]:
    return {"path": DASHBOARD_PATH, "kind": "dashboard"}


def push_data_duel_invite(challenge_id: int) -> dict[str, str]:
    return {"path": FRIENDS_PATH, "kind": "duel_invite", "challenge_id": str(challenge_id)}


def push_data_duel_accepted(challenge_id: int) -> dict[str, str]:
    return {"path": challenge_path(challenge_id), "kind": "duel_accepted", "challenge_id": str(challenge_id)}


def push_data_challenge_update(challenge_id: int, *, path: str, kind: str) -> dict[str, str]:
    return {"path": path, "kind": kind, "challenge_id": str(challenge_id)}
