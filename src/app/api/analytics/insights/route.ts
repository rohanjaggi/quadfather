import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserAICredentials } from "@/lib/auth";
import { generateTrendsCoach } from "@/lib/ai";
import { callAIProvider, withUser, optionalInt } from "@/lib/api-handler";

const DAY_MS = 86400000;

export const GET = withUser(async (request, user) => {
  const { provider, apiKey, model } = getUserAICredentials(user);

  // Only 7 and 30 are offered by the UI; anything else falls back to 7, but a
  // non-integer is now rejected rather than silently treated as "7".
  const daysParam = optionalInt(request.nextUrl.searchParams.get("days"), "days", {
    min: 1,
    max: 90,
  });
  const period = daysParam === 30 ? 30 : 7;

  // The `period` *complete* previous UTC days: [day-period 00:00, today 00:00).
  // Today is excluded (still in progress); the exercise window matches the
  // food window exactly instead of running one day longer.
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const start = new Date(todayStart.getTime() - period * DAY_MS);

  const [foodLogs, waterLogs, runLogs, workoutLogs] = await Promise.all([
    prisma.foodLog.findMany({ where: { user_id: user.id, logged_at: { gte: start, lt: todayStart } } }),
    prisma.waterLog.findMany({ where: { user_id: user.id, logged_at: { gte: start, lt: todayStart } } }),
    prisma.runLog.findMany({ where: { user_id: user.id, run_date: { gte: start, lt: todayStart } } }),
    // Lifting counts as exercise: the crons and the Telegram bot both fold
    // workouts into the activity picture, so a user who only lifts was being
    // told by this route that they had done nothing all week.
    prisma.workoutLog.findMany({
      where: { user_id: user.id, workout_date: { gte: start, lt: todayStart } },
      select: { calories_burned: true },
    }),
  ]);

  // Nothing logged in the window (brand-new user, or one who only logged today):
  // an all-zero week has no insight in it, so skip the paid AI call.
  if (foodLogs.length === 0) {
    return NextResponse.json({ insight: null });
  }

  const days: { date: string; calories: number; protein: number; carbs: number; fats: number; fiber: number; water: number; meals_logged: number }[] = [];
  for (let i = period; i >= 1; i--) {
    const dayStart = new Date(todayStart.getTime() - i * DAY_MS);
    const dayEnd = new Date(dayStart.getTime() + DAY_MS - 1);
    const dateStr = dayStart.toISOString().split("T")[0];

    const dayFood = foodLogs.filter(l => l.logged_at >= dayStart && l.logged_at <= dayEnd);
    const dayWater = waterLogs.filter(l => l.logged_at >= dayStart && l.logged_at <= dayEnd);

    days.push({
      date: dateStr,
      calories: Math.round(dayFood.reduce((s, l) => s + (l.calories ?? 0), 0)),
      protein: Math.round(dayFood.reduce((s, l) => s + (l.protein ?? 0), 0)),
      carbs: Math.round(dayFood.reduce((s, l) => s + (l.carbohydrates ?? 0), 0)),
      fats: Math.round(dayFood.reduce((s, l) => s + (l.fats ?? 0), 0)),
      fiber: Math.round(dayFood.reduce((s, l) => s + (l.fiber ?? 0), 0)),
      water: dayWater.reduce((s, l) => s + l.amount_liters, 0),
      meals_logged: dayFood.length,
    });
  }

  const exerciseTotal =
    runLogs.reduce((s, r) => s + r.calories_burned, 0) +
    workoutLogs.reduce((s, w) => s + (w.calories_burned ?? 0), 0);
  const exerciseSessions = runLogs.length + workoutLogs.length;
  // Stored as a JSON string; a legacy/hand-edited row can hold a bare string,
  // which must not turn an insights request into a 500.
  let dietaryRestrictions: string[] = [];
  if (user.dietary_restrictions) {
    try {
      const parsed: unknown = JSON.parse(user.dietary_restrictions);
      if (Array.isArray(parsed)) dietaryRestrictions = parsed.filter(r => typeof r === "string");
    } catch {
      dietaryRestrictions = [];
    }
  }

  // Wrapped so a provider failure (bad key, outage) is the same 502 "check your
  // API key" the food/run routes return, instead of an opaque 500.
  const insight = await callAIProvider("analytics/insights", () =>
    generateTrendsCoach(provider, apiKey, model, {
      period,
      goals: {
        calories: user.daily_calorie_goal,
        protein: user.daily_protein_goal,
        carbs: user.daily_carbs_goal,
        fats: user.daily_fats_goal,
        fiber: user.daily_fiber_goal,
        water: user.daily_water_goal,
      },
      days,
      exerciseTotal,
      exerciseSessions,
      dietaryRestrictions,
    }),
  );

  return NextResponse.json({ insight });
});
