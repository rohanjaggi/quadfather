import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  notFound,
  nullable,
  optionalNumber,
  optionalString,
  parseJsonBody,
  requireInt,
  requireString,
  withUser,
} from "@/lib/api-handler";
import { SAVED_FOOD_SELECT } from "@/lib/selects";

const MAX_NAME = 100;
const MAX_LABEL = 100;
const MAX_MACRO = 100_000;

export const PATCH = withUser<{ params: { id: string } }>(
  async (request, user, { params }) => {
    const foodId = requireInt(params.id, "id", { min: 1 });
    const body = await parseJsonBody(request);

    const owned = await prisma.savedFood.count({ where: { id: foodId, user_id: user.id } });
    if (!owned) throw notFound("Saved food not found");

    const data: Prisma.SavedFoodUpdateInput = {};

    if (body.name !== undefined && body.name !== null) {
      data.name = requireString(body.name, "name").slice(0, MAX_NAME);
    }
    for (const key of ["calories", "protein", "carbohydrates", "fats", "fiber"] as const) {
      const value = optionalNumber(body[key], key, { min: 0, max: MAX_MACRO });
      if (value !== undefined) data[key] = value;
    }
    // Notes and serving size must be written, not dropped.
    const description = nullable(body, "description", (v) => optionalString(v, "description")!);
    if (description !== undefined) data.description = description;
    const servingLabel = nullable(body, "serving_label", (v) => optionalString(v, "serving_label")!.slice(0, MAX_LABEL));
    if (servingLabel !== undefined) data.serving_label = servingLabel;

    // Renaming onto another favourite hits `uq_user_food_name`; the wrapper maps the P2002 to 409.
    const updated = await prisma.savedFood.update({
      where: { id: foodId },
      data,
      select: SAVED_FOOD_SELECT,
    });

    return NextResponse.json(updated);
  },
);

export const DELETE = withUser<{ params: { id: string } }>(
  async (request, user, { params }) => {
    const foodId = requireInt(params.id, "id", { min: 1 });

    const { count } = await prisma.savedFood.deleteMany({ where: { id: foodId, user_id: user.id } });
    if (count === 0) throw notFound("Saved food not found");
    return new NextResponse(null, { status: 204 });
  },
);
