"""Deleting a user or a session checks every referencing row; without an index that is a full table scan."""

from sqlalchemy import inspect

from app.database import Base, engine


def _indexed_leading_columns(inspector, table: str) -> set[str]:
    indexes = inspector.get_indexes(table) + [
        {"column_names": constraint["column_names"]} for constraint in inspector.get_unique_constraints(table)
    ]
    leading = {index["column_names"][0] for index in indexes if index["column_names"]}
    primary_key = inspector.get_pk_constraint(table)["constrained_columns"]
    return leading | set(primary_key[:1])


def test_every_foreign_key_has_an_index_on_its_column(client):
    inspector = inspect(engine)

    unindexed = [
        f"{table}.{foreign_key['constrained_columns'][0]}"
        for table in Base.metadata.tables
        for foreign_key in inspector.get_foreign_keys(table)
        if len(foreign_key["constrained_columns"]) == 1
        and foreign_key["constrained_columns"][0] not in _indexed_leading_columns(inspector, table)
    ]

    assert unindexed == []
