"""
Telegram bot handlers — used via webhook in production (FastAPI receives updates).
The old root bot.py with infinity_polling() is kept for local dev only.
"""
import os
from datetime import datetime, timezone

import telebot
from telebot.types import InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo

BOT_TOKEN: str = os.getenv("BOTFATHER_TOKEN", "")
MINI_APP_URL: str = os.getenv("MINI_APP_URL", "https://your-app.vercel.app")

bot = telebot.TeleBot(BOT_TOKEN, parse_mode="HTML", threaded=False)


# ── Helpers ────────────────────────────────────────────────────────────────

def _app_button(label: str, path: str = "") -> InlineKeyboardMarkup:
    markup = InlineKeyboardMarkup()
    markup.add(InlineKeyboardButton(label, web_app=WebAppInfo(url=f"{MINI_APP_URL}{path}")))
    return markup


def _progress_bar(current: float, goal: float, width: int = 10) -> str:
    filled = round(min(current / goal, 1.0) * width) if goal > 0 else 0
    return "█" * filled + "░" * (width - filled)


def _get_summary(telegram_id: int) -> dict | None:
    """Query today's totals directly from the DB — no HTTP round-trip needed."""
    from .models import User, FoodLog, WaterLog
    from .database import SessionLocal

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.telegram_id == telegram_id).first()
        if not user:
            return None

        today_start = datetime.now(timezone.utc).replace(
            hour=0, minute=0, second=0, microsecond=0, tzinfo=None
        )

        food_logs = db.query(FoodLog).filter(
            FoodLog.user_id == user.id,
            FoodLog.logged_at >= today_start,
        ).all()

        water_logs = db.query(WaterLog).filter(
            WaterLog.user_id == user.id,
            WaterLog.logged_at >= today_start,
        ).all()

        return {
            "calories": {
                "total": round(sum(l.calories or 0 for l in food_logs)),
                "goal": round(user.daily_calorie_goal),
            },
            "protein": {
                "total": round(sum(l.protein or 0 for l in food_logs), 1),
                "goal": round(user.daily_protein_goal, 1),
            },
            "water": {
                "total": round(sum(l.amount_liters for l in water_logs), 2),
                "goal": round(user.daily_water_goal, 2),
            },
            "meals_logged": len(food_logs),
        }
    finally:
        db.close()


# ── Commands ───────────────────────────────────────────────────────────────

@bot.message_handler(commands=["start"])
def handle_start(message):
    name = message.from_user.first_name or "there"
    bot.send_message(
        message.chat.id,
        f"Hey <b>{name}</b> 👋\n\n"
        "Welcome to <b>Quadfather</b> — your personal nutrition tracker.\n\n"
        "<b>Commands:</b>\n"
        "/today — today's macros &amp; hydration\n"
        "/log — log a meal\n"
        "/water — track water\n"
        "/trends — view your progress\n"
        "/goals — manage your goals\n"
        "/help — show this list\n\n"
        "Or just <b>send a photo</b> of your meal and I'll analyse the macros.",
        reply_markup=_app_button("Open Quadfather", ""),
    )


@bot.message_handler(commands=["help"])
def handle_help(message):
    bot.send_message(
        message.chat.id,
        "<b>Quadfather commands</b>\n\n"
        "/today — today's calorie, protein &amp; water summary\n"
        "/log — open the meal logger (scan or manual)\n"
        "/water — open the water tracker\n"
        "/trends — view 7-day &amp; 30-day progress charts\n"
        "/goals — update your daily calorie, protein &amp; water goals\n\n"
        "📸 <b>Send any photo</b> and I'll analyse the macros with AI.",
    )


