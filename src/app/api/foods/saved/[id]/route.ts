import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  notFound,
  optionalNumber,
  optionalString,
  parseJsonBody,
  requireInt,
  requireString,
  withUser,
} from "@/lib/api-handler";

const MAX_NAME = 100;
const MAX_LABEL = 100;
const MAX_MACRO = 100_000;

/** `undefined` = key absent (leave alone); `null` = explicit clear. */
function nullableText(
  body: Record<string, unknown>,
  key: string,
  maxLength?: number,
): string | null | undefined {
  if (!(key in body)) return undefined;
  const value = body[key];
  if (value === null || value === "") return null;
  const text = optionalString(value, key)!;
  return maxLength === undefined ? text : text.slice(0, maxLength);
}

export const PATCH = withUser<{ params: { id: string } }>(
  async (request, user, { params }) => {
    const foodId = requireInt(params.id, "id", { min: 1 });
    const body = await parseJsonBody(request);

    const food = await prisma.savedFood.findFirst({
      where: { id: foodId, user_id: user.id },
    });
    if (!food) throw notFound("Saved food not found");

    const data: Prisma.SavedFoodUpdateInput = {};

    if (body.name !== undefined && body.name !== null) {
      data.name = requireString(body.name, "name").slice(0, MAX_NAME);
    }
    for (const key of ["calories", "protein", "carbohydrates", "fats", "fiber"] as const) {
      const value = optionalNumber(body[key], key, { min: 0, max: MAX_MACRO });
      if (value !== undefined) data[key] = value;
    }
    // Both used to be silently dropped, so editing a favourite's notes or
    // serving size did nothing.
    const description = nullableText(body, "description");
    if (description !== undefined) data.description = description;
    const servingLabel = nullableText(body, "serving_label", MAX_LABEL);
    if (servingLabel !== undefined) data.serving_label = servingLabel;

    // Renaming onto another favourite hits `uq_user_food_name`; the wrapper
    // turns that P2002 into a 409 instead of a 500.
    const updated = await prisma.savedFood.update({
      where: { id: foodId },
      data,
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
  },
);

export const DELETE = withUser<{ params: { id: string } }>(
  async (request, user, { params }) => {
    const foodId = requireInt(params.id, "id", { min: 1 });

    const food = await prisma.savedFood.findFirst({
      where: { id: foodId, user_id: user.id },
    });
    if (!food) throw notFound("Saved food not found");

    await prisma.savedFood.delete({ where: { id: foodId } });
    return new NextResponse(null, { status: 204 });
  },
);
