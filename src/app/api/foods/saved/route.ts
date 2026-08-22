import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  conflict,
  optionalNumber,
  optionalString,
  parseJsonBody,
  requireNumber,
  requireString,
  withUser,
} from "@/lib/api-handler";

/** Column widths: `name`/`serving_label` are VarChar(100), `source` VarChar(20). */
const MAX_NAME = 100;
const MAX_LABEL = 100;
const MAX_SOURCE = 20;
const MAX_MACRO = 100_000;

export const GET = withUser(async (request, user) => {
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
});

export const POST = withUser(async (request, user) => {
  const body = await parseJsonBody(request);

  const name = requireString(body.name, "name").slice(0, MAX_NAME);
  const macro = (key: string) => requireNumber(body[key], key, { min: 0, max: MAX_MACRO });

  // Pre-check only for the friendlier message — two taps racing each other
  // still land on the `uq_user_food_name` index, which the wrapper maps to 409.
  const existing = await prisma.savedFood.findFirst({
    where: { user_id: user.id, name },
  });
  if (existing) throw conflict("A saved food with this name already exists");

  const food = await prisma.savedFood.create({
    data: {
      user_id: user.id,
      name,
      description: optionalString(body.description, "description") ?? null,
      calories: macro("calories"),
      protein: macro("protein"),
      carbohydrates: macro("carbohydrates"),
      fats: macro("fats"),
      fiber: optionalNumber(body.fiber, "fiber", { min: 0, max: MAX_MACRO }) ?? 0,
      serving_label:
        optionalString(body.serving_label, "serving_label")?.slice(0, MAX_LABEL) ?? null,
      source:
        optionalString(body.source, "source")?.trim().slice(0, MAX_SOURCE) || "manual",
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
});
