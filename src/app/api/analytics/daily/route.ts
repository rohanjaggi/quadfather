import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withUser, optionalInt } from "@/lib/api-handler";
import { sumMacros } from "@/lib/budget";
import { addDays, dayKey, daysAgoStart } from "@/lib/day";

export const GET = withUser(async (request, user) => {
  // `?days=abc` is NaN, which passes the range check and builds Invalid Date windows.
  const days =
    optionalInt(request.nextUrl.searchParams.get("days"), "days", { min: 1, max: 90 }) ?? 7;

  const start = daysAgoStart(days - 1);
  const today = dayKey();
  const keys = Array.from({ length: days }, (_, i) => addDays(today, i - (days - 1)));

  // Two queries for the whole range, not two per day.
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
    const m = sumMacros(dayFood);
    const tenth = (v: number) => Math.round(v * 10) / 10;
    return {
      date,
      calories: Math.round(m.calories),
      protein: tenth(m.protein),
      carbohydrates: tenth(m.carbohydrates),
      fats: tenth(m.fats),
      fiber: tenth(m.fiber),
      water: Math.round(dayWater.reduce((s, l) => s + l.amount_liters, 0) * 100) / 100,
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
