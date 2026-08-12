import pytest

from app.startup.schema_validation import (
    REQUIRED_TABLES,
    _require_columns,
    _require_production_revision_table,
    _require_tables,
)


class ColumnInspector:
    def __init__(self, columns: set[str]):
        self.columns = columns

    def get_columns(self, _table_name: str) -> list[dict[str, str]]:
        return [{"name": column} for column in self.columns]


def test_required_table_error_names_missing_migrations():
    with pytest.raises(RuntimeError, match="sessions"):
        _require_tables(REQUIRED_TABLES - {"sessions"})


def test_required_columns_pass_when_contract_is_satisfied():
    _require_columns(ColumnInspector({"id", "status"}), "items", {"id", "status"})


def test_production_server_requires_alembic_revision(monkeypatch):
    monkeypatch.setattr("app.startup.schema_validation.settings.environment", "production")
    monkeypatch.setattr(
        "app.startup.schema_validation.settings.database_url",
        "postgresql+psycopg://localhost/prodify",
    )

    with pytest.raises(RuntimeError, match="alembic_version"):
        _require_production_revision_table(REQUIRED_TABLES)
