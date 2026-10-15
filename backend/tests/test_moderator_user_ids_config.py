"""MODERATOR_USER_IDS on Render is a single id, which pydantic-settings decodes as an int."""

from app.config import Settings

_SECRET = "production-secret-key-at-least-32-characters-long"


def test_single_moderator_id_from_env_is_a_list(monkeypatch) -> None:
    monkeypatch.setenv("MODERATOR_USER_IDS", "31")
    settings = Settings(_env_file=None, secret_key=_SECRET)
    assert settings.moderator_user_ids == [31]


def test_comma_separated_moderator_ids_from_env(monkeypatch) -> None:
    monkeypatch.setenv("MODERATOR_USER_IDS", "31, 44")
    settings = Settings(_env_file=None, secret_key=_SECRET)
    assert settings.moderator_user_ids == [31, 44]
