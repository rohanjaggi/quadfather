import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withUser, optionalInt } from "@/lib/api-handler";
import { dayKey, daysAgoStart } from "@/lib/day";

export const GET = withUser(async (request, user) => {
  // `?days=abc` used to be NaN, which passed the `< 1 || > 90` check and then
  // built a window from Invalid Dates.
  const days =
    optionalInt(request.nextUrl.searchParams.get("days"), "days", { min: 1, max: 90 }) ?? 7;

  const start = daysAgoStart(days - 1);
  const keys = Array.from({ length: days }, (_, i) => dayKey(daysAgoStart(days - 1 - i)));

  // Two queries for the whole range instead of two per day: `?days=90` used to
  // issue 180 round-trips to render one chart.
  const [foodLogs, waterLogs] = await Promise.all([
    prisma.foodLog.findMany({
      where: { user_id: user.id, logged_at: { gte: start } },
      select: { logged_at: true, calories: true, protein: true, carbohydrates: true, fats: true, fiber: true },
    }),
    prisma.waterLog.findMany({
      where: { user_id: user.id, logged_at: { gte: start } },
      select: { logged_at: true, amount_liters: true },
    }),
  ]);

  const foodByDay = new Map<string, typeof foodLogs>(keys.map((k) => [k, []]));
  const waterByDay = new Map<string, typeof waterLogs>(keys.map((k) => [k, []]));
  for (const log of foodLogs) foodByDay.get(dayKey(log.logged_at))?.push(log);
  for (const log of waterLogs) waterByDay.get(dayKey(log.logged_at))?.push(log);

  const result = keys.map((date) => {
    const dayFood = foodByDay.get(date) ?? [];
    const dayWater = waterByDay.get(date) ?? [];
    return {
      date,
      calories: Math.round(
        dayFood.reduce((s, l) => s + (l.calories ?? 0), 0),
      ),
      protein:
        Math.round(
          dayFood.reduce((s, l) => s + (l.protein ?? 0), 0) * 10,
        ) / 10,
      carbohydrates:
        Math.round(
          dayFood.reduce((s, l) => s + (l.carbohydrates ?? 0), 0) * 10,
        ) / 10,
      fats:
        Math.round(
          dayFood.reduce((s, l) => s + (l.fats ?? 0), 0) * 10,
        ) / 10,
      fiber:
        Math.round(
          dayFood.reduce((s, l) => s + (l.fiber ?? 0), 0) * 10,
        ) / 10,
      water:
        Math.round(
          dayWater.reduce((s, l) => s + l.amount_liters, 0) * 100,
        ) / 100,
      meals_logged: dayFood.length,
    };
  });

  return NextResponse.json({
    days: result,
    goals: {
      calories: user.daily_calorie_goal,
      protein: user.daily_protein_goal,
      carbohydrates: user.daily_carbs_goal,
      fats: user.daily_fats_goal,
      fiber: user.daily_fiber_goal,
      water: user.daily_water_goal,
    },
  });
});
