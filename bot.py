import os
import requests
import telebot
from telebot.types import InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo
from dotenv import load_dotenv

load_dotenv()

token: str = os.getenv("BOTFATHER_TOKEN", "")
MINI_APP_URL: str = os.getenv("MINI_APP_URL", "https://your-app.vercel.app")
API_BASE: str = os.getenv("API_BASE_URL", "http://localhost:8000")

bot = telebot.TeleBot(token, parse_mode="HTML")


# ── Helpers ────────────────────────────────────────────────────────────────

def _app_button(label: str, path: str = "") -> InlineKeyboardMarkup:
    markup = InlineKeyboardMarkup()
    markup.add(InlineKeyboardButton(label, web_app=WebAppInfo(url=f"{MINI_APP_URL}{path}")))
    return markup


def _bot_headers() -> dict:
    return {"X-Bot-Token": token}


def _progress_bar(current: float, goal: float, width: int = 10) -> str:
    filled = round(min(current / goal, 1.0) * width) if goal > 0 else 0
    return "█" * filled + "░" * (width - filled)


def _get_summary(telegram_id: int) -> dict | None:
    try:
        resp = requests.get(
            f"{API_BASE}/users/bot/summary",
            headers=_bot_headers(),
            params={"telegram_id": telegram_id},
            timeout=8,
        )
        if resp.status_code == 200:
            return resp.json()
    except requests.RequestException:
        pass
    return None


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

    cal = data["calories"]
    pro = data["protein"]
    wat = data["water"]
    meals = data["meals_logged"]

    cal_pct = round(cal["total"] / cal["goal"] * 100) if cal["goal"] else 0
    pro_pct = round(pro["total"] / pro["goal"] * 100) if pro["goal"] else 0
    wat_pct = round(wat["total"] / wat["goal"] * 100) if wat["goal"] else 0

    text = (
        "📊 <b>Today's summary</b>\n\n"
        f"🔥 <b>Calories</b>  {cal['total']} / {cal['goal']} kcal  ({cal_pct}%)\n"
        f"<code>{_progress_bar(cal['total'], cal['goal'])}</code>\n\n"
        f"💪 <b>Protein</b>   {pro['total']}g / {pro['goal']}g  ({pro_pct}%)\n"
        f"<code>{_progress_bar(pro['total'], pro['goal'])}</code>\n\n"
        f"💧 <b>Water</b>     {wat['total']}L / {wat['goal']}L  ({wat_pct}%)\n"
        f"<code>{_progress_bar(wat['total'], wat['goal'])}</code>\n\n"
        f"🍽 <b>{meals}</b> meal{'s' if meals != 1 else ''} logged today"
    )

    bot.send_message(message.chat.id, text, reply_markup=_app_button("Open Quadfather", ""))


@bot.message_handler(commands=["log"])
def handle_log(message):
    bot.send_message(
        message.chat.id,
        "Ready to log a meal?\n\n"
        "You can <b>scan a photo</b> for AI macro analysis or add it manually.",
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
    thinking = bot.send_message(message.chat.id, "🔍 Analysing your meal…")

    try:
        # Largest available photo size
        file_id = message.photo[-1].file_id
        file_info = bot.get_file(file_id)
        file_url = f"https://api.telegram.org/file/bot{token}/{file_info.file_path}"

        image_resp = requests.get(file_url, timeout=15)
        image_resp.raise_for_status()
        image_bytes = image_resp.content

        caption = message.caption or ""

        analyse_resp = requests.post(
            f"{API_BASE}/foods/bot/analyse",
            headers=_bot_headers(),
            params={"telegram_id": message.from_user.id},
            files={"image": ("meal.jpg", image_bytes, "image/jpeg")},
            data={"description": caption},
            timeout=30,
        )
        analyse_resp.raise_for_status()
        result = analyse_resp.json()

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
        bot.send_message(
            message.chat.id,
            text,
            reply_markup=_app_button("Log This Meal 🍽", "/food"),
        )

    except requests.RequestException:
        bot.edit_message_text(
            "Sorry, I couldn't analyse that photo right now. Try again or log it manually.",
            message.chat.id,
            thinking.message_id,
            reply_markup=_app_button("Log Manually", "/food"),
        )


bot.infinity_polling()
