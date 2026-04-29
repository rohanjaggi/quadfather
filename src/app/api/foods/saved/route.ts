import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);

    const foods = await prisma.savedFood.findMany({
      where: { user_id: user.id },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(
      foods.map((f) => ({
        id: f.id,
        name: f.name,
        description: f.description,
        calories: f.calories,
        protein: f.protein,
        carbohydrates: f.carbohydrates,
        fats: f.fats,
        fiber: f.fiber,
        serving_label: f.serving_label,
        source: f.source,
        created_at: f.created_at.toISOString(),
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

    const existing = await prisma.savedFood.findFirst({
      where: { user_id: user.id, name: body.name },
    });
    if (existing) {
      return NextResponse.json(
        { detail: "A saved food with this name already exists" },
        { status: 409 },
      );
    }

    const food = await prisma.savedFood.create({
      data: {
        user_id: user.id,
        name: body.name,
        description: body.description ?? null,
        calories: body.calories,
        protein: body.protein,
        carbohydrates: body.carbohydrates,
        fats: body.fats,
        fiber: body.fiber ?? 0,
        serving_label: body.serving_label ?? null,
        source: body.source ?? "manual",
      },
    });

    return NextResponse.json(
      {
        id: food.id,
        name: food.name,
        description: food.description,
        calories: food.calories,
        protein: food.protein,
        carbohydrates: food.carbohydrates,
        fats: food.fats,
        fiber: food.fiber,
        serving_label: food.serving_label,
        source: food.source,
        created_at: food.created_at.toISOString(),
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
