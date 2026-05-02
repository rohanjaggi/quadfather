import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);

    const daysParam = request.nextUrl.searchParams.get("days") ?? "7";
    const days = parseInt(daysParam, 10);
    if (days < 1 || days > 90) {
      return NextResponse.json(
        { detail: "days must be between 1 and 90" },
        { status: 400 },
      );
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const result = [];

    for (let i = days - 1; i >= 0; i--) {
      const dayStart = new Date(today);
      dayStart.setDate(dayStart.getDate() - i);
      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);

      const [foodLogs, waterLogs] = await Promise.all([
        prisma.foodLog.findMany({
          where: {
            user_id: user.id,
            logged_at: { gte: dayStart, lte: dayEnd },
          },
        }),
        prisma.waterLog.findMany({
          where: {
            user_id: user.id,
            logged_at: { gte: dayStart, lte: dayEnd },
          },
        }),
      ]);

      result.push({
        date: dayStart.toISOString().split("T")[0],
        calories: Math.round(
          foodLogs.reduce((s, l) => s + (l.calories ?? 0), 0),
        ),
        protein:
          Math.round(
            foodLogs.reduce((s, l) => s + (l.protein ?? 0), 0) * 10,
          ) / 10,
        carbohydrates:
          Math.round(
            foodLogs.reduce((s, l) => s + (l.carbohydrates ?? 0), 0) * 10,
          ) / 10,
        fats:
          Math.round(
            foodLogs.reduce((s, l) => s + (l.fats ?? 0), 0) * 10,
          ) / 10,
        fiber:
          Math.round(
            foodLogs.reduce((s, l) => s + (l.fiber ?? 0), 0) * 10,
          ) / 10,
        water:
          Math.round(
            waterLogs.reduce((s, l) => s + l.amount_liters, 0) * 100,
          ) / 100,
        meals_logged: foodLogs.length,
      });
    }

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
