import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateWeeklyInsights } from "@/lib/ai";
import type { AIProvider } from "@/lib/models";
import { decrypt } from "@/lib/crypto";
import { escapeHtml } from "@/lib/html";
import { clampHtml } from "@/lib/telegram-bot";
import { checkCronAuth } from "../auth";
import { Bot } from "grammy";

const DAY_MS = 86400000;

const BOT_TOKEN = process.env.BOTFATHER_TOKEN ?? "";

function getAICredentials(user: { ai_provider: string | null; ai_api_key: string | null; ai_model: string | null }) {
  if (user.ai_provider && user.ai_api_key) {
    return { provider: user.ai_provider as AIProvider, apiKey: decrypt(user.ai_api_key), model: user.ai_model };
  }
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) return { provider: "gemini" as AIProvider, apiKey: geminiKey, model: null as string | null };
  const openrouterKey = process.env.OPENROUTER_API_KEY;
  if (openrouterKey) return { provider: "openrouter" as AIProvider, apiKey: openrouterKey, model: null as string | null };
  return null;
}

export async function GET(request: NextRequest) {
  const authFailure = checkCronAuth(request);
  if (authFailure) return authFailure;

  const users = await prisma.user.findMany({
    where: { ai_features_enabled: true },
  });

  // The 7 *complete* previous UTC days: [day-7 00:00, today 00:00).
  // Today is excluded — it is still in progress and would drag averages down.
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const weekStart = new Date(todayStart.getTime() - 7 * DAY_MS);

  const bot = new Bot(BOT_TOKEN);
  let sent = 0;

  for (const user of users) {
    const coachPrefs = user.ai_coaching_prefs as Record<string, boolean> | null;
    if (coachPrefs?.weekly_insights === false) continue;

    try {
      // Inside the per-user try: `getAICredentials` calls `decrypt`, which throws
      // on a rotated ENCRYPTION_KEY, a corrupt ciphertext, or a legacy plaintext
      // key. Outside, that throw escaped the loop and 500'd the whole cron, so
      // one user with an unreadable key meant *nobody* got their insights.
      const creds = getAICredentials(user);
      if (!creds) continue;

      const [foodLogs, waterLogs, runLogs, workoutLogs] = await Promise.all([
        prisma.foodLog.findMany({ where: { user_id: user.id, logged_at: { gte: weekStart, lt: todayStart } } }),
        prisma.waterLog.findMany({ where: { user_id: user.id, logged_at: { gte: weekStart, lt: todayStart } } }),
        prisma.runLog.findMany({ where: { user_id: user.id, run_date: { gte: weekStart, lt: todayStart } } }),
        // Gym sessions count as exercise too — the prompt's "N sessions" used to
        // be runs only, so a week of nothing but lifting read as "0 sessions".
        prisma.workoutLog.findMany({ where: { user_id: user.id, workout_date: { gte: weekStart, lt: todayStart } } }),
      ]);

      if (foodLogs.length === 0) continue;

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

      // Runs + gym sessions, over the same [weekStart, todayStart) window.
      const exerciseTotal =
        runLogs.reduce((s, r) => s + r.calories_burned, 0) +
        workoutLogs.reduce((s, w) => s + (w.calories_burned ?? 0), 0);
      const exerciseSessions = runLogs.length + workoutLogs.length;
      const dietaryRestrictions: string[] = user.dietary_restrictions
        ? JSON.parse(user.dietary_restrictions) : [];

      const insights = await generateWeeklyInsights(creds.provider, creds.apiKey, creds.model, {
        goals: { calories: user.daily_calorie_goal, protein: user.daily_protein_goal, water: user.daily_water_goal },
        days,
        exerciseTotal,
        exerciseSessions,
        dietaryRestrictions,
      });

      // Telegram 400s past 4096 characters and this send has no fallback, so an
      // over-long model reply used to mean the user simply got no digest.
      await bot.api.sendMessage(
        Number(user.telegram_id),
        clampHtml(`\u{1F4CA} <b>Weekly Insights</b>\n\n${escapeHtml(insights)}`),
        { parse_mode: "HTML" },
      );
      sent++;
    } catch (err) {
      console.error(`Weekly insights failed for user ${user.id}:`, err);
    }
  }

  return NextResponse.json({ sent, total: users.length });
}
