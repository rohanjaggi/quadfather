import { Bot, InlineKeyboard } from "grammy";
import { prisma } from "./prisma";
import { analyseMeal, parseFood, type AIProvider } from "./ai";
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
        "Welcome to <b>Quadfather</b> — your personal nutrition &amp; fitness tracker.\n\n" +
        "\u{1F3AF} <b>Get started in 3 steps:</b>\n\n" +
        "<b>1. Set up your profile</b>\n" +
        "Open the app and go to Settings \u{2192} Personal Info. Enter your weight, height, age, activity level, and fitness goal. This calculates your daily calorie and macro targets.\n\n" +
        "<b>2. Add your AI key</b>\n" +
        "For photo &amp; text meal analysis, you need an API key. Send it here:\n" +
        "<code>openai sk-abc123...</code>\n" +
        "<code>anthropic sk-ant-...</code>\n" +
        "<code>gemini AIza...</code>\n\n" +
        "<b>3. Start logging</b>\n" +
        "\u{1F4F8} Send a <b>photo</b> of your meal — I'll estimate the macros and log it\n" +
        "\u{270F}\u{FE0F} Type <code>/log_meal chicken rice broccoli</code> to log via text\n" +
        "\u{1F4A7} Type /log_water to quickly log a bottle\n\n" +
        "Type /help anytime to see all commands.",
      { parse_mode: "HTML", reply_markup: appButton("Open Quadfather", "") },
    );
  });

  bot.command("help", async (ctx) => {
    await ctx.reply(
      "<b>Quadfather — Commands</b>\n\n" +
        "\u{1F4CB} <b>Quick actions (in chat):</b>\n" +
        "/log_meal <i>description</i> — log a meal from text\n" +
        "/log_water — log one bottle of water instantly\n" +
        "/today — see today's calorie, protein &amp; water progress\n\n" +
        "\u{1F4F1} <b>Open the app:</b>\n" +
        "/log — meal logger (photo scan, text, or manual)\n" +
        "/water — water tracker\n" +
        "/trends — 7-day &amp; 30-day charts for food &amp; running\n" +
        "/goals — update daily targets &amp; personal info\n\n" +
        "\u{1F916} <b>AI features (requires API key):</b>\n" +
        "\u{1F4F8} Send a <b>photo</b> — auto-analyses &amp; logs macros\n" +
        "\u{270F}\u{FE0F} <code>/log_meal</code> — text-based macro estimation\n" +
        "\u{1F4A1} In-app meal suggestions based on remaining budget\n\n" +
        "\u{2699}\u{FE0F} <b>Setup:</b>\n" +
        "/key — set or update your AI API key\n" +
        "Format: <code>openai sk-...</code> or <code>anthropic sk-ant-...</code> or <code>gemini AIza...</code>\n\n" +
        "\u{1F3C3} <b>Running:</b>\n" +
        "Connect Strava in Settings to auto-sync runs. Calories burned can be added to your daily allowance.",
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

  bot.command("log_water", async (ctx) => {
    const user = await prisma.user.findUnique({
      where: { telegram_id: ctx.from!.id },
    });
    if (!user) {
      await ctx.reply(
        "You need to open the app first to set up your account.",
        { reply_markup: appButton("Open Quadfather", "") },
      );
      return;
    }

    const bottleSize = user.water_bottle_size;
    await prisma.waterLog.create({
      data: {
        user_id: user.id,
        amount_liters: bottleSize,
        bottles: 1,
        water_bottle_size: bottleSize,
      },
    });

    // Get today's total
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const todayLogs = await prisma.waterLog.findMany({
      where: { user_id: user.id, logged_at: { gte: todayStart } },
    });
    const totalLiters = todayLogs.reduce((s, l) => s + l.amount_liters, 0);
    const pct = user.daily_water_goal > 0
      ? Math.round((totalLiters / user.daily_water_goal) * 100)
      : 0;

    await ctx.reply(
      `\u{1F4A7} <b>+${bottleSize}L logged</b>\n\n` +
        `Total today: ${totalLiters.toFixed(1)}L / ${user.daily_water_goal}L (${pct}%)`,
      { parse_mode: "HTML" },
    );
  });

  bot.command("log_meal", async (ctx) => {
    const description = ctx.match?.trim();
    if (!description) {
      await ctx.reply(
        "Describe your meal after the command.\n\n" +
          "Example: <code>/log_meal chicken breast with rice and broccoli</code>",
        { parse_mode: "HTML" },
      );
      return;
    }

    const ai = await getUserAI(ctx.from!.id);
    if (!ai) {
      await ctx.reply(
        "You need to set up an API key first.\n\nUse /key to get started.",
      );
      return;
    }

    const user = await prisma.user.findUnique({
      where: { telegram_id: ctx.from!.id },
    });
    if (!user) {
      await ctx.reply(
        "You need to open the app first to set up your account.",
        { reply_markup: appButton("Open Quadfather", "") },
      );
      return;
    }

    const thinking = await ctx.reply("\u{1F50D} Analysing...");

    try {
      const result = await parseFood(ai.provider, ai.apiKey, description);

      await prisma.foodLog.create({
        data: {
          user_id: user.id,
          food_name: result.food_name,
          calories: result.calories,
          protein: result.protein,
          carbohydrates: result.carbohydrates,
          fats: result.fats,
          fiber: result.fiber,
          raw_text_input: description,
          source: ai.provider,
        },
      });

      const confidenceEmoji: Record<string, string> = {
        high: "\u{1F7E2}",
        medium: "\u{1F7E1}",
        low: "\u{1F534}",
      };

      await ctx.api.editMessageText(
        ctx.chat!.id,
        thinking.message_id,
        `\u{2705} <b>Logged: ${result.food_name}</b>\n\n` +
          `\u{1F525} ${result.calories} kcal\n` +
          `\u{1F4AA} ${result.protein}g protein\n` +
          `\u{1F33E} ${result.carbohydrates}g carbs\n` +
          `\u{1F9C8} ${result.fats}g fats\n\n` +
          `${confidenceEmoji[result.confidence] ?? "\u{1F7E1}"} ${result.confidence} confidence` +
          (result.notes ? `\n<i>${result.notes}</i>` : ""),
        { parse_mode: "HTML" },
      );
    } catch {
      await ctx.api.editMessageText(
        ctx.chat!.id,
        thinking.message_id,
        "Sorry, I couldn't analyse that. Try again or log manually in the app.",
        { reply_markup: appButton("Log Manually", "/food") },
      );
    }
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

    const user = await prisma.user.findUnique({
      where: { telegram_id: ctx.from!.id },
    });
    if (!user) {
      await ctx.reply(
        "You need to open the app first to set up your account.",
        { reply_markup: appButton("Open Quadfather", "") },
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

      // Auto-log the meal
      await prisma.foodLog.create({
        data: {
          user_id: user.id,
          food_name: result.food_name,
          calories: result.calories,
          protein: result.protein,
          carbohydrates: result.carbohydrates,
          fats: result.fats,
          fiber: result.fiber,
          source: ai.provider,
        },
      });

      const confidenceEmoji: Record<string, string> = {
        high: "\u{1F7E2}",
        medium: "\u{1F7E1}",
        low: "\u{1F534}",
      };

      let text =
        `\u{2705} <b>Logged: ${result.food_name}</b>\n\n` +
        `\u{1F525} ${result.calories} kcal\n` +
        `\u{1F4AA} ${result.protein}g protein\n` +
        `\u{1F33E} ${result.carbohydrates}g carbs\n` +
        `\u{1F9C8} ${result.fats}g fats\n\n` +
        `${confidenceEmoji[result.confidence] ?? "\u{1F7E1}"} ${result.confidence} confidence`;

      if (result.notes) {
        text += `\n<i>${result.notes}</i>`;
      }

      await ctx.api.deleteMessage(ctx.chat!.id, thinking.message_id);
      await ctx.reply(text, { parse_mode: "HTML" });
    } catch {
      await ctx.api.editMessageText(
        ctx.chat!.id,
        thinking.message_id,
        "Sorry, I couldn't analyse that photo. Try again or log manually.",
        { reply_markup: appButton("Log Manually", "/food") },
      );
    }
  });
}

export async function setupBotCommands() {
  const bot = initBot();
  await bot.api.setMyCommands([
    { command: "log_water", description: "Log one bottle of water instantly" },
    { command: "log_meal", description: "Log a meal from text description" },
    { command: "today", description: "View today's macros & hydration" },
    { command: "log", description: "Open the meal logger" },
    { command: "water", description: "Open the water tracker" },
    { command: "trends", description: "View your progress charts" },
    { command: "goals", description: "Update your daily goals" },
    { command: "key", description: "Set up your AI API key" },
    { command: "help", description: "Show all commands" },
  ]);
}
