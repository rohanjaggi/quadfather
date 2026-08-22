import { Bot, InlineKeyboard, type Context } from "grammy";
import { prisma } from "./prisma";
import { analyseMeal, parseFood } from "./ai";
import type { MealAnalysisResult } from "./ai";
import type { AIProvider } from "./models";
import { encrypt, decrypt } from "./crypto";
import { escapeHtml } from "./html";
import { getDailyBudget, startOfUtcDay } from "./budget";

const BOT_TOKEN = process.env.BOTFATHER_TOKEN ?? "";

/**
 * Base URL for the Mini App the inline buttons open. There is no sensible
 * default: the old `https://your-app.vercel.app` placeholder produced buttons
 * that opened a stranger's domain (or nothing) with no error anywhere. When it
 * is unset we complain once at module load and simply omit the buttons — the
 * bot's in-chat commands (/today, /log_meal, /log_water, /coach, /insights)
 * keep working.
 */
const MINI_APP_URL = process.env.MINI_APP_URL ?? "";
if (!MINI_APP_URL) {
  console.error(
    "MINI_APP_URL is not set — Telegram inline buttons that open the Mini App will be omitted.",
  );
}

const VALID_PROVIDERS: AIProvider[] = ["openai", "anthropic", "gemini"];

const DAY_MS = 86400000;

let _bot: Bot | null = null;

