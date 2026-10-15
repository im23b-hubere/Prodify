from app.services import push_templates


def test_session_complete_names_the_work_without_filler() -> None:
    title, body = push_templates.session_complete("mixing", 90 * 60)
    assert title == "Session saved"
    assert body == "Mixing · 1h 30m"
    assert "nice work" not in body.lower()


def test_streak_reminder_slots_do_not_leak_utc_or_emoji() -> None:
    title, body = push_templates.streak_reminder_slot("streak_2h_left", 12)
    assert title == "Streak at risk"
    assert "UTC" not in body
    assert "⚠️" not in body
    assert "12-day streak" in body

    _, last_hour = push_templates.streak_reminder_slot("streak_1h_left", 12)
    assert "UTC" not in last_hour
    assert "🔥" not in last_hour

    _, last_half = push_templates.streak_reminder_slot("streak_30m_left", 12)
    assert "UTC" not in last_half
    assert "⏰" not in last_half


def test_reengagement_invites_without_pressure() -> None:
    title, body = push_templates.reengagement(4)
    assert title == "Your studio misses you"
    assert "4 days" in body
    assert "!" not in body


def test_streak_at_risk_names_the_time_left_in_words() -> None:
    assert "45 minutes left" in push_templates.streak_at_risk(6, 45)[1]
    assert "about 1 hour left" in push_templates.streak_at_risk(6, 70)[1]
    assert "about 5 hours left" in push_templates.streak_at_risk(6, 290)[1]
