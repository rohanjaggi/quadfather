import { Bot, InlineKeyboard, type Context } from "grammy";
import { prisma } from "./prisma";
import { analyseMeal, parseFood } from "./ai";
import type { MealAnalysisResult } from "./ai";
import type { AIProvider } from "./models";
import { findUserAICredentials } from "./auth";
import { encrypt } from "./crypto";
import { escapeHtml } from "./html";
import { getDailyBudget } from "./budget";
import { buildDailyCoach, buildWeeklyInsights } from "./coach";
import { dayRange } from "./day";

const BOT_TOKEN = process.env.BOTFATHER_TOKEN ?? "";

/** Mini App base URL for inline buttons. Unset: log once and omit the buttons; in-chat commands still work. */
const MINI_APP_URL = process.env.MINI_APP_URL ?? "";
if (!MINI_APP_URL) {
  console.error(
    "MINI_APP_URL is not set — Telegram inline buttons that open the Mini App will be omitted.",
  );
}

let _bot: Bot | null = null;

export function getBot(): Bot {
  if (_bot) return _bot;
  _bot = new Bot(BOT_TOKEN);
  _bot.catch(async (err) => {
    console.error("Bot error:", err);
    // Reached via `bot.handleUpdates` (long-polling) and the webhook route's explicit `bot.errorHandler(err)`.
    try {
      await err.ctx.reply(
        "Something went wrong handling that. Please try again in a moment.",
      );
    } catch (replyErr) {
      console.error("Bot error: could not notify the user:", replyErr);
    }
  });
  registerHandlers(_bot);
  return _bot;
}

/** Push an HTML message to a user outside any chat update (the crons). */
export async function sendHtml(
  telegramId: bigint,
  html: string,
  reply_markup?: InlineKeyboard,
): Promise<void> {
  await getBot().api.sendMessage(Number(telegramId), html, { parse_mode: "HTML", reply_markup });
}

/** `undefined` when `MINI_APP_URL` is unset — grammY then sends no keyboard. */
function appButton(label: string, path: string = ""): InlineKeyboard | undefined {
  if (!MINI_APP_URL) return undefined;
  return new InlineKeyboard().webApp(label, `${MINI_APP_URL}${path}`);
}

const CLOSE_DAY_OK = "close_day:ok";

/** The evening summary's buttons: "Looks right" only when there is a day to confirm; the Log sheet only with `MINI_APP_URL`. */
export function closeDayKeyboard(hasLogs: boolean): InlineKeyboard | undefined {
  if (!hasLogs) return appButton("I forgot something", "/?sheet=log");
  const keyboard = new InlineKeyboard().text("Looks right \u{2713}", CLOSE_DAY_OK);
  return MINI_APP_URL ? keyboard.webApp("I forgot something", `${MINI_APP_URL}/?sheet=log`) : keyboard;
}

function progressBar(current: number, goal: number, width = 10): string {
  const filled =
    goal > 0 ? Math.round(Math.min(current / goal, 1.0) * width) : 0;
  return "\u{2588}".repeat(filled) + "\u{2591}".repeat(width - filled);
}

/** Today's headline numbers from the canonical daily budget, so the bot agrees with the dashboard. */
async function getSummary(telegramId: number) {
  const user = await prisma.user.findUnique({
    where: { telegram_id: telegramId },
  });
  if (!user) return null;

  const budget = await getDailyBudget(user);

  return {
    calories: {
      total: Math.round(budget.food.calories),
      goal: Math.round(budget.total_goal),
    },
    protein: {
      total: Math.round(budget.food.protein * 10) / 10,
      goal: Math.round(user.daily_protein_goal * 10) / 10,
    },
    water: {
      total: Math.round(budget.water_liters * 100) / 100,
      goal: Math.round(user.daily_water_goal * 100) / 100,
    },
    meals_logged: budget.food.meals_logged,
  };
}

