from config import token
import telebot
from telebot.types import InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo

bot = telebot.TeleBot(token, parse_mode="HTML")

# Update this after deploying to Vercel, or use your ngrok URL for local dev
MINI_APP_URL = "https://your-app.vercel.app"


@bot.message_handler(commands=["start"])
def handle_start(message):
    markup = InlineKeyboardMarkup()
    markup.add(
        InlineKeyboardButton("Open Quadfather 🚀", web_app=WebAppInfo(url=MINI_APP_URL))
    )
    bot.send_message(
        message.chat.id,
        "Welcome to <b>Quadfather</b>! 💪\n\n"
        "Track your calories, protein, water, and workouts all in one place.\n\n"
        "Tap below to open the app:",
        reply_markup=markup,
    )


@bot.message_handler(commands=["log"])
def handle_log(message):
    markup = InlineKeyboardMarkup()
    markup.add(
        InlineKeyboardButton("Log a Meal 🍽️", web_app=WebAppInfo(url=f"{MINI_APP_URL}/food"))
    )
    bot.send_message(
        message.chat.id,
        "Ready to log a meal? Snap a photo and I'll estimate the macros for you.",
        reply_markup=markup,
    )


@bot.message_handler(commands=["water"])
def handle_water(message):
    markup = InlineKeyboardMarkup()
    markup.add(
        InlineKeyboardButton("Track Water 💧", web_app=WebAppInfo(url=f"{MINI_APP_URL}/water"))
    )
    bot.send_message(
        message.chat.id,
        "Staying hydrated? Use the app to tap your way to your daily water goal.",
        reply_markup=markup,
    )


@bot.message_handler(content_types=["photo"])
def handle_photo(message):
    bot.send_message(
        message.chat.id,
        "Nice meal photo! 📸\n\n"
        "Once the AI is hooked up, I'll analyse the macros and log them automatically. "
        "For now, open the app to log it manually.",
    )


bot.infinity_polling()
