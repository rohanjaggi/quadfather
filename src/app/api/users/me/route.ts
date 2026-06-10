import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/auth";
import { calculateStepAllowance } from "@/lib/steps";

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);

    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setUTCHours(23, 59, 59, 999);

    const [foodLogs, waterLogs, runLogs, workoutLogs, stepLog] = await Promise.all([
      prisma.foodLog.findMany({
        where: { user_id: user.id, logged_at: { gte: todayStart } },
      }),
      prisma.waterLog.findMany({
        where: { user_id: user.id, logged_at: { gte: todayStart } },
      }),
      prisma.runLog.findMany({
        where: {
          user_id: user.id,
          run_date: { gte: todayStart, lte: todayEnd },
        },
      }),
      prisma.workoutLog.findMany({
        where: {
          user_id: user.id,
          workout_date: { gte: todayStart, lte: todayEnd },
        },
      }),
      prisma.stepLog.findFirst({
        where: { user_id: user.id, date: todayStart },
        orderBy: { logged_at: 'desc' },
      }),
    ]);

    const totalCalories = foodLogs.reduce((s, l) => s + (l.calories ?? 0), 0);
    const totalProtein = foodLogs.reduce((s, l) => s + (l.protein ?? 0), 0);
    const totalCarbs = foodLogs.reduce((s, l) => s + (l.carbohydrates ?? 0), 0);
    const totalFats = foodLogs.reduce((s, l) => s + (l.fats ?? 0), 0);
    const totalFiber = foodLogs.reduce((s, l) => s + (l.fiber ?? 0), 0);
    const totalWater = waterLogs.reduce((s, l) => s + l.amount_liters, 0);

    const DAMPENING = 0.5;
    const runBurnRaw = runLogs.reduce((s, r) => s + r.calories_burned, 0);
    const workoutBurnRaw = workoutLogs.reduce((s, w) => s + (w.calories_burned ?? 0), 0);
    const runBurnDampened = Math.round(runBurnRaw * DAMPENING);
    const workoutBurnDampened = Math.round(workoutBurnRaw * DAMPENING);
    const exerciseBurn = runBurnDampened + workoutBurnDampened;

    const todaySteps = stepLog?.steps ?? 0;
    const stepAllowance = calculateStepAllowance(
      todaySteps,
      user.activity_level,
      user.weight_kg,
    );

    const totalGoal = user.daily_calorie_goal + exerciseBurn + stepAllowance;
    const r = (v: number) => Math.round(v * 10) / 10;

    return NextResponse.json({
      date: todayStart.toISOString().split("T")[0],
      macros: {
        calories: {
          total: totalCalories,
          goal: totalGoal,
          remaining: Math.round((totalGoal - totalCalories) * 10) / 10,
        },
        protein: {
          total: totalProtein,
          goal: user.daily_protein_goal,
          remaining: r(user.daily_protein_goal - totalProtein),
        },
        carbohydrates: {
          total: totalCarbs,
          goal: user.daily_carbs_goal,
          remaining: r(user.daily_carbs_goal - totalCarbs),
        },
        fats: {
          total: totalFats,
          goal: user.daily_fats_goal,
          remaining: r(user.daily_fats_goal - totalFats),
        },
        fiber: {
          total: totalFiber,
          goal: user.daily_fiber_goal,
          remaining: r(user.daily_fiber_goal - totalFiber),
        },
      },
      water: {
        total: totalWater,
        goal: user.daily_water_goal,
        remaining: Math.round((user.daily_water_goal - totalWater) * 10) / 10,
      },
      steps: {
        total: todaySteps,
        goal: user.daily_step_goal,
        extra_allowance: stepAllowance,
      },
      meals_logged: foodLogs.length,
      exercise_burn: Math.round(exerciseBurn),
      budget: {
        base: user.daily_calorie_goal,
        runs_raw: Math.round(runBurnRaw),
        runs_credit: runBurnDampened,
        workouts_raw: Math.round(workoutBurnRaw),
        workouts_credit: workoutBurnDampened,
        steps_credit: stepAllowance,
        total: Math.round(totalGoal),
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Internal error";
    if (message === "User not found") {
      return NextResponse.json({ detail: message }, { status: 404 });
    }
    if (message.includes("initData") || message.includes("hash")) {
      return NextResponse.json({ detail: message }, { status: 401 });
    }
    return NextResponse.json({ detail: message }, { status: 500 });
  }
}
