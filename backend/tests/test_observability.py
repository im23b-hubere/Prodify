import sys
import types

from app.observability import init_sentry


def test_init_sentry_uses_release_environment_and_sample_rate(monkeypatch):
    captured: dict = {}

    fake_sentry_sdk = types.ModuleType("sentry_sdk")

    def fake_init(**kwargs):
        captured.update(kwargs)

    fake_sentry_sdk.init = fake_init

    fake_fastapi_module = types.ModuleType("sentry_sdk.integrations.fastapi")
    fake_starlette_module = types.ModuleType("sentry_sdk.integrations.starlette")

    class FakeFastApiIntegration:
        pass

    class FakeStarletteIntegration:
        def __init__(self, transaction_style: str):
            self.transaction_style = transaction_style

    fake_fastapi_module.FastApiIntegration = FakeFastApiIntegration
    fake_starlette_module.StarletteIntegration = FakeStarletteIntegration

    monkeypatch.setitem(sys.modules, "sentry_sdk", fake_sentry_sdk)
    monkeypatch.setitem(sys.modules, "sentry_sdk.integrations.fastapi", fake_fastapi_module)
    monkeypatch.setitem(sys.modules, "sentry_sdk.integrations.starlette", fake_starlette_module)

    monkeypatch.setattr("app.observability.settings.sentry_dsn", "https://example@sentry.io/1")
    monkeypatch.setattr("app.observability.settings.environment", "production")
    monkeypatch.setattr("app.observability.settings.app_version", "1.2.3")
    monkeypatch.setattr("app.observability.settings.sentry_traces_sample_rate", 0.25)

    init_sentry()

    assert captured["dsn"] == "https://example@sentry.io/1"
    assert captured["environment"] == "production"
    assert captured["release"] == "1.2.3"
    assert captured["traces_sample_rate"] == 0.25
    assert captured["send_default_pii"] is False
