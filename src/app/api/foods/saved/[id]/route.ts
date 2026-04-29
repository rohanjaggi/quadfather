import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/auth";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getAuthenticatedUser(request);
    const { id } = await params;
    const foodId = parseInt(id, 10);
    const body = await request.json();

    const food = await prisma.savedFood.findFirst({
      where: { id: foodId, user_id: user.id },
    });
    if (!food) {
      return NextResponse.json(
        { detail: "Saved food not found" },
        { status: 404 },
      );
    }

    const updated = await prisma.savedFood.update({
      where: { id: foodId },
      data: {
        name: body.name ?? food.name,
        calories: body.calories ?? food.calories,
        protein: body.protein ?? food.protein,
        carbohydrates: body.carbohydrates ?? food.carbohydrates,
        fats: body.fats ?? food.fats,
        fiber: body.fiber ?? food.fiber,
      },
    });

    return NextResponse.json({
      id: updated.id,
      name: updated.name,
      description: updated.description,
      calories: updated.calories,
      protein: updated.protein,
      carbohydrates: updated.carbohydrates,
      fats: updated.fats,
      fiber: updated.fiber,
      serving_label: updated.serving_label,
      source: updated.source,
      created_at: updated.created_at.toISOString(),
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

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getAuthenticatedUser(request);
    const { id } = await params;
    const foodId = parseInt(id, 10);

    const food = await prisma.savedFood.findFirst({
      where: { id: foodId, user_id: user.id },
    });
    if (!food) {
      return NextResponse.json(
        { detail: "Saved food not found" },
        { status: 404 },
      );
    }

    await prisma.savedFood.delete({ where: { id: foodId } });
    return new NextResponse(null, { status: 204 });
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
