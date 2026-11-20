import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildCloseTheDay, determineNudgeTopic, recordNudge, type NudgeTopic } from "@/lib/coach";
import { getDailyBudget } from "@/lib/budget";
import { addDays, dayKey } from "@/lib/day";
import { escapeHtml } from "@/lib/html";
import { clampHtml, closeDayKeyboard, sendHtml, TELEGRAM_TEXT_LIMIT } from "@/lib/telegram-bot";
import { forEachCronUser } from "../auth";

/**
 * Consecutive days ending yesterday on which the user hit their step goal: today is still
 * in progress, and a missing day breaks the streak. Days are the `StepLog.date` keys.
 */
function stepStreakEndingYesterday(
  logs: { date: Date; steps: number }[],
  goal: number,
): number {
  if (goal <= 0) return 0;

  const byDay = new Map<string, number>();
  for (const log of logs) {
    const key = log.date.toISOString().slice(0, 10);
    byDay.set(key, Math.max(byDay.get(key) ?? 0, log.steps));
  }

  const today = dayKey();
  let streak = 0;
  // Bounded by the number of distinct days fetched.
  for (let back = 1; back <= byDay.size; back++) {
    const steps = byDay.get(addDays(today, -back));
    if (steps === undefined || steps < goal) break;
    streak++;
  }
  return streak;
}

/** "Close the day" (the `daily_coach` pref): a deterministic summary of today, no AI call. */
export async function GET(request: NextRequest) {
  return forEachCronUser(request, "daily_coach", "Close the day", async (user) => {
    // Canonical budget — identical maths to the dashboard (/api/users/me).
    const budget = await getDailyBudget(user);

    const { html, hasLogs } = buildCloseTheDay({
      kcal: budget.food.calories,
      kcalBudget: budget.total_goal,
      protein: budget.food.protein,
      proteinGoal: user.daily_protein_goal,
      waterLiters: budget.water_liters,
      waterGoal: user.daily_water_goal,
      steps: budget.logs.step?.steps ?? null,
      stepGoal: user.daily_step_goal,
      meals: budget.food.meals_logged,
      sessions: [
        ...budget.logs.workouts.map((w) => w.name),
        ...budget.logs.runs.map((r) => r.name || "Run"),
      ],
    });

    // Nudges are opt-in (`determineNudgeTopic`), and the nothing-logged version stays short.
    let nudgeTopic: NudgeTopic | null = null;
    let nudgeText = "";
    if (hasLogs) {
      const thirtyDaysAgo = new Date(`${addDays(dayKey(), -30)}T00:00:00Z`);
      const recentSteps = await prisma.stepLog.findMany({
        where: { user_id: user.id, date: { gte: thirtyDaysAgo } },
        orderBy: { date: "desc" },
      });
      const coachPrefs = user.ai_coaching_prefs as Record<string, boolean> | null;
      nudgeTopic = await determineNudgeTopic(user.id, user.daily_step_goal, coachPrefs, budget, recentSteps);
      if (nudgeTopic) {
        const steps = budget.steps;
        const streak = stepStreakEndingYesterday(recentSteps, user.daily_step_goal);
        const nudgeLabels: Record<NudgeTopic, string> = {
          inactivity: "You haven't worked out in a while — even a short session helps!",
          recovery: "You've been training hard — consider a rest day for recovery.",
          nutrition_gap: "Big burn today but intake is low — prioritise protein tonight.",
          consistency: "Great consistency this week — keep the momentum going!",
          // A streak of 1 isn't worth protecting; mention from 2 days up.
          steps: `You're at ${steps.toLocaleString()} steps — ${Math.max(0, user.daily_step_goal - steps).toLocaleString()} more to hit your goal.${streak >= 2 ? ` Don't break your ${streak}-day streak!` : ""}`,
        };
        // Escaped once, here; the result is interpolated raw below.
        nudgeText = `\n\n<i>${escapeHtml(nudgeLabels[nudgeTopic])}</i>`;
      }
    }

    // The nudge is budgeted separately because `recordNudge` burns the 48 h cooldown, so a
    // clipped nudge would count as delivered.
    await sendHtml(
      user.telegram_id,
      clampHtml(html, TELEGRAM_TEXT_LIMIT - nudgeText.length) + nudgeText,
      closeDayKeyboard(hasLogs),
    );

    // Only after the message reached Telegram: recording first burned the 48 h cooldown on failed sends.
    if (nudgeTopic) {
      try {
        await recordNudge(user.id, nudgeTopic);
      } catch (err) {
        console.error(`Recording nudge failed for user ${user.id}:`, err);
      }
    }
    return true;
  });
}
