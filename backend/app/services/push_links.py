"""Deep-link paths for push notification payloads (Expo Router)."""

# Open dashboard (start session from there)
DASHBOARD_PATH = "/(tabs)/dashboard"


def push_data_dashboard() -> dict[str, str]:
    return {"path": DASHBOARD_PATH, "kind": "dashboard"}