@bot.message_handler(commands=["today"])
def handle_today(message):
    data = _get_summary(message.from_user.id)

    if data is None:
        bot.send_message(
            message.chat.id,
            "Couldn't fetch your data. Make sure you've opened the app at least once.",
            reply_markup=_app_button("Open Quadfather", ""),
        )
        return

    cal, pro, wat = data["calories"], data["protein"], data["water"]
    meals = data["meals_logged"]

    cal_pct = round(cal["total"] / cal["goal"] * 100) if cal["goal"] else 0
    pro_pct = round(pro["total"] / pro["goal"] * 100) if pro["goal"] else 0
    wat_pct = round(wat["total"] / wat["goal"] * 100) if wat["goal"] else 0

    bot.send_message(
        message.chat.id,
        "📊 <b>Today's summary</b>\n\n"
        f"🔥 <b>Calories</b>  {cal['total']} / {cal['goal']} kcal  ({cal_pct}%)\n"
        f"<code>{_progress_bar(cal['total'], cal['goal'])}</code>\n\n"
        f"💪 <b>Protein</b>   {pro['total']}g / {pro['goal']}g  ({pro_pct}%)\n"
        f"<code>{_progress_bar(pro['total'], pro['goal'])}</code>\n\n"
        f"💧 <b>Water</b>     {wat['total']}L / {wat['goal']}L  ({wat_pct}%)\n"
        f"<code>{_progress_bar(wat['total'], wat['goal'])}</code>\n\n"
        f"🍽 <b>{meals}</b> meal{'s' if meals != 1 else ''} logged today",
        reply_markup=_app_button("Open Quadfather", ""),
    )


@bot.message_handler(commands=["log"])
def handle_log(message):
    bot.send_message(
        message.chat.id,
        "Ready to log a meal?\n\nYou can <b>scan a photo</b> for AI macro analysis or add it manually.",
        reply_markup=_app_button("Log a Meal 🍽", "/food"),
    )


@bot.message_handler(commands=["water"])
def handle_water(message):
    data = _get_summary(message.from_user.id)
    if data:
        wat = data["water"]
        wat_pct = round(wat["total"] / wat["goal"] * 100) if wat["goal"] else 0
        text = (
            f"💧 <b>Water today:</b> {wat['total']}L / {wat['goal']}L  ({wat_pct}%)\n"
            f"<code>{_progress_bar(wat['total'], wat['goal'])}</code>\n\n"
            "Tap below to log your next bottle."
        )
    else:
        text = "Staying hydrated? Use the app to tap your way to your daily goal."
    bot.send_message(message.chat.id, text, reply_markup=_app_button("Track Water 💧", "/water"))


@bot.message_handler(commands=["trends"])
def handle_trends(message):
    bot.send_message(
        message.chat.id,
        "📈 See how your nutrition and hydration have tracked over the last 7 or 30 days.",
        reply_markup=_app_button("View Trends 📈", "/analytics"),
    )


@bot.message_handler(commands=["goals"])
def handle_goals(message):
    bot.send_message(
        message.chat.id,
        "⚙️ Update your daily calorie, protein, and water goals.",
        reply_markup=_app_button("Manage Goals ⚙️", "/profile"),
    )


# ── Photo handler ──────────────────────────────────────────────────────────

@bot.message_handler(content_types=["photo"])
def handle_photo(message):
    from .services.gemini import analyse_meal
    import requests as req

    thinking = bot.send_message(message.chat.id, "🔍 Analysing your meal…")
    try:
        file_info = bot.get_file(message.photo[-1].file_id)
        file_url = f"https://api.telegram.org/file/bot{BOT_TOKEN}/{file_info.file_path}"
        image_bytes = req.get(file_url, timeout=15).content

        result = analyse_meal(image_bytes, "image/jpeg", message.caption or "")

        confidence_emoji = {"high": "🟢", "medium": "🟡", "low": "🔴"}.get(
            result.get("confidence", "medium"), "🟡"
        )
        text = (
            f"<b>{result['food_name']}</b>\n\n"
            f"🔥 <b>Calories:</b> {result['calories']} kcal\n"
            f"💪 <b>Protein:</b> {result['protein']}g\n"
            f"🌾 <b>Carbs:</b> {result['carbohydrates']}g\n"
            f"🧈 <b>Fats:</b> {result['fats']}g\n\n"
            f"{confidence_emoji} {result.get('confidence', 'medium').capitalize()} confidence"
        )
        if result.get("notes"):
            text += f"\n<i>{result['notes']}</i>"
        text += "\n\nOpen the app to log this meal or adjust the values."

        bot.delete_message(message.chat.id, thinking.message_id)
        bot.send_message(message.chat.id, text, reply_markup=_app_button("Log This Meal 🍽", "/food"))

    except Exception:
        bot.edit_message_text(
            "Sorry, I couldn't analyse that photo right now. Try again or log it manually.",
            message.chat.id,
            thinking.message_id,
            reply_markup=_app_button("Log Manually", "/food"),
        )
