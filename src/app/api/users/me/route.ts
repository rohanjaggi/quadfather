import { NextResponse } from "next/server";
import { withUser } from "@/lib/api-handler";
import { getDailyBudget } from "@/lib/budget";

export const GET = withUser(async (request, user) => {
  const budget = await getDailyBudget(user);
  const { food } = budget;
  const totalWater = budget.water_liters;

  const r = (v: number) => Math.round(v * 10) / 10;

  return NextResponse.json({
    date: budget.date,
    macros: {
      calories: {
        total: food.calories,
        goal: budget.total_goal,
        remaining: Math.round(budget.remaining * 10) / 10,
      },
      protein: {
        total: food.protein,
        goal: user.daily_protein_goal,
        remaining: r(user.daily_protein_goal - food.protein),
      },
      carbohydrates: {
        total: food.carbohydrates,
        goal: user.daily_carbs_goal,
        remaining: r(user.daily_carbs_goal - food.carbohydrates),
      },
      fats: {
        total: food.fats,
        goal: user.daily_fats_goal,
        remaining: r(user.daily_fats_goal - food.fats),
      },
      fiber: {
        total: food.fiber,
        goal: user.daily_fiber_goal,
        remaining: r(user.daily_fiber_goal - food.fiber),
      },
    },
    water: {
      total: totalWater,
      goal: user.daily_water_goal,
      remaining: Math.round((user.daily_water_goal - totalWater) * 10) / 10,
    },
    steps: {
      total: budget.steps,
      goal: user.daily_step_goal,
      extra_allowance: budget.steps_credit,
    },
    meals_logged: food.meals_logged,
    exercise_burn: Math.round(budget.exercise_burn),
    budget: {
      base: budget.base,
      runs_raw: Math.round(budget.runs_raw),
      runs_credit: budget.runs_credit,
      workouts_raw: Math.round(budget.workouts_raw),
      workouts_credit: budget.workouts_credit,
      steps_credit: budget.steps_credit,
      total: Math.round(budget.total_goal),
    },
  });
});
