import hashlib
from datetime import datetime, timedelta, timezone

import bcrypt
from jose import JWTError, jwt

from app.config import settings


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def hash_refresh_token(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def create_access_token(
    subject: str,
    *,
    token_version: int = 0,
    expires_delta: timedelta | None = None,
) -> str:
    if expires_delta is None:
        expires_delta = timedelta(minutes=settings.access_token_expire_minutes)
    expire = datetime.now(timezone.utc) + expires_delta
    to_encode = {
        "sub": subject,
        "exp": int(expire.timestamp()),
        "typ": "access",
        "tv": int(token_version),
    }
    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)


def decode_access_token_claims(token: str) -> tuple[str | None, int]:
    """Return (subject_user_id_str, token_version_claim). Missing `tv` in legacy JWTs => 0."""
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        typ = payload.get("typ")
        if typ is not None and typ != "access":
            return None, 0
        sub = payload.get("sub")
        if sub is None:
            return None, 0
        if isinstance(sub, int):
            sub_s = str(sub)
        elif isinstance(sub, str):
            sub_s = str(sub)
        else:
            return None, 0
        raw_tv = payload.get("tv", 0)
        try:
            tv = int(raw_tv)
        except (TypeError, ValueError):
            tv = 0
        return sub_s, tv
    except JWTError:
        return None, 0


def decode_access_token(token: str) -> str | None:
    sub, _tv = decode_access_token_claims(token)
    return sub
