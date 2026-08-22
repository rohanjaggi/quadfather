import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { ActivityLevel, FitnessGoal, Sex } from "@/lib/tdee";
import {
  optionalBoolean,
  optionalEnum,
  optionalInt,
  optionalNumber,
  parseJsonBody,
  parseJsonStringArray,
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

/**
 * Read a key that maps to a *nullable* column.
 *
 * Three states have to stay distinguishable, because the profile forms send
 * `null` to clear a field (`parseFloat('')` → `NaN` → `null` over JSON):
 *   - key absent      → `undefined`, leave the column alone
 *   - `null` or `''`  → `null`, clear the column
 *   - anything else   → validated value
 */
function nullableField<T>(
  body: Record<string, unknown>,
  key: string,
  parse: (value: unknown) => T,
): T | null | undefined {
  if (!(key in body)) return undefined;
  const value = body[key];
  if (value === null || value === "") return null;
  return parse(value);
}

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
  const calorieGoal = optionalNumber(body.daily_calorie_goal, "daily_calorie_goal", { min: 500, max: 20000 });
  if (calorieGoal !== undefined) data.daily_calorie_goal = calorieGoal;

  const proteinGoal = optionalNumber(body.daily_protein_goal, "daily_protein_goal", { min: 0, max: 1000 });
  if (proteinGoal !== undefined) data.daily_protein_goal = proteinGoal;

  const carbsGoal = optionalNumber(body.daily_carbs_goal, "daily_carbs_goal", { min: 0, max: 2000 });
  if (carbsGoal !== undefined) data.daily_carbs_goal = carbsGoal;

  const fatsGoal = optionalNumber(body.daily_fats_goal, "daily_fats_goal", { min: 0, max: 1000 });
  if (fatsGoal !== undefined) data.daily_fats_goal = fatsGoal;

  const fiberGoal = optionalNumber(body.daily_fiber_goal, "daily_fiber_goal", { min: 0, max: 500 });
  if (fiberGoal !== undefined) data.daily_fiber_goal = fiberGoal;

  const waterGoal = optionalNumber(body.daily_water_goal, "daily_water_goal", { min: 0, max: 20 });
  if (waterGoal !== undefined) data.daily_water_goal = waterGoal;

  const stepGoal = optionalInt(body.daily_step_goal, "daily_step_goal", { min: 0, max: 100000 });
  if (stepGoal !== undefined) data.daily_step_goal = stepGoal;

  const bottleSize = optionalNumber(body.water_bottle_size, "water_bottle_size", { max: 10 });
  if (bottleSize !== undefined) {
    // A 0 here makes every "+1 bottle" tap log 0 L for good.
    if (bottleSize <= 0) throw unprocessable("water_bottle_size must be greater than 0");
    data.water_bottle_size = bottleSize;
  }

  // --- Personal dimensions (nullable; `null` clears) ------------------------
  const sex = nullableField(body, "sex", (v) => optionalEnum(v, "sex", SEXES)!);
  if (sex !== undefined) data.sex = sex;

  const weight = nullableField(body, "weight_kg", (v) => optionalNumber(v, "weight_kg", { min: 20, max: 500 })!);
  if (weight !== undefined) data.weight_kg = weight;

  const height = nullableField(body, "height_cm", (v) => optionalNumber(v, "height_cm", { min: 50, max: 300 })!);
  if (height !== undefined) data.height_cm = height;

  const age = nullableField(body, "age", (v) => optionalInt(v, "age", { min: 10, max: 120 })!);
  if (age !== undefined) data.age = age;

  const activityLevel = nullableField(body, "activity_level", (v) => optionalEnum(v, "activity_level", ACTIVITY_LEVELS)!);
  if (activityLevel !== undefined) data.activity_level = activityLevel;

  const fitnessGoal = nullableField(body, "fitness_goal", (v) => optionalEnum(v, "fitness_goal", FITNESS_GOALS)!);
  if (fitnessGoal !== undefined) data.fitness_goal = fitnessGoal;

  const trainingFocus = nullableField(body, "training_focus", (v) => optionalEnum(v, "training_focus", TRAINING_FOCUSES)!);
  if (trainingFocus !== undefined) data.training_focus = trainingFocus;

  // --- Preferences ---------------------------------------------------------
  const restrictions = nullableField(body, "dietary_restrictions", (value) => {
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

  const coachingPrefs = nullableField(body, "ai_coaching_prefs", (value) => {
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

  const updated = await prisma.user.update({ where: { id: user.id }, data });

  return NextResponse.json({
    message: "Goals updated",
    goals: {
      daily_protein_goal: updated.daily_protein_goal,
      daily_calorie_goal: updated.daily_calorie_goal,
      daily_water_goal: updated.daily_water_goal,
      daily_carbs_goal: updated.daily_carbs_goal,
      daily_fats_goal: updated.daily_fats_goal,
      daily_fiber_goal: updated.daily_fiber_goal,
      daily_step_goal: updated.daily_step_goal,
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
    dietary_restrictions: parseJsonStringArray(updated.dietary_restrictions),
    ai_features_enabled: updated.ai_features_enabled,
    ai_coaching_prefs: updated.ai_coaching_prefs ?? undefined,
    training_focus: updated.training_focus ?? null,
  });
});
