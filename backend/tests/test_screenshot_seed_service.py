from app.services.screenshot_seed_scenario import MainSeedConfig, ScreenshotSeedResult


def test_main_seed_config_names_scenario_inputs():
    config = MainSeedConfig(
        email="producer@example.com",
        username="producer",
        password="demo123456",
        days_back=84,
        current_streak=52,
        longest_streak=71,
        level=24,
    )

    assert config.current_streak == 52
    assert config.longest_streak == 71


def test_screenshot_seed_result_is_immutable():
    result = ScreenshotSeedResult(
        main_email="producer@example.com",
        main_username="producer",
        main_user_id=1,
        sessions_created=120,
        current_streak=52,
        longest_streak=71,
        friends_seeded=6,
        premium_enabled=True,
    )

    assert result.friends_seeded == 6
