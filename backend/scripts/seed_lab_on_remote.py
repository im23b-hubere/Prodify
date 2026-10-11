"""Seed the lab account on a remote API (Render) via the screenshot job, then add extras."""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request

API_URL = os.environ.get("PRODIFY_API_URL", "https://prodify-api-46b1.onrender.com").rstrip("/")
JOB_KEY = os.environ.get("INTERNAL_JOB_KEY", "").strip()
EMAIL = "eric.lab@prodify.app"
USERNAME = "eric.lab"
PASSWORD = os.environ.get("PRODIFY_LAB_PASSWORD", "").strip()

FOCUS_FOR_TYPE = {
    "beat_making": ["beat_making.drums", "beat_making.groove"],
    "mixing": ["mixing.eq", "mixing.saturation"],
    "sound_design": ["sound_design.synthesis", "sound_design.modulation"],
    "arrangement": ["arrangement.structure", "arrangement.energy"],
}


def request(method: str, path: str, *, token: str | None = None, body: dict | None = None, job: bool = False, timeout: int = 60) -> tuple[int, dict | list | str]:
    data = None if body is None else json.dumps(body).encode()
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if job:
        headers["X-Internal-Job-Key"] = JOB_KEY
    req = urllib.request.Request(f"{API_URL}{path}", data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode()
            parsed: dict | list | str = json.loads(raw) if raw else {}
            return resp.status, parsed
    except urllib.error.HTTPError as err:
        raw = err.read().decode()
        try:
            parsed = json.loads(raw) if raw else {}
        except json.JSONDecodeError:
            parsed = raw
        return err.code, parsed


def require_ok(status: int, payload: object, label: str) -> object:
    if status >= 400:
        print(f"{label} failed HTTP {status}: {payload}")
        sys.exit(1)
    print(f"{label} HTTP {status}")
    return payload


def main() -> None:
    if not JOB_KEY:
        print("INTERNAL_JOB_KEY is missing.")
        sys.exit(1)
    if not PASSWORD:
        print("PRODIFY_LAB_PASSWORD is missing.")
        sys.exit(1)

    health_status, _ = request("GET", "/health", timeout=90)
    print(f"health HTTP {health_status}")

    seed = require_ok(
        *request(
            "POST",
            "/jobs/seed-screenshot-account",
            body={
                "main_email": EMAIL,
                "main_username": USERNAME,
                "main_password": PASSWORD,
                "friend_password": PASSWORD,
                "days_back": 84,
                "current_streak": 18,
                "longest_streak": 41,
                "main_level": 16,
            },
            job=True,
            timeout=300,
        )[:2],
        "seed",
    )
    if isinstance(seed, dict):
        print(
            f"  user_id={seed.get('main_user_id')} sessions={seed.get('sessions_created')} "
            f"friends={seed.get('friends_seeded')} premium={seed.get('premium_enabled')}"
        )

    login = require_ok(
        *request("POST", "/auth/login", body={"email": EMAIL, "password": PASSWORD})[:2],
        "login",
    )
    token = login["access_token"] if isinstance(login, dict) else ""

    me = require_ok(*request("GET", "/auth/me", token=token)[:2], "me")
    entitlement = require_ok(*request("GET", "/billing/entitlement", token=token)[:2], "entitlement")
    stats = require_ok(*request("GET", "/sessions/stats?period=week", token=token)[:2], "week stats")

    if isinstance(stats, dict):
        summary = stats.get("summary") or {}
        print(f"  week sessions={summary.get('total_sessions')} seconds={summary.get('total_seconds')}")
        print(f"  woran={[(row.get('branch'), row.get('seconds')) for row in stats.get('branch_seconds') or []]}")
        recent = stats.get("recent_sessions") or []
        patched = 0
        for index, session in enumerate(recent):
            session_id = session.get("id")
            session_type = session.get("session_type")
            if not session_id or session_type not in FOCUS_FOR_TYPE:
                continue
            payload: dict = {"skill_focus_ids": FOCUS_FOR_TYPE[session_type]}
            if index == 0:
                payload["session_type"] = "mix_and_master"
                payload["skill_focus_ids"] = ["mixing.eq", "mastering.loudness"]
            elif index == 1:
                payload["session_type"] = "production"
                payload["skill_focus_ids"] = []
                payload["area_weights"] = [
                    {"branch": "beat_making", "weight": 3},
                    {"branch": "mixing", "weight": 2},
                ]
            status, _ = request("PATCH", f"/sessions/item/{session_id}", token=token, body=payload)
            if status < 400:
                patched += 1
        print(f"  patched focuses on {patched} recent sessions")

    board = require_ok(*request("GET", "/friends/leaderboard?period=week", token=token)[:2], "friends")
    friend_ids = {}
    if isinstance(board, dict):
        for entry in board.get("entries") or []:
            name = entry.get("username")
            user_id = entry.get("user_id")
            if name and user_id and name != USERNAME:
                friend_ids[name] = user_id
        print(f"  friends={list(friend_ids)}")

    nico_id = friend_ids.get("nico.beats")
    if nico_id:
        status, challenge = request(
            "POST",
            "/social/challenges",
            token=token,
            body={
                "challenge_kind": "team",
                "title": "Studio week together",
                "target_sessions": 10,
                "duration_days": 7,
                "member_user_ids": [nico_id],
            },
        )
        print(f"  team challenge HTTP {status} {challenge if status >= 400 else (challenge.get('title') if isinstance(challenge, dict) else '')}")
        status, buddy = request(
            "POST",
            "/social/buddy/invite",
            token=token,
            body={"friend_user_id": nico_id},
        )
        print(f"  buddy invite HTTP {status}")

    print("ready")
    print(f"  email:    {EMAIL}")
    print(f"  username: @{USERNAME}")
    print(f"  password: {PASSWORD}")
    if isinstance(me, dict):
        print(f"  premium:  {entitlement.get('is_premium') if isinstance(entitlement, dict) else me}")


if __name__ == "__main__":
    main()