/** `FoodLog.food_name` is VarChar(100), `source` VarChar(20); mirrors the bounds POST /api/foods enforces. */
const MAX_NAME = 100;
const MAX_SOURCE = 20;
const MAX_MACRO = 100_000;

function clampMacro(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(Math.max(value, 0), MAX_MACRO);
}

/** Row payload for a bot-side `FoodLog.create`; the bot bypasses POST /api/foods, so bounds are applied here. */
function foodLogData(
  userId: number,
  result: MealAnalysisResult,
  source: string,
  rawTextInput?: string,
) {
  return {
    user_id: userId,
    food_name: result.food_name.slice(0, MAX_NAME),
    calories: clampMacro(result.calories),
    protein: clampMacro(result.protein),
    carbohydrates: clampMacro(result.carbohydrates),
    fats: clampMacro(result.fats),
    fiber: clampMacro(result.fiber),
    ...(rawTextInput !== undefined ? { raw_text_input: rawTextInput } : {}),
    source: source.slice(0, MAX_SOURCE),
  };
}

const CONFIDENCE_EMOJI: Record<string, string> = {
  high: "\u{1F7E2}",
  medium: "\u{1F7E1}",
  low: "\u{1F534}",
};

/** Both renderings of a "meal logged" confirmation: HTML, and plain text for when Telegram rejects the HTML. */
function mealConfirmation(result: MealAnalysisResult): {
  html: string;
  plain: string;
} {
  const emoji = CONFIDENCE_EMOJI[result.confidence] ?? "\u{1F7E1}";
  const macros =
    `\u{1F525} ${result.calories} kcal\n` +
    `\u{1F4AA} ${result.protein}g protein\n` +
    `\u{1F33E} ${result.carbohydrates}g carbs\n` +
    `\u{1F9C8} ${result.fats}g fats\n\n`;

  const html =
    `\u{2705} <b>Logged: ${escapeHtml(result.food_name)}</b>\n\n` +
    macros +
    `${emoji} ${escapeHtml(result.confidence)} confidence` +
    (result.notes ? `\n<i>${escapeHtml(result.notes)}</i>` : "");

  const plain =
    `\u{2705} Logged: ${result.food_name}\n\n` +
    macros +
    `${emoji} ${result.confidence} confidence` +
    (result.notes ? `\n${result.notes}` : "");

  return { html, plain };
}

/**
 * Telegram rejects message bodies over 4096 characters. Exported because the cron
 * digests send AI prose with no placeholder to fall back on.
 */
export const TELEGRAM_TEXT_LIMIT = 4000;

export function clamp(text: string, limit: number = TELEGRAM_TEXT_LIMIT): string {
  return text.length > limit ? `${text.slice(0, limit - 1)}\u{2026}` : text;
}

