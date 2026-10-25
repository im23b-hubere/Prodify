"""The cron entry point calls every time-based job with the internal key."""

import importlib.util
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

import pytest

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "run_scheduled_jobs.py"


def _load_script():
    spec = importlib.util.spec_from_file_location("run_scheduled_jobs", SCRIPT)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.fixture
def fake_api():
    calls: list[tuple[str, str | None]] = []
    failing_paths: set[str] = set()

    class Handler(BaseHTTPRequestHandler):
        def do_POST(self):
            calls.append((self.path, self.headers.get("X-Internal-Job-Key")))
            status = 500 if self.path in failing_paths else 200
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(b'{"ok": true}')

        def log_message(self, *_args):
            pass

    server = HTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    yield f"http://127.0.0.1:{server.server_port}", calls, failing_paths
    server.shutdown()


def test_every_job_is_called_with_the_internal_key(fake_api):
    url, calls, _ = fake_api
    script = _load_script()

    failures = script.run_all(url, "job-key-123")

    assert failures == 0
    assert calls == [(path, "job-key-123") for path in script.JOB_PATHS]


def test_a_failing_job_is_reported_without_skipping_the_rest(fake_api):
    url, calls, failing_paths = fake_api
    script = _load_script()
    failing_paths.add("/jobs/streak-reminders")

    failures = script.run_all(url, "job-key-123")

    assert failures == 1
    assert [path for path, _ in calls] == list(script.JOB_PATHS)
