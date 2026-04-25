import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/auth";
import { suggestMeals } from "@/lib/openai";

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);

    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);

    const foodLogs = await prisma.foodLog.findMany({
      where: { user_id: user.id, logged_at: { gte: todayStart } },
    });

    const totalCalories = foodLogs.reduce((s, l) => s + (l.calories ?? 0), 0);
    const totalProtein = foodLogs.reduce((s, l) => s + (l.protein ?? 0), 0);
    const remainingCalories = Math.max(user.daily_calorie_goal - totalCalories, 0);
    const remainingProtein = Math.max(user.daily_protein_goal - totalProtein, 0);
    const mealNames = foodLogs
      .map((l) => l.food_name)
      .filter((n): n is string => !!n);

    const suggestions = await suggestMeals(
      remainingCalories,
      remainingProtein,
      mealNames,
    );

    return NextResponse.json(suggestions);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Internal error";
    if (message === "User not found") {
      return NextResponse.json({ detail: message }, { status: 404 });
    }
    if (message.includes("initData") || message.includes("hash")) {
      return NextResponse.json({ detail: message }, { status: 401 });
    }
    if (message.includes("OPENAI") || message.includes("OpenAI")) {
      return NextResponse.json({ detail: message }, { status: 503 });
    }
    return NextResponse.json({ detail: message }, { status: 500 });
  }
}
