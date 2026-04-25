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
      telegram_id: user.telegram_id,
      username: user.username,
      goals: {
        daily_protein_goal: user.daily_protein_goal,
        daily_calorie_goal: user.daily_calorie_goal,
        daily_water_goal: user.daily_water_goal,
      },
      water_bottle_size: user.water_bottle_size,
      ai_provider: user.ai_provider,
      has_api_key: !!user.ai_api_key,
    }, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Internal error";
    if (message.includes("initData") || message.includes("hash")) {
      return NextResponse.json({ detail: message }, { status: 401 });
    }
    return NextResponse.json({ detail: message }, { status: 500 });
  }
}
