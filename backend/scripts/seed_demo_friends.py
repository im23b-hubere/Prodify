import argparse
import json
import sys
import urllib.error
import urllib.parse
import urllib.request


def _request_json(method: str, url: str, payload: dict | None = None, token: str | None = None):
    body = None
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if payload is not None:
        body = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url=url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=20) as res:
            data = res.read().decode("utf-8")
            return res.getcode(), (json.loads(data) if data else {})
    except urllib.error.HTTPError as e:
        data = e.read().decode("utf-8")
        parsed = None
        if data:
            try:
                parsed = json.loads(data)
            except json.JSONDecodeError:
                parsed = {"detail": data}
        return e.code, parsed or {}


def login(base_url: str, email: str, password: str) -> str:
    status, body = _request_json(
        "POST",
        f"{base_url}/auth/login",
        payload={"email": email, "password": password},
    )
    if status != 200:
        raise RuntimeError(f"Login failed for {email}: {status} {body}")
    token = body.get("access_token")
    if not token:
        raise RuntimeError(f"No access_token in login response for {email}")
    return str(token)


def register(base_url: str, email: str, username: str, password: str) -> str:
    status, body = _request_json(
        "POST",
        f"{base_url}/auth/register",
        payload={"email": email, "username": username, "password": password},
    )
    if status not in (200, 201):
        raise RuntimeError(f"Register failed for {email}: {status} {body}")
    token = body.get("access_token")
    if not token:
        raise RuntimeError(f"No access_token in register response for {email}")
    return str(token)


def login_or_register(base_url: str, email: str, username: str, password: str) -> str:
    try:
        return login(base_url, email, password)
    except RuntimeError:
        return register(base_url, email, username, password)


def ensure_friendship(base_url: str, main_token: str, friend_username: str) -> None:
    status, body = _request_json(
        "POST",
        f"{base_url}/friends/request",
        payload={"username": friend_username},
        token=main_token,
    )
    if status not in (200, 201, 400):
        raise RuntimeError(f"Failed to send request to {friend_username}: {status} {body}")

    # Accept all incoming pending requests to main account (idempotent).
    status, incoming = _request_json("GET", f"{base_url}/friends/incoming", token=main_token)
    if status != 200:
        raise RuntimeError(f"Failed to load incoming requests: {status} {incoming}")
    if not isinstance(incoming, list):
        return
    for req in incoming:
        fid = req.get("id")
        if not fid:
            continue
        acc_status, _ = _request_json("POST", f"{base_url}/friends/{fid}/accept", token=main_token)
        if acc_status not in (200, 404):
            raise RuntimeError(f"Failed to accept request {fid}: {acc_status}")


def main():
    parser = argparse.ArgumentParser(description="Seed demo friends and auto-accept for a main account.")
    parser.add_argument("--base-url", default="http://127.0.0.1:8000", help="Backend base URL")
    parser.add_argument("--main-email", required=True, help="Main account email (must exist)")
    parser.add_argument("--main-password", required=True, help="Main account password")
    parser.add_argument("--count", type=int, default=6, help="Number of demo friends to ensure")
    parser.add_argument("--friend-password", default="demo123456", help="Password for generated demo friends")
    parser.add_argument("--prefix", default="demo_friend_", help="Username/email prefix for friend accounts")
    args = parser.parse_args()

    base_url = args.base_url.rstrip("/")
    if args.count < 1:
        raise RuntimeError("--count must be >= 1")

    main_token = login(base_url, args.main_email, args.main_password)

    created_or_reused = 0
    for i in range(1, args.count + 1):
        username = f"{args.prefix}{i}"
        # Keep email deterministic and simple.
        email = f"{args.prefix}{i}@gmail.com"
        login_or_register(base_url, email=email, username=username, password=args.friend_password)
        ensure_friendship(base_url, main_token=main_token, friend_username=username)
        created_or_reused += 1

    print(f"Done. Ensured {created_or_reused} demo friend accounts and accepted pending requests.")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        sys.exit(1)
