from pathlib import Path

from scripts.check_clean_code import check_backend


def _write(root: Path, relative_path: str, source: str) -> None:
    target = root / relative_path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(source, encoding="utf-8")


def test_guard_rejects_new_long_function(tmp_path):
    function_body = "\n".join("    pass" for _ in range(50))
    _write(tmp_path, "feature.py", f"def oversized():\n{function_body}\n")

    violations = check_backend(tmp_path)

    assert any("function 'oversized' has 51 lines" in item.message for item in violations)


def test_guard_rejects_new_oversized_module(tmp_path):
    _write(tmp_path, "catalog.py", "\n".join("VALUE = 1" for _ in range(301)))

    violations = check_backend(tmp_path)

    assert any("module has 301 lines" in item.message for item in violations)


def test_guard_rejects_new_router_transaction_boundary(tmp_path):
    _write(tmp_path, "routers/new_endpoint.py", "def endpoint(db):\n    db.commit()\n")

    violations = check_backend(tmp_path)

    assert any("router has 1 transaction calls; budget is 0" in item.message for item in violations)
