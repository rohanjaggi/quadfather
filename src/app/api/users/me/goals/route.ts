import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/auth";

export async function PUT(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    const body = await request.json();

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        ...(body.daily_calorie_goal != null && {
          daily_calorie_goal: body.daily_calorie_goal,
        }),
        ...(body.daily_protein_goal != null && {
          daily_protein_goal: body.daily_protein_goal,
        }),
        ...(body.daily_water_goal != null && {
          daily_water_goal: body.daily_water_goal,
        }),
        ...(body.water_bottle_size != null && {
          water_bottle_size: body.water_bottle_size,
        }),
      },
    });

    return NextResponse.json({
      message: "Goals updated",
      goals: {
        daily_protein_goal: updated.daily_protein_goal,
        daily_calorie_goal: updated.daily_calorie_goal,
        daily_water_goal: updated.daily_water_goal,
      },
      water_bottle_size: updated.water_bottle_size,
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
