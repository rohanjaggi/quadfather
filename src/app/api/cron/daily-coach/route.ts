import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateDailyCoach } from "@/lib/ai";
import type { AIProvider } from "@/lib/models";
import { decrypt } from "@/lib/crypto";
import { determineNudgeTopic, recordNudge } from "@/lib/coach";
import { calculateStepAllowance } from "@/lib/steps";
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
    const coachPrefs = user.ai_coaching_prefs as Record<string, boolean> | null;
    if (coachPrefs?.daily_coach === false) continue;

    const creds = getAICredentials(user);
    if (!creds) continue;

    try {
      const thirtyDaysAgo = new Date(todayStart.getTime() - 30 * 86400000);
      const [foodLogs, waterLogs, runLogs, workoutLogs, stepLogs, recentSteps] = await Promise.all([
        prisma.foodLog.findMany({ where: { user_id: user.id, logged_at: { gte: todayStart } } }),
        prisma.waterLog.findMany({ where: { user_id: user.id, logged_at: { gte: todayStart } } }),
        prisma.runLog.findMany({ where: { user_id: user.id, run_date: { gte: todayStart } } }),
        prisma.workoutLog.findMany({
          where: { user_id: user.id, workout_date: { gte: todayStart } },
          include: { exercises: true },
        }),
        prisma.stepLog.findFirst({ where: { user_id: user.id, date: todayStart }, orderBy: { logged_at: 'desc' } }),
        prisma.stepLog.findMany({ where: { user_id: user.id, date: { gte: thirtyDaysAgo } }, orderBy: { date: 'desc' } }),
      ]);

      if (foodLogs.length === 0 && workoutLogs.length === 0) continue;

      const consumed = {
        calories: Math.round(foodLogs.reduce((s, l) => s + (l.calories ?? 0), 0)),
        protein: Math.round(foodLogs.reduce((s, l) => s + (l.protein ?? 0), 0)),
        carbs: Math.round(foodLogs.reduce((s, l) => s + (l.carbohydrates ?? 0), 0)),
        fats: Math.round(foodLogs.reduce((s, l) => s + (l.fats ?? 0), 0)),
      };
      const meals = foodLogs.map(l => l.food_name).filter((n): n is string => !!n);
      const waterConsumed = waterLogs.reduce((s, l) => s + l.amount_liters, 0);
      const exerciseCalories = runLogs.reduce((s, r) => s + r.calories_burned, 0)
        + workoutLogs.reduce((s, w) => s + (w.calories_burned ?? 0), 0);
      const dietaryRestrictions: string[] = user.dietary_restrictions
        ? JSON.parse(user.dietary_restrictions) : [];

      const todayStepCount = stepLogs?.steps ?? 0;
      let currentStreak = 0;
      const sortedSteps = recentSteps.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      for (const s of sortedSteps) {
        if (s.steps >= user.daily_step_goal) currentStreak++;
        else break;
      }

      const runAllowanceBurn = runLogs.filter(r => r.added_to_allowance).reduce((s, r) => s + r.calories_burned, 0);
      const stepAllowance = calculateStepAllowance(
        todayStepCount,
        user.activity_level,
        user.weight_kg,
        runAllowanceBurn,
      );

      const message = await generateDailyCoach(creds.provider, creds.apiKey, creds.model, {
        goals: { calories: user.daily_calorie_goal, protein: user.daily_protein_goal },
        consumed,
        meals,
        waterConsumed,
        waterGoal: user.daily_water_goal,
        exerciseCalories,
        dietaryRestrictions,
        steps: {
          today: todayStepCount,
          goal: user.daily_step_goal,
          streak: currentStreak,
          extraAllowance: stepAllowance,
        },
      });

      // Check for proactive nudge
      const nudgeTopic = await determineNudgeTopic(user.id, user.daily_step_goal, coachPrefs);
      let nudgeText = "";
      if (nudgeTopic) {
        await recordNudge(user.id, nudgeTopic);
        const nudgeLabels: Record<string, string> = {
          inactivity: "You haven't worked out in a while — even a short session helps!",
          recovery: "You've been training hard — consider a rest day for recovery.",
          nutrition_gap: "Big burn today but intake is low — prioritise protein tonight.",
          consistency: "Great consistency this week — keep the momentum going!",
          steps: `You're at ${todayStepCount.toLocaleString()} steps — ${Math.max(0, user.daily_step_goal - todayStepCount).toLocaleString()} more to hit your goal.${currentStreak > 2 ? ` Don't break your ${currentStreak}-day streak!` : ''}`,
        };
        nudgeText = `\n\n\u{1F4A1} ${nudgeLabels[nudgeTopic] ?? ""}`;
      }

      await bot.api.sendMessage(
        Number(user.telegram_id),
        `\u{1F4AC} <b>Daily Coach</b>\n\n${message}${nudgeText}`,
        { parse_mode: "HTML" },
      );
      sent++;
    } catch (err) {
      console.error(`Daily coach failed for user ${user.id}:`, err);
    }
  }

  return NextResponse.json({ sent, total: users.length });
}
