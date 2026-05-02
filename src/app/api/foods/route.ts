import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const logs = await prisma.foodLog.findMany({
      where: { user_id: user.id, logged_at: { gte: todayStart } },
      orderBy: { logged_at: "desc" },
    });

    return NextResponse.json(
      logs.map((log) => ({
        id: log.id,
        food_name: log.food_name,
        servings: log.servings,
        calories: log.calories,
        protein: log.protein,
        carbohydrates: log.carbohydrates,
        fats: log.fats,
        fiber: log.fiber ?? 0,
        source: log.source,
        saved_food_id: log.saved_food_id,
        logged_at: log.logged_at.toISOString(),
      })),
    );
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

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    const body = await request.json();

    if (body.saved_food_id != null) {
      const saved = await prisma.savedFood.findFirst({
        where: { id: body.saved_food_id, user_id: user.id },
      });
      if (!saved) {
        return NextResponse.json(
          { detail: "Saved food not found" },
          { status: 404 },
        );
      }
    }

    const servings = body.servings ?? 1.0;
    const log = await prisma.foodLog.create({
      data: {
        user_id: user.id,
        saved_food_id: body.saved_food_id ?? null,
        food_name: body.food_name,
        raw_text_input: body.raw_text_input ?? null,
        servings,
        calories: body.calories * servings,
        protein: body.protein * servings,
        carbohydrates: body.carbohydrates * servings,
        fats: body.fats * servings,
        fiber: body.fiber ?? 0,
        source: body.source ?? "manual",
      },
    });

    return NextResponse.json(
      {
        id: log.id,
        food_name: log.food_name,
        servings: log.servings,
        calories: log.calories,
        protein: log.protein,
        carbohydrates: log.carbohydrates,
        fats: log.fats,
        fiber: log.fiber ?? 0,
        source: log.source,
        saved_food_id: log.saved_food_id,
        logged_at: log.logged_at.toISOString(),
      },
      { status: 201 },
    );
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
