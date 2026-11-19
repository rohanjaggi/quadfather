import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  notFound,
  optionalInt,
  optionalNumber,
  optionalString,
  parseDateParam,
  parseJsonBody,
  requireNumber,
  requireString,
  unprocessable,
  withUser,
} from "@/lib/api-handler";
import { dayKey, dayRange } from "@/lib/day";
import { FOOD_LOG_SELECT, foodLogRow } from "@/lib/selects";

/** `FoodLog.food_name` is `VarChar(100)`, `source` is `VarChar(20)`. */
const MAX_NAME = 100;
const MAX_SOURCE = 20;
/** Per-serving ceilings — anything past this is a typo, not a meal. */
const MAX_MACRO = 100_000;
const MAX_SERVINGS = 100;

export const GET = withUser(async (request, user) => {
  const { start, end } = dayRange(dayKey(parseDateParam(request.nextUrl.searchParams.get("date"), "date")));

  const logs = await prisma.foodLog.findMany({
    where: { user_id: user.id, logged_at: { gte: start, lt: end } },
    orderBy: { logged_at: "desc" },
    select: FOOD_LOG_SELECT,
  });

  return NextResponse.json(logs.map(foodLogRow));
});

export const POST = withUser(async (request, user) => {
  const body = await parseJsonBody(request);

  const savedFoodId = optionalInt(body.saved_food_id, "saved_food_id", { min: 1 });
  if (savedFoodId !== undefined) {
    const saved = await prisma.savedFood.findFirst({
      where: { id: savedFoodId, user_id: user.id },
    });
    if (!saved) throw notFound("Saved food not found");
  }

  // Only absent/null `servings` means one serving; a literal 0 (cleared manual form) must not zero every macro.
  const servings =
    body.servings == null
      ? 1
      : requireNumber(body.servings, "servings", { max: MAX_SERVINGS });
  if (servings <= 0) throw unprocessable("servings must be greater than 0");

  const macro = (key: string) =>
    optionalNumber(body[key], key, { min: 0, max: MAX_MACRO }) ?? 0;

  const log = await prisma.foodLog.create({
    data: {
      user_id: user.id,
      saved_food_id: savedFoodId ?? null,
      // Truncated, not rejected: a clipped AI name beats losing the meal to a 422.
      food_name: requireString(body.food_name, "food_name").slice(0, MAX_NAME),
      raw_text_input: optionalString(body.raw_text_input, "raw_text_input") ?? null,
      servings,
      calories: macro("calories") * servings,
      protein: macro("protein") * servings,
      carbohydrates: macro("carbohydrates") * servings,
      fats: macro("fats") * servings,
      fiber: macro("fiber") * servings,
      source:
        optionalString(body.source, "source")?.trim().slice(0, MAX_SOURCE) || "manual",
    },
    select: FOOD_LOG_SELECT,
  });

  return NextResponse.json(foodLogRow(log), { status: 201 });
});
