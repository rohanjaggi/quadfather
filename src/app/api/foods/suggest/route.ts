import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserAICredentials } from "@/lib/auth";
import { suggestMeals } from "@/lib/ai";
import { getDailyBudget } from "@/lib/budget";
import { callAIProvider, parseJsonStringArray, withUser } from "@/lib/api-handler";

export const GET = withUser(async (request, user) => {
  const { provider, apiKey, model } = getUserAICredentials(user);

  // Same budget the dashboard shows: goal + exercise credit + step credit.
  const budget = await getDailyBudget(user);

  const remainingCalories = Math.max(budget.remaining, 0);
  const remainingProtein = Math.max(user.daily_protein_goal - budget.food.protein, 0);
  const mealNames = budget.logs.food
    .map((l) => l.food_name)
    .filter((n): n is string => !!n);

  // Tolerant read: legacy rows can hold a bare JSON string rather than an array.
  const dietaryRestrictions = parseJsonStringArray(user.dietary_restrictions);

  const savedFoods = await prisma.savedFood.findMany({
    where: { user_id: user.id },
    select: { name: true },
    take: 10,
    orderBy: { created_at: "desc" },
  });
  const savedFoodNames = savedFoods.map((f) => f.name);

  // The dampened exercise credit (50% of runs + workouts) — i.e. the number
  // that actually sits inside `remainingCalories`. Passing raw burn here made
  // the model treat it as headroom on top of the remaining budget and
  // double-count it, so send the credit and let the prompt say it is already
  // included.
  const exerciseToday = budget.exercise_burn;

  const suggestions = await callAIProvider("foods/suggest", () =>
    suggestMeals(
      provider,
      apiKey,
      model,
      remainingCalories,
      remainingProtein,
      mealNames,
      dietaryRestrictions,
      savedFoodNames,
      exerciseToday,
    ),
  );

  return NextResponse.json(suggestions);
});
