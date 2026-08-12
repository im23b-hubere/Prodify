"""Dependency-free Clean Code regression guard for production backend modules."""

from __future__ import annotations

import ast
from dataclasses import dataclass
from pathlib import Path


APP_ROOT = Path(__file__).resolve().parents[1] / "app"
DEFAULT_MAX_FUNCTION_LINES = 50
DEFAULT_MAX_MODULE_LINES = 300

# Existing hotspots are explicit debt budgets. Lower these numbers whenever a hotspot is reduced.
FUNCTION_LINE_BUDGETS = {}
MODULE_LINE_BUDGETS = {}
ROUTER_TRANSACTION_BUDGETS = {
    "auth.py": 2,
    "challenges.py": 3,
    "friend_relationships.py": 4,
    "goals.py": 2,
    "outcomes.py": 4,
    "session_records.py": 3,
    "social_accountability.py": 2,
    "social_challenges.py": 7,
    "social_feed.py": 2,
    "social_streak.py": 2,
    "streak.py": 6,
}


@dataclass(frozen=True)
class Violation:
    path: str
    line: int
    message: str

    def render(self) -> str:
        return f"{self.path}:{self.line}: {self.message}"


def check_backend(app_root: Path = APP_ROOT) -> list[Violation]:
    violations: list[Violation] = []
    for path in sorted(app_root.rglob("*.py")):
        relative_path = path.relative_to(app_root).as_posix()
        source = path.read_text(encoding="utf-8")
        tree = ast.parse(source, filename=str(path))
        violations.extend(_check_module_size(relative_path, source))
        violations.extend(_check_function_sizes(relative_path, tree))
        if relative_path.startswith("routers/"):
            violations.extend(_check_router_transactions(relative_path, tree))
    return violations


def _check_module_size(path: str, source: str) -> list[Violation]:
    line_count = len(source.splitlines())
    budget = MODULE_LINE_BUDGETS.get(path, DEFAULT_MAX_MODULE_LINES)
    if line_count <= budget:
        return []
    return [Violation(path, 1, f"module has {line_count} lines; budget is {budget}")]


def _check_function_sizes(path: str, tree: ast.AST) -> list[Violation]:
    violations: list[Violation] = []
    for node in ast.walk(tree):
        if not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            continue
        line_count = (node.end_lineno or node.lineno) - node.lineno + 1
        budget = FUNCTION_LINE_BUDGETS.get((path, node.name), DEFAULT_MAX_FUNCTION_LINES)
        if line_count > budget:
            violations.append(
                Violation(
                    path,
                    node.lineno,
                    f"function '{node.name}' has {line_count} lines; budget is {budget}",
                )
            )
    return violations


def _check_router_transactions(path: str, tree: ast.AST) -> list[Violation]:
    transaction_calls = [
        node
        for node in ast.walk(tree)
        if isinstance(node, ast.Call)
        and isinstance(node.func, ast.Attribute)
        and node.func.attr in {"commit", "rollback"}
    ]
    router_name = Path(path).name
    budget = ROUTER_TRANSACTION_BUDGETS.get(router_name, 0)
    if len(transaction_calls) <= budget:
        return []
    first_excess = transaction_calls[budget]
    return [
        Violation(
            path,
            first_excess.lineno,
            f"router has {len(transaction_calls)} transaction calls; budget is {budget}",
        )
    ]


def main() -> int:
    violations = check_backend()
    if violations:
        print("Clean Code regression guard failed:")
        for violation in violations:
            print(f"- {violation.render()}")
        return 1
    print("Clean Code regression guard passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
