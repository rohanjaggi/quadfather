import hashlib
import hmac
import json
import os
from urllib.parse import parse_qsl

from fastapi import Header, HTTPException, Query

from .database import SessionLocal

BOT_TOKEN: str = os.getenv("BOTFATHER_TOKEN", "")
SKIP_TELEGRAM_AUTH: bool = os.getenv("SKIP_TELEGRAM_AUTH", "false").lower() == "true"
DEV_USER_ID: int = int(os.getenv("DEV_USER_ID", "12345678"))


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def verify_telegram_auth(x_telegram_init_data: str = Header(default="")) -> dict:
    """
    Validates Telegram's initData HMAC-SHA256 signature and returns the parsed user dict.
    See: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
    """
    if SKIP_TELEGRAM_AUTH:
        return {"id": DEV_USER_ID, "username": "devuser", "first_name": "Dev"}

    parsed = dict(parse_qsl(x_telegram_init_data, keep_blank_values=True))
    received_hash = parsed.pop("hash", None)

    if not received_hash:
        raise HTTPException(status_code=401, detail="Missing hash in initData")

    data_check_string = "\n".join(f"{k}={v}" for k, v in sorted(parsed.items()))
    secret_key = hmac.new(b"WebAppData", BOT_TOKEN.encode(), hashlib.sha256).digest()
    expected_hash = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()

    if not hmac.compare_digest(expected_hash, received_hash):
        raise HTTPException(status_code=401, detail="Invalid initData signature")

    return json.loads(parsed["user"])


def verify_bot_auth(
    x_bot_token: str = Header(default=""),
    telegram_id: int = Query(...),
) -> int:
    """
    Simple auth for bot-initiated requests: validates the shared bot token
    and returns the telegram_id the bot is acting on behalf of.
    """
    if not BOT_TOKEN or x_bot_token != BOT_TOKEN:
        raise HTTPException(status_code=401, detail="Invalid bot token")
    return telegram_id
