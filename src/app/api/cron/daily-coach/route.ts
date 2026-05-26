import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateDailyCoach } from "@/lib/ai";
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

  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const bot = new Bot(BOT_TOKEN);
  let sent = 0;

  for (const user of users) {
    const creds = getAICredentials(user);
    if (!creds) continue;

    try {
      const [foodLogs, waterLogs, runLogs] = await Promise.all([
        prisma.foodLog.findMany({ where: { user_id: user.id, logged_at: { gte: todayStart } } }),
        prisma.waterLog.findMany({ where: { user_id: user.id, logged_at: { gte: todayStart } } }),
        prisma.runLog.findMany({ where: { user_id: user.id, run_date: { gte: todayStart } } }),
      ]);

      if (foodLogs.length === 0) continue;

      const consumed = {
        calories: Math.round(foodLogs.reduce((s, l) => s + (l.calories ?? 0), 0)),
        protein: Math.round(foodLogs.reduce((s, l) => s + (l.protein ?? 0), 0)),
        carbs: Math.round(foodLogs.reduce((s, l) => s + (l.carbohydrates ?? 0), 0)),
        fats: Math.round(foodLogs.reduce((s, l) => s + (l.fats ?? 0), 0)),
      };
      const meals = foodLogs.map(l => l.food_name).filter((n): n is string => !!n);
      const waterConsumed = waterLogs.reduce((s, l) => s + l.amount_liters, 0);
      const exerciseCalories = runLogs.reduce((s, r) => s + r.calories_burned, 0);
      const dietaryRestrictions: string[] = user.dietary_restrictions
        ? JSON.parse(user.dietary_restrictions) : [];

      const message = await generateDailyCoach(creds.provider, creds.apiKey, creds.model, {
        goals: { calories: user.daily_calorie_goal, protein: user.daily_protein_goal },
        consumed,
        meals,
        waterConsumed,
        waterGoal: user.daily_water_goal,
        exerciseCalories,
        dietaryRestrictions,
      });

      await bot.api.sendMessage(
        Number(user.telegram_id),
        `\u{1F4AC} <b>Daily Coach</b>\n\n${message}`,
        { parse_mode: "HTML" },
      );
      sent++;
    } catch (err) {
      console.error(`Daily coach failed for user ${user.id}:`, err);
    }
  }

  return NextResponse.json({ sent, total: users.length });
}
