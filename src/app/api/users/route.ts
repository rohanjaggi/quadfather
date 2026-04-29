import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyTelegramAuth } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const initData = request.headers.get("x-telegram-init-data") ?? "";
    const telegramUser = verifyTelegramAuth(initData);

    let user = await prisma.user.findUnique({
      where: { telegram_id: telegramUser.id },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          telegram_id: telegramUser.id,
          username: telegramUser.username ?? null,
        },
      });
    }

    return NextResponse.json({
      id: user.id,
      telegram_id: Number(user.telegram_id),
      username: user.username,
      goals: {
        daily_protein_goal: user.daily_protein_goal,
        daily_calorie_goal: user.daily_calorie_goal,
        daily_water_goal: user.daily_water_goal,
        daily_carbs_goal: user.daily_carbs_goal,
        daily_fats_goal: user.daily_fats_goal,
        daily_fiber_goal: user.daily_fiber_goal,
      },
      ...(user.sex && {
        personal: {
          sex: user.sex,
          weight_kg: user.weight_kg,
          height_cm: user.height_cm,
          age: user.age,
          activity_level: user.activity_level,
          fitness_goal: user.fitness_goal,
        },
      }),
      water_bottle_size: user.water_bottle_size,
      ai_provider: user.ai_provider,
      has_api_key: !!user.ai_api_key,
      strava_connected: !!user.strava_athlete_id,
    }, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Internal error";
    if (message.includes("initData") || message.includes("hash")) {
      return NextResponse.json({ detail: message }, { status: 401 });
    }
    return NextResponse.json({ detail: message }, { status: 500 });
  }
}
