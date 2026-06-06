import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser, getUserAICredentials } from "@/lib/auth";
import { generateTrendsCoach } from "@/lib/ai";

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    const { provider, apiKey, model } = getUserAICredentials(user);

    const daysParam = request.nextUrl.searchParams.get("days");
    const period = daysParam === "30" ? 30 : 7;

    const start = new Date();
    start.setDate(start.getDate() - period);
    start.setUTCHours(0, 0, 0, 0);

    const [foodLogs, waterLogs, runLogs] = await Promise.all([
      prisma.foodLog.findMany({ where: { user_id: user.id, logged_at: { gte: start } } }),
      prisma.waterLog.findMany({ where: { user_id: user.id, logged_at: { gte: start } } }),
      prisma.runLog.findMany({ where: { user_id: user.id, run_date: { gte: start } } }),
    ]);

    const days: { date: string; calories: number; protein: number; carbs: number; fats: number; fiber: number; water: number; meals_logged: number }[] = [];
    for (let i = period - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      const dayStart = new Date(dateStr + "T00:00:00.000Z");
      const dayEnd = new Date(dateStr + "T23:59:59.999Z");

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

    const exerciseTotal = runLogs.reduce((s, r) => s + r.calories_burned, 0);
    const dietaryRestrictions: string[] = user.dietary_restrictions
      ? JSON.parse(user.dietary_restrictions)
      : [];

    const insight = await generateTrendsCoach(provider, apiKey, model, {
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
      exerciseSessions: runLogs.length,
      dietaryRestrictions,
    });

    return NextResponse.json({ insight });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Internal error";
    if (message === "User not found") {
      return NextResponse.json({ detail: message }, { status: 404 });
    }
    if (message.includes("initData") || message.includes("hash")) {
      return NextResponse.json({ detail: message }, { status: 401 });
    }
    if (message.includes("No API key")) {
      return NextResponse.json({ detail: message }, { status: 403 });
    }
    return NextResponse.json({ detail: message }, { status: 500 });
  }
}
