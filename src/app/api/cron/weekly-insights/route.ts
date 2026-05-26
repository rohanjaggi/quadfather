import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateWeeklyInsights } from "@/lib/ai";
import type { AIProvider } from "@/lib/models";
import { decrypt } from "@/lib/crypto";
import { Bot } from "grammy";

const BOT_TOKEN = process.env.BOTFATHER_TOKEN ?? "";
const CRON_SECRET = process.env.CRON_SECRET ?? "";

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
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }

  const users = await prisma.user.findMany({
    where: { ai_features_enabled: true },
  });

  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 7);
  weekStart.setUTCHours(0, 0, 0, 0);

  const bot = new Bot(BOT_TOKEN);
  let sent = 0;

  for (const user of users) {
    const creds = getAICredentials(user);
    if (!creds) continue;

    try {
      const [foodLogs, waterLogs, runLogs] = await Promise.all([
        prisma.foodLog.findMany({ where: { user_id: user.id, logged_at: { gte: weekStart } } }),
        prisma.waterLog.findMany({ where: { user_id: user.id, logged_at: { gte: weekStart } } }),
        prisma.runLog.findMany({ where: { user_id: user.id, run_date: { gte: weekStart } } }),
      ]);

      if (foodLogs.length === 0) continue;

      const days: { date: string; calories: number; protein: number; water: number }[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        const dayStart = new Date(dateStr + 'T00:00:00.000Z');
        const dayEnd = new Date(dateStr + 'T23:59:59.999Z');

        const dayFood = foodLogs.filter(l => l.logged_at >= dayStart && l.logged_at <= dayEnd);
        const dayWater = waterLogs.filter(l => l.logged_at >= dayStart && l.logged_at <= dayEnd);

        days.push({
          date: dateStr,
          calories: Math.round(dayFood.reduce((s, l) => s + (l.calories ?? 0), 0)),
          protein: Math.round(dayFood.reduce((s, l) => s + (l.protein ?? 0), 0)),
          water: dayWater.reduce((s, l) => s + l.amount_liters, 0),
        });
      }

      const exerciseTotal = runLogs.reduce((s, r) => s + r.calories_burned, 0);
      const dietaryRestrictions: string[] = user.dietary_restrictions
        ? JSON.parse(user.dietary_restrictions) : [];

      const insights = await generateWeeklyInsights(creds.provider, creds.apiKey, creds.model, {
        goals: { calories: user.daily_calorie_goal, protein: user.daily_protein_goal, water: user.daily_water_goal },
        days,
        exerciseTotal,
        exerciseSessions: runLogs.length,
        dietaryRestrictions,
      });

      await bot.api.sendMessage(
        Number(user.telegram_id),
        `\u{1F4CA} <b>Weekly Insights</b>\n\n${insights}`,
        { parse_mode: "HTML" },
      );
      sent++;
    } catch (err) {
      console.error(`Weekly insights failed for user ${user.id}:`, err);
    }
  }

  return NextResponse.json({ sent, total: users.length });
}