/** `clamp` for an already-escaped body: drops a dangling partial entity ("&am") at the cut, which Telegram 400s on. */
export function clampHtml(text: string, limit: number = TELEGRAM_TEXT_LIMIT): string {
  if (text.length <= limit) return text;
  const head = text.slice(0, limit - 1).replace(/&[a-zA-Z#0-9]{0,9}$/, "");
  return `${head}\u{2026}`;
}

/**
 * Replace a "thinking…" placeholder: HTML edit, then plain edit, then a fresh reply
 * (deleting the placeholder). Failures are swallowed so a Telegram error never
 * looks like the work failed.
 */
async function deliverText(
  ctx: Context,
  messageId: number,
  html: string,
  plain: string,
): Promise<void> {
  const chatId = ctx.chat!.id;
  const htmlText = clamp(html);
  const plainText = clamp(plain);

  try {
    await ctx.api.editMessageText(chatId, messageId, htmlText, {
      parse_mode: "HTML",
    });
    return;
  } catch (err) {
    console.error("Delivery edit (HTML) failed:", err);
  }

  try {
    await ctx.api.editMessageText(chatId, messageId, plainText);
    return;
  } catch (err) {
    console.error("Delivery edit (plain) failed:", err);
  }

  try {
    await ctx.reply(plainText);
  } catch (err) {
    console.error("Delivery reply failed:", err);
    return;
  }

  // Delete the placeholder only after the reply landed, so a failure can't leave the user with nothing.
  try {
    await ctx.api.deleteMessage(chatId, messageId);
  } catch (err) {
    console.error("Placeholder cleanup failed:", err);
  }
}

/** Best-effort message edit — used for error paths that must not throw. */
async function safeEdit(
  ctx: Context,
  messageId: number,
  text: string,
  extra?: Parameters<Context["api"]["editMessageText"]>[3],
): Promise<void> {
  try {
    await ctx.api.editMessageText(ctx.chat!.id, messageId, text, extra);
  } catch (err) {
    console.error("Message edit failed:", err);
  }
}

/** The sender's account row, or null after telling them to open the Mini App (only it creates the row). */
async function requireUser(ctx: Context) {
  const user = await prisma.user.findUnique({
    where: { telegram_id: ctx.from!.id },
  });
  if (!user) {
    await ctx.reply(
      "You need to open the app first to set up your account.",
      { reply_markup: appButton("Open Quadfather", "") },
    );
  }
  return user;
}

/** `requireUser` plus an AI key (the user's own or the shared server key). */
async function requireUserAI(ctx: Context) {
  const user = await requireUser(ctx);
  if (!user) return null;
  const ai = findUserAICredentials(user);
  if (!ai) {
    await ctx.reply(
      "You need to set up an API key first.\n\nUse /key to get started.",
    );
    return null;
  }
  return { user, ai };
}

function registerHandlers(bot: Bot) {
  bot.command("start", async (ctx) => {
    const name = ctx.from?.first_name ?? "there";
    await ctx.reply(
      `Hey <b>${escapeHtml(name)}</b> \u{1F44B}\n\n` +
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
        "\u{270F}\u{FE0F} Type /log_meal <code>chicken rice broccoli</code> to log via text\n" +
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
        "/trends — 7-day &amp; 30-day charts for food &amp; exercise\n" +
        "/goals — update daily targets &amp; personal info\n\n" +
        "\u{1F916} <b>AI features (requires API key):</b>\n" +
        "\u{1F4F8} Send a <b>photo</b> — auto-analyses &amp; logs macros\n" +
        "\u{270F}\u{FE0F} <code>/log_meal</code> — text-based macro estimation\n" +
        "\u{1F4A1} In-app meal suggestions based on remaining budget\n\n" +
        "\u{2699}\u{FE0F} <b>Setup:</b>\n" +
        "/key — set or update your AI API key\n" +
        "Format: <code>openai sk-...</code> or <code>anthropic sk-ant-...</code> or <code>gemini AIza...</code>\n\n" +
        "\u{1F3C3} <b>Running:</b>\n" +
        "Log runs manually or via screenshot. Calories burned can be added to your daily allowance.",
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
        // No MINI_APP_URL means no button; point at the in-chat command.
        (MINI_APP_URL
          ? "Tap below to log your next bottle."
          : "Use /log_water to log your next bottle.");
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
    const user = await requireUser(ctx);
    if (!user) return;

    const bottleSize = user.water_bottle_size;
    await prisma.waterLog.create({
      data: {
        user_id: user.id,
        amount_liters: bottleSize,
        bottles: 1,
        water_bottle_size: bottleSize,
      },
    });

    // Everything below is presentation; a failure must not reach `bot.catch`, whose "try again" made users double-log.
    try {
      const todayLogs = await prisma.waterLog.findMany({
        where: { user_id: user.id, logged_at: { gte: dayRange().start } },
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
    } catch (err) {
      console.error("/log_water confirmation failed:", err);
      try {
        await ctx.reply(`\u{1F4A7} +${bottleSize}L logged`);
      } catch (replyErr) {
        console.error("/log_water fallback reply failed:", replyErr);
      }
    }
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

    const found = await requireUserAI(ctx);
    if (!found) return;
    const { user, ai } = found;

    const thinking = await ctx.reply("\u{1F50D} Analysing...");

    let result: MealAnalysisResult;
    try {
      result = await parseFood(ai, description);

      await prisma.foodLog.create({
        data: foodLogData(user.id, result, ai.provider, description),
      });
    } catch (err) {
      console.error("/log_meal failed:", err);
      await safeEdit(
        ctx,
        thinking.message_id,
        "Sorry, I couldn't analyse that. Try again or log manually in the app.",
        { reply_markup: appButton("Log Manually", "/food") },
      );
      return;
    }

    // The meal is logged; a failure from here must never say "try again".
    const { html, plain } = mealConfirmation(result);
    await deliverText(ctx, thinking.message_id, html, plain);
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
    const user = await requireUser(ctx);
    if (!user) return;
    const ai = findUserAICredentials(user);
    // The lookup falls back to the shared key, so also check the user's own.
    let status = "";
    if (ai && user.ai_provider && user.ai_api_key) {
      status = `\u{2705} You're using <b>your own ${escapeHtml(ai.provider)}</b> key.\n\n`;
    } else if (ai) {
      status =
        `\u{2139}\u{FE0F} You haven't set a key, so you're on the <b>shared server key</b> ` +
        `(${escapeHtml(ai.provider)}). Send your own below to use it instead.\n\n`;
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

  bot.command("coach", async (ctx) => {
    const found = await requireUserAI(ctx);
    if (!found) return;
    const { user, ai } = found;

    const thinking = await ctx.reply("\u{1F9E0} Thinking...");

    try {
      // Canonical budget, as on the dashboard and the evening summary.
      const budget = await getDailyBudget(user);

      if (budget.logs.food.length === 0) {
        await safeEdit(ctx, thinking.message_id, "Log some meals first and I'll give you coaching tips!");
        return;
      }

      const message = await buildDailyCoach(user, ai, budget);

      await deliverText(
        ctx,
        thinking.message_id,
        `\u{1F4AC} <b>Daily Coach</b>\n\n${escapeHtml(message)}`,
        `\u{1F4AC} Daily Coach\n\n${message}`,
      );
    } catch (err) {
      console.error("/coach failed:", err);
      await safeEdit(ctx, thinking.message_id, "Sorry, couldn't generate coaching right now. Try again later.");
    }
  });

  bot.command("insights", async (ctx) => {
    const found = await requireUserAI(ctx);
    if (!found) return;
    const { user, ai } = found;

    const thinking = await ctx.reply("\u{1F4CA} Analysing your week...");

    try {
      const insights = await buildWeeklyInsights(user, ai);

      if (insights === null) {
        await safeEdit(ctx, thinking.message_id, "Not enough data yet \u{2014} log meals for a few days and try again!");
        return;
      }

      await deliverText(
        ctx,
        thinking.message_id,
        `\u{1F4CA} <b>Weekly Insights</b>\n\n${escapeHtml(insights)}`,
        `\u{1F4CA} Weekly Insights\n\n${insights}`,
      );
    } catch (err) {
      console.error("/insights failed:", err);
      await safeEdit(ctx, thinking.message_id, "Sorry, couldn't generate insights right now. Try again later.");
    }
  });

  bot.callbackQuery(CLOSE_DAY_OK, async (ctx) => {
    await ctx.answerCallbackQuery();
    const msg = ctx.callbackQuery.message;
    // An inaccessible (e.g. deleted) message has no text to append to; the tap is still acknowledged above.
    if (!msg || !("text" in msg) || !msg.text) return;
    try {
      // Appending keeps the original entities' offsets valid; no reply_markup removes the keyboard.
      await ctx.editMessageText(`${msg.text}\n\nDay closed. See you tomorrow.`, {
        entities: msg.entities,
      });
    } catch (err) {
      // A double tap lands here ("message is not modified"); nothing for the user to retry.
      console.error("Close the day edit failed:", err);
    }
  });

  bot.on("message:text", async (ctx) => {
    const text = ctx.message!.text!.trim();
    const match = text.match(
      /^(openai|anthropic|gemini)\s+(\S+)$/i,
    );
    if (!match) return;

    const provider = match[1].toLowerCase() as AIProvider;
    const apiKey = match[2];

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
      // Key is encrypted at rest; the model is cleared so a stale one can't 404 every call.
      const encrypted = encrypt(apiKey);
      const { count } = await prisma.user.updateMany({
        where: { telegram_id: ctx.from!.id },
        data: { ai_provider: provider, ai_api_key: encrypted, ai_model: null },
      });

      if (count === 0) {
        // Only the mini-app creates the account row, so telling users to /start would loop.
        await ctx.reply(
          MINI_APP_URL
            ? "I couldn't find your account \u{2014} open the app once (button below), then send your key again."
            : "I couldn't find your account \u{2014} open the Mini App once, then send your key again.",
          { reply_markup: appButton("Open Quadfather", "") },
        );
        return;
      }

      await ctx.reply(
        `\u{1F511} <b>${escapeHtml(provider)}</b> key saved successfully!\n\n` +
          "You can now send photos for AI analysis or use /key to update it.",
        { parse_mode: "HTML" },
      );
    } catch (err) {
      console.error("Key save failed:", err);
      await ctx.reply(
        "Something went wrong saving your key. Make sure you've opened the app at least once, then try again.",
      );
    }
  });

  bot.on("message:photo", async (ctx) => {
    const found = await requireUserAI(ctx);
    if (!found) return;
    const { user, ai } = found;

    const thinking = await ctx.reply("\u{1F50D} Analysing your meal\u{2026}");

    let result: MealAnalysisResult;
    try {
      const photos = ctx.message!.photo!;
      const fileId = photos[photos.length - 1].file_id;
      const file = await ctx.api.getFile(fileId);
      const fileUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${file.file_path}`;

      const res = await fetch(fileUrl);
      if (!res.ok) {
        throw new Error(
          `Telegram file download failed: ${res.status} ${res.statusText}`,
        );
      }
      const base64 = Buffer.from(await res.arrayBuffer()).toString("base64");

      result = await analyseMeal(
        ai,
        { base64, mimeType: "image/jpeg" },
        ctx.message!.caption ?? "",
      );

      // Auto-log the meal
      await prisma.foodLog.create({
        data: foodLogData(user.id, result, ai.provider),
      });
    } catch (err) {
      console.error("Photo meal analysis failed:", err);
      await safeEdit(
        ctx,
        thinking.message_id,
        "Sorry, I couldn't analyse that photo. Try again or log manually.",
        { reply_markup: appButton("Log Manually", "/food") },
      );
      return;
    }

    // The meal is logged; a failure from here must never say "try again".
    const { html, plain } = mealConfirmation(result);
    await deliverText(ctx, thinking.message_id, html, plain);
  });
}

export async function setupBotCommands() {
  await getBot().api.setMyCommands([
    { command: "log_water", description: "Log one bottle of water instantly" },
    { command: "log_meal", description: "Log a meal from text description" },
    { command: "today", description: "View today's macros & hydration" },
    { command: "log", description: "Open the meal logger" },
    { command: "water", description: "Open the water tracker" },
    { command: "trends", description: "View your progress charts" },
    { command: "goals", description: "Update your daily goals" },
    { command: "coach", description: "Get today's AI coaching tip" },
    { command: "insights", description: "Get AI weekly pattern analysis" },
    { command: "key", description: "Set up your AI API key" },
    { command: "help", description: "Show all commands" },
  ]);
}
