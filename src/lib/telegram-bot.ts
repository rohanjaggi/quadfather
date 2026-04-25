import { Bot, InlineKeyboard } from "grammy";
import { prisma } from "./prisma";
import { analyseMeal, type AIProvider } from "./ai";
import { encrypt, decrypt } from "./crypto";

const BOT_TOKEN = process.env.BOTFATHER_TOKEN ?? "";
const MINI_APP_URL =
  process.env.MINI_APP_URL ?? "https://your-app.vercel.app";

const VALID_PROVIDERS: AIProvider[] = ["openai", "anthropic", "gemini"];

let _bot: Bot | null = null;

function initBot(): Bot {
  if (_bot) return _bot;
  _bot = new Bot(BOT_TOKEN);
  _bot.catch((err) => {
    console.error("Bot error:", err);
  });
  registerHandlers(_bot);
  return _bot;
}

export function getBot(): Bot {
  return initBot();
}

function appButton(label: string, path: string = "") {
  return new InlineKeyboard().webApp(label, `${MINI_APP_URL}${path}`);
}

function progressBar(current: number, goal: number, width = 10): string {
  const filled =
    goal > 0 ? Math.round(Math.min(current / goal, 1.0) * width) : 0;
  return "\u{2588}".repeat(filled) + "\u{2591}".repeat(width - filled);
}

async function getSummary(telegramId: number) {
  const user = await prisma.user.findUnique({
    where: { telegram_id: telegramId },
  });
  if (!user) return null;

  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const [foodLogs, waterLogs] = await Promise.all([
    prisma.foodLog.findMany({
      where: { user_id: user.id, logged_at: { gte: todayStart } },
    }),
    prisma.waterLog.findMany({
      where: { user_id: user.id, logged_at: { gte: todayStart } },
    }),
  ]);

  return {
    calories: {
      total: Math.round(foodLogs.reduce((s, l) => s + (l.calories ?? 0), 0)),
      goal: Math.round(user.daily_calorie_goal),
    },
    protein: {
      total:
        Math.round(foodLogs.reduce((s, l) => s + (l.protein ?? 0), 0) * 10) /
        10,
      goal: Math.round(user.daily_protein_goal * 10) / 10,
    },
    water: {
      total:
        Math.round(
          waterLogs.reduce((s, l) => s + l.amount_liters, 0) * 100,
        ) / 100,
      goal: Math.round(user.daily_water_goal * 100) / 100,
    },
    meals_logged: foodLogs.length,
  };
}

async function getUserAI(telegramId: number) {
  const user = await prisma.user.findUnique({
    where: { telegram_id: telegramId },
  });
  if (!user) return null;
  if (!user.ai_provider || !user.ai_api_key) return null;
  return {
    provider: user.ai_provider as AIProvider,
    apiKey: decrypt(user.ai_api_key),
  };
}

