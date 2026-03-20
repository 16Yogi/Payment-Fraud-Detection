from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import uuid4

import base64
import hashlib
import hmac
import secrets

from jose import jwt

from .config import Settings, get_settings


PBKDF2_ITERATIONS = 200_000


def hash_password(password: str) -> str:
    """
    PBKDF2-HMAC-SHA256 salted password hashing.

    We use this instead of bcrypt/passlib to avoid bcrypt version issues
    in some environments.
    """
    salt = secrets.token_bytes(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, PBKDF2_ITERATIONS)
    return "pbkdf2$sha256$" + "$".join(
        [
            str(PBKDF2_ITERATIONS),
            base64.b64encode(salt).decode("utf-8"),
            base64.b64encode(dk).decode("utf-8"),
        ]
    )


def verify_password(password: str, password_hash: str) -> bool:
    try:
        parts = password_hash.split("$")
        # pbkdf2$sha256$<iterations>$<salt_b64>$<dk_b64>
        if len(parts) != 5 or parts[0] != "pbkdf2" or parts[1] != "sha256":
            return False

        iterations = int(parts[2])
        salt = base64.b64decode(parts[3])
        expected_dk = base64.b64decode(parts[4])

        dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations)
        return hmac.compare_digest(dk, expected_dk)
    except Exception:
        return False


def create_access_token(user_id: int, settings: Settings) -> tuple[str, str]:
    """
    Returns (token, jti).
    """
    jti = str(uuid4())
    now = datetime.now(timezone.utc)
    expires = now + timedelta(minutes=settings.access_token_expire_minutes)
    payload: dict[str, Any] = {
        "sub": str(user_id),
        "jti": jti,
        "iat": int(now.timestamp()),
        "exp": int(expires.timestamp()),
    }
    token = jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)
    return token, jti


def decode_token(token: str, settings: Settings) -> dict[str, Any]:
    return jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])


def get_default_settings() -> Settings:
    # Convenience wrapper for older call sites.
    return get_settings()