function initBot(): Bot {
  if (_bot) return _bot;
  _bot = new Bot(BOT_TOKEN);
  _bot.catch(async (err) => {
    console.error("Bot error:", err);
    // Reached via `bot.handleUpdates` when long-polling, and via the explicit
    // `bot.errorHandler(err)` call the webhook route makes after
    // `handleUpdate` rejects — that is what keeps this reply user-visible even
    // though the webhook has already acknowledged Telegram.
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

export function getBot(): Bot {
  return initBot();
}

/** `undefined` when `MINI_APP_URL` is unset — grammY then sends no keyboard. */
function appButton(label: string, path: string = ""): InlineKeyboard | undefined {
  if (!MINI_APP_URL) return undefined;
  return new InlineKeyboard().webApp(label, `${MINI_APP_URL}${path}`);
}

function progressBar(current: number, goal: number, width = 10): string {
  const filled =
    goal > 0 ? Math.round(Math.min(current / goal, 1.0) * width) : 0;
  return "\u{2588}".repeat(filled) + "\u{2591}".repeat(width - filled);
}

/**
 * Today's headline numbers, derived from the canonical daily budget so the bot
 * always agrees with the dashboard (the calorie goal includes the dampened
 * run/workout credit and the step allowance).
 */
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

/**
 * `FoodLog.food_name` is `VarChar(100)` and `source` is `VarChar(20)`; anything
 * past `MAX_MACRO` in a single meal is a model hallucination, not food.
 * Mirrors the bounds POST /api/foods enforces.
 */
const MAX_NAME = 100;
const MAX_SOURCE = 20;
const MAX_MACRO = 100_000;

function clampMacro(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(Math.max(value, 0), MAX_MACRO);
}

/**
 * Row payload for a bot-side `FoodLog.create`.
 *
 * The bot writes to Prisma directly instead of going through POST /api/foods, so
 * none of that route's validation applied: a 120-character AI food name threw a
 * raw Prisma "value too long" *after* the analysis had been paid for, and a
 * hallucinated 9-digit calorie count went straight into the daily totals. Build
 * the row here so both call sites (photo and /log_meal) get the same bounds.
 */
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

/**
 * Build both renderings of a "meal logged" confirmation: the HTML one we
 * normally send, and a plain-text fallback used when Telegram rejects the
 * HTML message. The food log is already written by the time we get here, so
 * the user must never be told the analysis failed.
 */
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
 * Telegram rejects any message body over 4096 characters. Stay clear of the
 * limit — an LLM reply that overshoots must degrade to a truncated message, not
 * to a stuck "Thinking…" placeholder.
 *
 * Exported because the cron digests send AI prose straight to `sendMessage` with
 * no placeholder to fall back on: over the limit, Telegram 400s and the user
 * simply never receives that morning's digest.
 */
export const TELEGRAM_TEXT_LIMIT = 4000;

export function clamp(text: string, limit: number = TELEGRAM_TEXT_LIMIT): string {
  return text.length > limit ? `${text.slice(0, limit - 1)}\u{2026}` : text;
}

/**
 * `clamp` for a string whose body has already been HTML-escaped.
 *
 * A blind slice can land inside an escape sequence ("&am"), and Telegram rejects
 * that with the same 400 the clamp exists to prevent — so drop any dangling
 * partial entity at the cut. Only entities can be split here: the sole raw tags
 * are in the caller's own header, ahead of the escaped body.
 */
export function clampHtml(text: string, limit: number = TELEGRAM_TEXT_LIMIT): string {
  if (text.length <= limit) return text;
  const head = text.slice(0, limit - 1).replace(/&[a-zA-Z#0-9]{0,9}$/, "");
  return `${head}\u{2026}`;
}

/**
 * Replace a "thinking…" placeholder with real content, in three stages:
 * HTML edit → the same text with no `parse_mode` → a fresh plain reply (and
 * then remove the placeholder so it is not left hanging). Every failure is
 * swallowed: callers use this only once the underlying work has succeeded, so
 * a Telegram parse/length error must never look like the work failed.
 */
async function deliverText(
  ctx: Context,
  chatId: number,
  messageId: number,
  html: string,
  plain: string,
): Promise<void> {
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

  // The content landed in a new message, so drop the placeholder. Deleting
  // first would risk leaving the user with nothing if the reply also failed.
  try {
    await ctx.api.deleteMessage(chatId, messageId);
  } catch (err) {
    console.error("Placeholder cleanup failed:", err);
  }
}

/**
 * Deliver a confirmation for something already persisted. The food log is
 * written by the time we get here, so the user must never be told it failed.
 */
async function deliverConfirmation(
  ctx: Context,
  messageId: number,
  html: string,
  plain: string,
): Promise<void> {
  await deliverText(ctx, ctx.chat!.id, messageId, html, plain);
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

interface ResolvedAI {
  provider: AIProvider;
  apiKey: string;
  model: string | null;
  /** `own` = the user's BYOK key; `server` = this deployment's fallback key. */
  source: "own" | "server";
}

async function getUserAI(telegramId: number): Promise<ResolvedAI | null> {
  const user = await prisma.user.findUnique({
    where: { telegram_id: telegramId },
  });
  if (!user) return null;

  if (user.ai_provider && user.ai_api_key) {
    return {
      provider: user.ai_provider as AIProvider,
      apiKey: decrypt(user.ai_api_key),
      model: user.ai_model,
      source: "own",
    };
  }

  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    return { provider: "gemini", apiKey: geminiKey, model: null, source: "server" };
  }

  const openrouterKey = process.env.OPENROUTER_API_KEY;
  if (openrouterKey) {
    return { provider: "openrouter", apiKey: openrouterKey, model: null, source: "server" };
  }

  return null;
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
        // No MINI_APP_URL means `appButton` returns undefined and there is no
        // button to tap — point at the in-chat command instead of at nothing.
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

    // The bottle is saved. Everything below is presentation, so a failure in the
    // running-total query or in Telegram itself must not reach `bot.catch` — its
    // generic "please try again" made users re-tap and log the bottle twice.
    try {
      const todayStart = startOfUtcDay();
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

    let result: MealAnalysisResult;
    try {
      result = await parseFood(ai.provider, ai.apiKey, ai.model, description);

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

    // The meal is logged — from here on a failure must never say "try again".
    const { html, plain } = mealConfirmation(result);
    await deliverConfirmation(ctx, thinking.message_id, html, plain);
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
    // `getUserAI` falls back to this deployment's shared key, so "you have a
    // <provider> key set" was a lie for anyone who had never saved one.
    let status = "";
    if (ai?.source === "own") {
      status = `\u{2705} You're using <b>your own ${escapeHtml(ai.provider)}</b> key.\n\n`;
    } else if (ai?.source === "server") {
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
    const ai = await getUserAI(ctx.from!.id);
    if (!ai) {
      await ctx.reply("You need to set up an API key first.\n\nUse /key to get started.");
      return;
    }

    const user = await prisma.user.findUnique({ where: { telegram_id: ctx.from!.id } });
    if (!user) {
      await ctx.reply("You need to open the app first.", { reply_markup: appButton("Open Quadfather", "") });
      return;
    }

    const thinking = await ctx.reply("\u{1F9E0} Thinking...");

    try {
      // Canonical budget: runs + workouts (dampened) + step allowance, exactly
      // like the dashboard and the daily-coach cron.
      const budget = await getDailyBudget(user);

      if (budget.logs.food.length === 0) {
        await safeEdit(ctx, thinking.message_id, "Log some meals first and I'll give you coaching tips!");
        return;
      }

      const { generateDailyCoach } = await import("./ai");

      const consumed = {
        calories: Math.round(budget.food.calories),
        protein: Math.round(budget.food.protein),
        carbs: Math.round(budget.food.carbohydrates),
        fats: Math.round(budget.food.fats),
      };
      const meals = budget.logs.food.map(l => l.food_name).filter((n): n is string => !!n);
      // Raw burn is what the coach talks about; the dampened credit is already
      // baked into `total_goal` / `remaining`.
      const exerciseCalories = budget.runs_raw + budget.workouts_raw;
      const dietaryRestrictions: string[] = user.dietary_restrictions
        ? JSON.parse(user.dietary_restrictions) : [];

      const message = await generateDailyCoach(ai.provider, ai.apiKey, ai.model, {
        goals: { calories: Math.round(budget.total_goal), protein: user.daily_protein_goal },
        consumed,
        meals,
        waterConsumed: budget.water_liters,
        waterGoal: user.daily_water_goal,
        exerciseCalories,
        dietaryRestrictions,
        // Same shape the daily-coach cron sends. No streak here: it would need
        // a 30-day step history fetch for a single conversational aside.
        steps: {
          today: budget.steps,
          goal: user.daily_step_goal,
          streak: 0,
          extraAllowance: budget.steps_credit,
        },
      });

      await deliverText(
        ctx,
        ctx.chat!.id,
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
    const ai = await getUserAI(ctx.from!.id);
    if (!ai) {
      await ctx.reply("You need to set up an API key first.\n\nUse /key to get started.");
      return;
    }

    const user = await prisma.user.findUnique({ where: { telegram_id: ctx.from!.id } });
    if (!user) {
      await ctx.reply("You need to open the app first.", { reply_markup: appButton("Open Quadfather", "") });
      return;
    }

    const thinking = await ctx.reply("\u{1F4CA} Analysing your week...");

    try {
      // The 7 *complete* previous UTC days: [day-7 00:00, today 00:00).
      // Today is excluded — it is still in progress and would drag averages
      // down. Mirrors /api/cron/weekly-insights.
      const todayStart = startOfUtcDay();
      const weekStart = new Date(todayStart.getTime() - 7 * DAY_MS);

      const [foodLogs, waterLogs, runLogs, workoutLogs] = await Promise.all([
        prisma.foodLog.findMany({ where: { user_id: user.id, logged_at: { gte: weekStart, lt: todayStart } } }),
        prisma.waterLog.findMany({ where: { user_id: user.id, logged_at: { gte: weekStart, lt: todayStart } } }),
        prisma.runLog.findMany({ where: { user_id: user.id, run_date: { gte: weekStart, lt: todayStart } } }),
        // Gym sessions count as exercise too. Without them the bot sent the
        // same prompt as the cron but with runs-only totals, so /insights and
        // the Monday digest disagreed on the same week.
        prisma.workoutLog.findMany({ where: { user_id: user.id, workout_date: { gte: weekStart, lt: todayStart } } }),
      ]);

      if (foodLogs.length === 0) {
        await safeEdit(ctx, thinking.message_id, "Not enough data yet \u{2014} log meals for a few days and try again!");
        return;
      }

      const { generateWeeklyInsights } = await import("./ai");

      const days: { date: string; calories: number; protein: number; water: number }[] = [];
      for (let i = 7; i >= 1; i--) {
        const dayStart = new Date(todayStart.getTime() - i * DAY_MS);
        const dayEnd = new Date(dayStart.getTime() + DAY_MS - 1);
        const dateStr = dayStart.toISOString().split('T')[0];

        const dayFood = foodLogs.filter(l => l.logged_at >= dayStart && l.logged_at <= dayEnd);
        const dayWater = waterLogs.filter(l => l.logged_at >= dayStart && l.logged_at <= dayEnd);

        days.push({
          date: dateStr,
          calories: Math.round(dayFood.reduce((s, l) => s + (l.calories ?? 0), 0)),
          protein: Math.round(dayFood.reduce((s, l) => s + (l.protein ?? 0), 0)),
          water: dayWater.reduce((s, l) => s + l.amount_liters, 0),
        });
      }

      // Runs + gym sessions, over the same [weekStart, todayStart) window —
      // mirrors /api/cron/weekly-insights.
      const exerciseTotal =
        runLogs.reduce((s, r) => s + r.calories_burned, 0) +
        workoutLogs.reduce((s, w) => s + (w.calories_burned ?? 0), 0);
      const exerciseSessions = runLogs.length + workoutLogs.length;
      const dietaryRestrictions: string[] = user.dietary_restrictions
        ? JSON.parse(user.dietary_restrictions) : [];

      const insights = await generateWeeklyInsights(ai.provider, ai.apiKey, ai.model, {
        goals: { calories: user.daily_calorie_goal, protein: user.daily_protein_goal, water: user.daily_water_goal },
        days,
        exerciseTotal,
        exerciseSessions,
        dietaryRestrictions,
      });

      await deliverText(
        ctx,
        ctx.chat!.id,
        thinking.message_id,
        `\u{1F4CA} <b>Weekly Insights</b>\n\n${escapeHtml(insights)}`,
        `\u{1F4CA} Weekly Insights\n\n${insights}`,
      );
    } catch (err) {
      console.error("/insights failed:", err);
      await safeEdit(ctx, thinking.message_id, "Sorry, couldn't generate insights right now. Try again later.");
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
      // Mirrors /api/users/me/key: the key is encrypted at rest, and the model
      // is cleared so a stale model from the previous provider can't 404 every
      // call (e.g. openai/gpt-5.4-mini left behind after switching to gemini).
      const encrypted = encrypt(apiKey);
      const { count } = await prisma.user.updateMany({
        where: { telegram_id: ctx.from!.id },
        data: { ai_provider: provider, ai_api_key: encrypted, ai_model: null },
      });

      if (count === 0) {
        // Only the mini-app (POST /api/users) creates the account row — /start
        // does not — so telling the user to /start would loop them forever.
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
      const imageBytes = Buffer.from(await res.arrayBuffer());

      result = await analyseMeal(
        ai.provider,
        ai.apiKey,
        ai.model,
        imageBytes,
        "image/jpeg",
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

    // The meal is logged — from here on a failure must never say "try again".
    const { html, plain } = mealConfirmation(result);
    await deliverConfirmation(ctx, thinking.message_id, html, plain);
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
    { command: "coach", description: "Get today's AI coaching tip" },
    { command: "insights", description: "Get AI weekly pattern analysis" },
    { command: "key", description: "Set up your AI API key" },
    { command: "help", description: "Show all commands" },
  ]);
}
