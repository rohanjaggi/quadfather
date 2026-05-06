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
        ...(body.daily_carbs_goal != null && {
          daily_carbs_goal: body.daily_carbs_goal,
        }),
        ...(body.daily_fats_goal != null && {
          daily_fats_goal: body.daily_fats_goal,
        }),
        ...(body.daily_fiber_goal != null && {
          daily_fiber_goal: body.daily_fiber_goal,
        }),
        ...(body.sex !== undefined && { sex: body.sex }),
        ...(body.weight_kg !== undefined && { weight_kg: body.weight_kg }),
        ...(body.height_cm !== undefined && { height_cm: body.height_cm }),
        ...(body.age !== undefined && { age: body.age }),
        ...(body.activity_level !== undefined && { activity_level: body.activity_level }),
        ...(body.fitness_goal !== undefined && { fitness_goal: body.fitness_goal }),
        ...(body.dietary_restrictions !== undefined && {
          dietary_restrictions: JSON.stringify(body.dietary_restrictions),
        }),
        ...(body.ai_features_enabled !== undefined && {
          ai_features_enabled: body.ai_features_enabled,
        }),
      },
    });

    return NextResponse.json({
      message: "Goals updated",
      goals: {
        daily_protein_goal: updated.daily_protein_goal,
        daily_calorie_goal: updated.daily_calorie_goal,
        daily_water_goal: updated.daily_water_goal,
        daily_carbs_goal: updated.daily_carbs_goal,
        daily_fats_goal: updated.daily_fats_goal,
        daily_fiber_goal: updated.daily_fiber_goal,
      },
      ...(updated.sex && {
        personal: {
          sex: updated.sex,
          weight_kg: updated.weight_kg,
          height_cm: updated.height_cm,
          age: updated.age,
          activity_level: updated.activity_level,
          fitness_goal: updated.fitness_goal,
        },
      }),
      water_bottle_size: updated.water_bottle_size,
      dietary_restrictions: updated.dietary_restrictions ? JSON.parse(updated.dietary_restrictions) : [],
      ai_features_enabled: updated.ai_features_enabled,
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
