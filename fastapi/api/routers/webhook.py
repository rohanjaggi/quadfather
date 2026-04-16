import os
import telebot
from fastapi import APIRouter, Request, HTTPException

from ..bot_handlers import bot

router = APIRouter()

WEBHOOK_SECRET: str = os.getenv("WEBHOOK_SECRET", "")


@router.post("/{secret}")
async def telegram_webhook(secret: str, request: Request):
    if WEBHOOK_SECRET and secret != WEBHOOK_SECRET:
        raise HTTPException(status_code=403, detail="Forbidden")

    body = await request.body()
    update = telebot.types.Update.de_json(body.decode("utf-8"))
    bot.process_new_updates([update])
    return {"ok": True}
