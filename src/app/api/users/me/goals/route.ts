import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { ActivityLevel, FitnessGoal, Sex } from "@/lib/tdee";
import {
  nullable,
  optionalBoolean,
  optionalEnum,
  optionalInt,
  optionalNumber,
  parseJsonBody,
  unprocessable,
  withUser,
} from "@/lib/api-handler";

// Typed against `@/lib/tdee` so a new activity level / goal there can't drift
// out of sync with what this endpoint accepts.
const SEXES: readonly Sex[] = ["male", "female"];
const ACTIVITY_LEVELS: readonly ActivityLevel[] = [
  "sedentary",
  "lightly_active",
  "moderately_active",
  "very_active",
  "extra_active",
];
const FITNESS_GOALS: readonly FitnessGoal[] = [
  "aggressive_cut",
  "moderate_cut",
  "mild_cut",
  "maintenance",
  "lean_bulk",
  "moderate_bulk",
];
/** The two options the goals screen offers; the empty value means "general". */
const TRAINING_FOCUSES = ["strength", "hypertrophy"] as const;

const MAX_RESTRICTIONS = 30;

/** Daily goal columns: `[body key, min, max]`; `daily_step_goal` is an Int column. */
const NUMBER_GOALS = [
  ["daily_calorie_goal", 500, 20000],
  ["daily_protein_goal", 0, 1000],
  ["daily_carbs_goal", 0, 2000],
  ["daily_fats_goal", 0, 1000],
  ["daily_fiber_goal", 0, 500],
  ["daily_water_goal", 0, 20],
] as const;

/**
 * Update goals and personal dimensions.
 *
 * Every accepted field is validated here: this used to spread the raw body into
 * `prisma.user.update`, so `daily_step_goal: 1.5` or `age: 25.5` hit an Int
 * column (500), `ai_coaching_prefs: null` needed `Prisma.JsonNull` (500),
 * `water_bottle_size: 0` silently made every bottle log 0 L, and
 * `dietary_restrictions: "vegan"` was stored as `"\"vegan\""` against a
 * `string[]` contract. Unknown keys are ignored.
 */
export const PUT = withUser(async (request, user) => {
  const body = await parseJsonBody(request);
  const data: Prisma.UserUpdateInput = {};

  // --- Daily goals (non-nullable columns; `null` means "not supplied") ------
  for (const [key, min, max] of NUMBER_GOALS) {
    const value = optionalNumber(body[key], key, { min, max });
    if (value !== undefined) data[key] = value;
  }

  const stepGoal = optionalInt(body.daily_step_goal, "daily_step_goal", { min: 0, max: 100000 });
  if (stepGoal !== undefined) data.daily_step_goal = stepGoal;

  const bottleSize = optionalNumber(body.water_bottle_size, "water_bottle_size", { max: 10 });
  if (bottleSize !== undefined) {
    // A 0 here makes every "+1 bottle" tap log 0 L for good.
    if (bottleSize <= 0) throw unprocessable("water_bottle_size must be greater than 0");
    data.water_bottle_size = bottleSize;
  }

  // --- Personal dimensions (nullable; `null` clears) ------------------------
  const sex = nullable(body, "sex", (v) => optionalEnum(v, "sex", SEXES)!);
  if (sex !== undefined) data.sex = sex;

  const weight = nullable(body, "weight_kg", (v) => optionalNumber(v, "weight_kg", { min: 20, max: 500 })!);
  if (weight !== undefined) data.weight_kg = weight;

  const height = nullable(body, "height_cm", (v) => optionalNumber(v, "height_cm", { min: 50, max: 300 })!);
  if (height !== undefined) data.height_cm = height;

  const age = nullable(body, "age", (v) => optionalInt(v, "age", { min: 10, max: 120 })!);
  if (age !== undefined) data.age = age;

  const activityLevel = nullable(body, "activity_level", (v) => optionalEnum(v, "activity_level", ACTIVITY_LEVELS)!);
  if (activityLevel !== undefined) data.activity_level = activityLevel;

  const fitnessGoal = nullable(body, "fitness_goal", (v) => optionalEnum(v, "fitness_goal", FITNESS_GOALS)!);
  if (fitnessGoal !== undefined) data.fitness_goal = fitnessGoal;

  const trainingFocus = nullable(body, "training_focus", (v) => optionalEnum(v, "training_focus", TRAINING_FOCUSES)!);
  if (trainingFocus !== undefined) data.training_focus = trainingFocus;

  // --- Preferences ---------------------------------------------------------
  const restrictions = nullable(body, "dietary_restrictions", (value) => {
    if (!Array.isArray(value)) throw unprocessable("dietary_restrictions must be an array of strings");
    if (value.length > MAX_RESTRICTIONS)
      throw unprocessable(`dietary_restrictions must have at most ${MAX_RESTRICTIONS} entries`);
    const cleaned = value.map((v) => {
      if (typeof v !== "string") throw unprocessable("dietary_restrictions must be an array of strings");
      return v.trim();
    });
    return JSON.stringify(cleaned.filter((v) => v !== ""));
  });
  if (restrictions !== undefined) data.dietary_restrictions = restrictions;

  const aiEnabled = optionalBoolean(body.ai_features_enabled, "ai_features_enabled");
  if (aiEnabled !== undefined) data.ai_features_enabled = aiEnabled;

  const coachingPrefs = nullable(body, "ai_coaching_prefs", (value) => {
    if (typeof value !== "object" || value === null || Array.isArray(value))
      throw unprocessable("ai_coaching_prefs must be an object");
    for (const [key, flag] of Object.entries(value)) {
      if (typeof flag !== "boolean") throw unprocessable(`ai_coaching_prefs.${key} must be true or false`);
    }
    return value as Prisma.InputJsonValue;
  });
  if (coachingPrefs !== undefined) {
    // A `Json?` column rejects a bare `null` — Prisma wants the explicit
    // JSON-null marker, and passing `null` used to 500.
    data.ai_coaching_prefs = coachingPrefs === null ? Prisma.JsonNull : coachingPrefs;
  }

  await prisma.user.update({ where: { id: user.id }, data });

  return new NextResponse(null, { status: 204 });
});
