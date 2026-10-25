"""Trigger the API's time-based jobs. Render runs this as a cron job every 15 minutes.

Needs INTERNAL_JOB_KEY; API_URL defaults to production. Uses only the standard library so the
cron service needs no dependency install. Exits non-zero when any job failed, so Render reports it.
"""

from __future__ import annotations

import os
import sys
import urllib.error
import urllib.request

DEFAULT_API_URL = "https://prodify-api-46b1.onrender.com"
# Session presence first: it stops abandoned sessions before reminders and the engine read them.
JOB_PATHS = (
    "/jobs/session-presence",
    "/jobs/social-challenges",
    "/jobs/streak-reminders",
    "/jobs/engagement",
)
TIMEOUT_SECONDS = 120


def run_job(api_url: str, job_key: str, path: str) -> bool:
    request = urllib.request.Request(
        f"{api_url.rstrip('/')}{path}",
        method="POST",
        headers={"X-Internal-Job-Key": job_key},
    )
    try:
        with urllib.request.urlopen(request, timeout=TIMEOUT_SECONDS) as response:
            print(f"{path} {response.status} {response.read(500).decode('utf-8', 'replace')}")
            return True
    except urllib.error.HTTPError as error:
        print(f"{path} failed: HTTP {error.code} {error.read(500).decode('utf-8', 'replace')}")
    except (urllib.error.URLError, TimeoutError) as error:
        print(f"{path} failed: {error}")
    return False


def run_all(api_url: str, job_key: str) -> int:
    """Runs every job even when one fails; returns how many failed."""
    return sum(not run_job(api_url, job_key, path) for path in JOB_PATHS)


def main() -> None:
    job_key = os.environ.get("INTERNAL_JOB_KEY", "").strip()
    if not job_key:
        sys.exit("INTERNAL_JOB_KEY is not set")
    api_url = os.environ.get("API_URL", DEFAULT_API_URL).strip()
    failures = run_all(api_url, job_key)
    if failures:
        sys.exit(f"{failures} of {len(JOB_PATHS)} jobs failed")


if __name__ == "__main__":
    main()
