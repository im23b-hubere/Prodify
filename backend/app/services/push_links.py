"""Deep-link paths for push notification payloads (Expo Router)."""

# Open dashboard (start session from there)
DASHBOARD_PATH = "/(tabs)/dashboard"
FRIENDS_PATH = "/(tabs)/friends"


def push_data_dashboard() -> dict[str, str]:
    return {"path": DASHBOARD_PATH, "kind": "dashboard"}


def push_data_duel_invite(challenge_id: int) -> dict[str, str]:
    return {"path": FRIENDS_PATH, "kind": "duel_invite", "challenge_id": str(challenge_id)}


def push_data_duel_accepted(challenge_id: int) -> dict[str, str]:
    return {"path": FRIENDS_PATH, "kind": "duel_accepted", "challenge_id": str(challenge_id)}
