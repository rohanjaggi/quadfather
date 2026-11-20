import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
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
import { SAVED_FOOD_SELECT } from "@/lib/selects";

/** Column widths: `name`/`serving_label` are VarChar(100), `source` VarChar(20). */
const MAX_NAME = 100;
const MAX_LABEL = 100;
const MAX_SOURCE = 20;
const MAX_MACRO = 100_000;

export const GET = withUser(async (request, user) => {
  const foods = await prisma.savedFood.findMany({
    where: { user_id: user.id },
    orderBy: { name: "asc" },
    select: SAVED_FOOD_SELECT,
  });

  return NextResponse.json(foods);
});

export const POST = withUser(async (request, user) => {
  const body = await parseJsonBody(request);

  const name = requireString(body.name, "name").slice(0, MAX_NAME);
  const macro = (key: string) => requireNumber(body[key], key, { min: 0, max: MAX_MACRO });

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
    select: SAVED_FOOD_SELECT,
  }).catch((e) => {
    // A duplicate name hits the `uq_user_food_name` unique index.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")
      throw conflict("A saved food with this name already exists");
    throw e;
  });

  return NextResponse.json(food, { status: 201 });
});
