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

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
/** `FoodLog.food_name` is `VarChar(100)`, `source` is `VarChar(20)`. */
const MAX_NAME = 100;
const MAX_SOURCE = 20;
/** Per-serving ceilings — anything past this is a typo, not a meal. */
const MAX_MACRO = 100_000;
const MAX_SERVINGS = 100;

export const GET = withUser(async (request, user) => {
  const dateParam = request.nextUrl.searchParams.get("date");
  // `?date=abc` used to build an Invalid Date and 500 inside Prisma.
  const parsed = parseDateParam(dateParam, "date");

  // A bare `YYYY-MM-DD` keeps being read as *local* midnight (the client sends
  // `toLocaleDateString('en-CA')`), so the day a user sees doesn't shift.
  const dayStart =
    dateParam && DATE_ONLY.test(dateParam)
      ? new Date(`${dateParam}T00:00:00`)
      : (parsed ?? new Date());
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setHours(23, 59, 59, 999);

  const logs = await prisma.foodLog.findMany({
    where: { user_id: user.id, logged_at: { gte: dayStart, lte: dayEnd } },
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

  // Only an absent/null `servings` means "one serving". A literal 0 — what the
  // manual form sends for a cleared field — used to multiply every macro to 0
  // and save the empty row without a word.
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
      // Truncated rather than rejected: names come from the AI parsers, and a
      // clipped name beats losing the meal to a 422 (the column is VarChar).
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
});
