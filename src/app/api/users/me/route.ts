import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);

    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setUTCHours(23, 59, 59, 999);

    const [foodLogs, waterLogs, runLogs] = await Promise.all([
      prisma.foodLog.findMany({
        where: { user_id: user.id, logged_at: { gte: todayStart } },
      }),
      prisma.waterLog.findMany({
        where: { user_id: user.id, logged_at: { gte: todayStart } },
      }),
      prisma.runLog.findMany({
        where: {
          user_id: user.id,
          run_date: { gte: todayStart, lte: todayEnd },
          added_to_allowance: true,
        },
      }),
    ]);

    const totalCalories = foodLogs.reduce((s, l) => s + (l.calories ?? 0), 0);
    const totalProtein = foodLogs.reduce((s, l) => s + (l.protein ?? 0), 0);
    const totalCarbs = foodLogs.reduce((s, l) => s + (l.carbohydrates ?? 0), 0);
    const totalFats = foodLogs.reduce((s, l) => s + (l.fats ?? 0), 0);
    const totalFiber = foodLogs.reduce((s, l) => s + (l.fiber ?? 0), 0);
    const totalWater = waterLogs.reduce((s, l) => s + l.amount_liters, 0);
    const exerciseBurn = runLogs.reduce((s, r) => s + r.calories_burned, 0);

    const r = (v: number) => Math.round(v * 10) / 10;

    return NextResponse.json({
      date: todayStart.toISOString().split("T")[0],
      macros: {
        calories: {
          total: totalCalories,
          goal: user.daily_calorie_goal + exerciseBurn,
          remaining: Math.round((user.daily_calorie_goal + exerciseBurn - totalCalories) * 10) / 10,
        },
        protein: {
          total: totalProtein,
          goal: user.daily_protein_goal,
          remaining: r(user.daily_protein_goal - totalProtein),
        },
        carbohydrates: {
          total: totalCarbs,
          goal: user.daily_carbs_goal,
          remaining: r(user.daily_carbs_goal - totalCarbs),
        },
        fats: {
          total: totalFats,
          goal: user.daily_fats_goal,
          remaining: r(user.daily_fats_goal - totalFats),
        },
        fiber: {
          total: totalFiber,
          goal: user.daily_fiber_goal,
          remaining: r(user.daily_fiber_goal - totalFiber),
        },
      },
      water: {
        total: totalWater,
        goal: user.daily_water_goal,
        remaining: Math.round((user.daily_water_goal - totalWater) * 10) / 10,
      },
      meals_logged: foodLogs.length,
      exercise_burn: Math.round(exerciseBurn),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Internal error";
    if (message === "User not found") {
      return NextResponse.json({ detail: message }, { status: 404 });
    }
    if (message.includes("initData") || message.includes("hash")) {
      return NextResponse.json({ detail: message }, { status: 401 });
    }
    return NextResponse.json({ detail: message }, { status: 500 });
  }
}