function registerHandlers(bot: Bot) {
  bot.command("start", async (ctx) => {
    const name = ctx.from?.first_name ?? "there";
    await ctx.reply(
      `Hey <b>${name}</b> \u{1F44B}\n\n` +
        "Welcome to <b>Quadfather</b> — your personal nutrition tracker.\n\n" +
        "<b>Commands:</b>\n" +
        "/today — today's macros &amp; hydration\n" +
        "/log — log a meal\n" +
        "/water — track water\n" +
        "/trends — view your progress\n" +
        "/goals — manage your goals\n" +
        "/key — set up your AI API key\n" +
        "/help — show this list\n\n" +
        "Or just <b>send a photo</b> of your meal and I'll analyse the macros.",
      { parse_mode: "HTML", reply_markup: appButton("Open Quadfather", "") },
    );
  });

  bot.command("help", async (ctx) => {
    await ctx.reply(
      "<b>Quadfather commands</b>\n\n" +
        "/today — today's calorie, protein &amp; water summary\n" +
        "/log — open the meal logger (scan, text, or manual)\n" +
        "/water — open the water tracker\n" +
        "/trends — view 7-day &amp; 30-day progress charts\n" +
        "/goals — update your daily calorie, protein &amp; water goals\n" +
        "/key — set or update your AI API key\n\n" +
        "\u{1F4F8} <b>Send a photo</b> of your meal for AI macro analysis\n" +
        "\u{270F}\u{FE0F} <b>Text mode</b> — describe a meal in words and get estimated macros\n" +
        "\u{1F4A1} <b>AI Suggestions</b> — get meal ideas that fit your remaining daily budget",
      { parse_mode: "HTML" },
    );
  });

  bot.command("today", async (ctx) => {
    const data = await getSummary(ctx.from!.id);

    if (!data) {
      await ctx.reply(
        "Couldn't fetch your data. Make sure you've opened the app at least once.",
        { reply_markup: appButton("Open Quadfather", "") },
      );
      return;
    }

    const { calories: cal, protein: pro, water: wat } = data;
    const calPct = cal.goal ? Math.round((cal.total / cal.goal) * 100) : 0;
    const proPct = pro.goal ? Math.round((pro.total / pro.goal) * 100) : 0;
    const watPct = wat.goal ? Math.round((wat.total / wat.goal) * 100) : 0;

    await ctx.reply(
      "\u{1F4CA} <b>Today's summary</b>\n\n" +
        `\u{1F525} <b>Calories</b>  ${cal.total} / ${cal.goal} kcal  (${calPct}%)\n` +
        `<code>${progressBar(cal.total, cal.goal)}</code>\n\n` +
        `\u{1F4AA} <b>Protein</b>   ${pro.total}g / ${pro.goal}g  (${proPct}%)\n` +
        `<code>${progressBar(pro.total, pro.goal)}</code>\n\n` +
        `\u{1F4A7} <b>Water</b>     ${wat.total}L / ${wat.goal}L  (${watPct}%)\n` +
        `<code>${progressBar(wat.total, wat.goal)}</code>\n\n` +
        `\u{1F37D} <b>${data.meals_logged}</b> meal${data.meals_logged !== 1 ? "s" : ""} logged today`,
      { parse_mode: "HTML", reply_markup: appButton("Open Quadfather", "") },
    );
  });

  bot.command("log", async (ctx) => {
    await ctx.reply(
      "Ready to log a meal?\n\nYou can <b>scan a photo</b> for AI macro analysis or add it manually.",
      {
        parse_mode: "HTML",
        reply_markup: appButton("Log a Meal \u{1F37D}", "/food"),
      },
    );
  });

  bot.command("water", async (ctx) => {
    const data = await getSummary(ctx.from!.id);
    let text: string;
    if (data) {
      const { water: wat } = data;
      const watPct = wat.goal ? Math.round((wat.total / wat.goal) * 100) : 0;
      text =
        `\u{1F4A7} <b>Water today:</b> ${wat.total}L / ${wat.goal}L  (${watPct}%)\n` +
        `<code>${progressBar(wat.total, wat.goal)}</code>\n\n` +
        "Tap below to log your next bottle.";
    } else {
      text =
        "Staying hydrated? Use the app to tap your way to your daily goal.";
    }
    await ctx.reply(text, {
      parse_mode: "HTML",
      reply_markup: appButton("Track Water \u{1F4A7}", "/water"),
    });
  });

  bot.command("trends", async (ctx) => {
    await ctx.reply(
      "\u{1F4C8} See how your nutrition and hydration have tracked over the last 7 or 30 days.",
      {
        parse_mode: "HTML",
        reply_markup: appButton("View Trends \u{1F4C8}", "/analytics"),
      },
    );
  });

  bot.command("goals", async (ctx) => {
    await ctx.reply(
      "\u{2699}\u{FE0F} Update your daily calorie, protein, and water goals.",
      {
        parse_mode: "HTML",
        reply_markup: appButton("Manage Goals \u{2699}\u{FE0F}", "/profile"),
      },
    );
  });

  bot.command("key", async (ctx) => {
    const ai = await getUserAI(ctx.from!.id);
    let status = "";
    if (ai) {
      status = `\u{2705} You currently have a <b>${ai.provider}</b> key set.\n\n`;
    }

    await ctx.reply(
      status +
        "Send your API key in this format:\n\n" +
        "<code>openai sk-abc123...</code>\n" +
        "<code>anthropic sk-ant-...</code>\n" +
        "<code>gemini AIza...</code>\n\n" +
        "I'll store it securely and delete your message.",
      { parse_mode: "HTML" },
    );
  });

  bot.on("message:text", async (ctx) => {
    const text = ctx.message!.text!.trim();
    const match = text.match(
      /^(openai|anthropic|gemini)\s+(\S+)$/i,
    );
    if (!match) return;

    const provider = match[1].toLowerCase() as AIProvider;
    const apiKey = match[2];

    if (!VALID_PROVIDERS.includes(provider)) return;
    if (apiKey.length < 10) {
      await ctx.reply("That key looks too short. Please try again.");
      return;
    }

    try {
      await ctx.api.deleteMessage(ctx.chat!.id, ctx.message!.message_id);
    } catch {
      // may fail if bot lacks delete permission
    }

    try {
      const encrypted = encrypt(apiKey);
      await prisma.user.updateMany({
        where: { telegram_id: ctx.from!.id },
        data: { ai_provider: provider, ai_api_key: encrypted },
      });

      await ctx.reply(
        `\u{1F511} <b>${provider}</b> key saved successfully!\n\n` +
          "You can now send photos for AI analysis or use /key to update it.",
        { parse_mode: "HTML" },
      );
    } catch {
      await ctx.reply(
        "Something went wrong saving your key. Make sure you've opened the app at least once, then try again.",
      );
    }
  });

  bot.on("message:photo", async (ctx) => {
    const ai = await getUserAI(ctx.from!.id);
    if (!ai) {
      await ctx.reply(
        "You need to set up an API key first.\n\nUse /key to get started.",
      );
      return;
    }

    const thinking = await ctx.reply("\u{1F50D} Analysing your meal\u{2026}");
    try {
      const photos = ctx.message!.photo!;
      const fileId = photos[photos.length - 1].file_id;
      const file = await ctx.api.getFile(fileId);
      const fileUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${file.file_path}`;

      const res = await fetch(fileUrl);
      const imageBytes = Buffer.from(await res.arrayBuffer());

      const result = await analyseMeal(
        ai.provider,
        ai.apiKey,
        imageBytes,
        "image/jpeg",
        ctx.message!.caption ?? "",
      );

      const confidenceEmoji: Record<string, string> = {
        high: "\u{1F7E2}",
        medium: "\u{1F7E1}",
        low: "\u{1F534}",
      };

      let text =
        `<b>${result.food_name}</b>\n\n` +
        `\u{1F525} <b>Calories:</b> ${result.calories} kcal\n` +
        `\u{1F4AA} <b>Protein:</b> ${result.protein}g\n` +
        `\u{1F33E} <b>Carbs:</b> ${result.carbohydrates}g\n` +
        `\u{1F9C8} <b>Fats:</b> ${result.fats}g\n\n` +
        `${confidenceEmoji[result.confidence] ?? "\u{1F7E1}"} ${result.confidence.charAt(0).toUpperCase() + result.confidence.slice(1)} confidence`;

      if (result.notes) {
        text += `\n<i>${result.notes}</i>`;
      }
      text += "\n\nOpen the app to log this meal or adjust the values.";

      await ctx.api.deleteMessage(ctx.chat!.id, thinking.message_id);
      await ctx.reply(text, {
        parse_mode: "HTML",
        reply_markup: appButton("Log This Meal \u{1F37D}", "/food"),
      });
    } catch {
      await ctx.api.editMessageText(
        ctx.chat!.id,
        thinking.message_id,
        "Sorry, I couldn't analyse that photo right now. Try again or log it manually.",
        { reply_markup: appButton("Log Manually", "/food") },
      );
    }
  });
}
