from app.services import push_templates


def test_session_complete_names_the_work_without_filler() -> None:
    title, body = push_templates.session_complete("mixing", 90 * 60)
    assert title == "Session saved"
    assert body == "Mixing · 1h 30m"
    assert "nice work" not in body.lower()


def test_streak_reminder_slots_do_not_leak_utc_or_emoji() -> None:
    title, body = push_templates.streak_reminder_slot("streak_utc_22", 12)
    assert title == "Streak at risk"
    assert "UTC" not in body
    assert "⚠️" not in body
    assert "12-day streak" in body

    _, last_hour = push_templates.streak_reminder_slot("streak_utc_23", 12)
    assert "UTC" not in last_hour
    assert "🔥" not in last_hour

    _, last_half = push_templates.streak_reminder_slot("streak_utc_2330", 12)
    assert "UTC" not in last_half
    assert "⏰" not in last_half


def test_inactivity_nudge_asks_for_a_session() -> None:
    title, body = push_templates.inactivity_nudge(3)
    assert title == "Your studio is waiting"
    assert "session" in body.lower()
    assert "block" not in body.lower()
