from config import token
import telebot

# Initialize the bot with token
bot = telebot.TeleBot(token, parse_mode=None)

bot.infinity_polling()