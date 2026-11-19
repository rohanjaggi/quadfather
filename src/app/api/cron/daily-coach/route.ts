import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildDailyCoach, determineNudgeTopic, recordNudge } from "@/lib/coach";
import { getDailyBudget } from "@/lib/budget";
import { addDays, dayKey } from "@/lib/day";
import { escapeHtml } from "@/lib/html";
import { clampHtml, sendHtml, TELEGRAM_TEXT_LIMIT } from "@/lib/telegram-bot";
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

export async function GET(request: NextRequest) {
  return forEachCronUser(request, "daily_coach", "Daily coach", async (user, ai) => {
    const thirtyDaysAgo = new Date(`${addDays(dayKey(), -30)}T00:00:00Z`);
    // Canonical budget — identical maths to the dashboard (/api/users/me).
    const [budget, recentSteps] = await Promise.all([
      getDailyBudget(user),
      prisma.stepLog.findMany({ where: { user_id: user.id, date: { gte: thirtyDaysAgo } }, orderBy: { date: 'desc' } }),
    ]);

    if (budget.food.meals_logged === 0 && budget.logs.workouts.length === 0) return false;

    const todayStepCount = budget.steps;
    const currentStreak = stepStreakEndingYesterday(recentSteps, user.daily_step_goal);

    const message = await buildDailyCoach(user, ai, budget, currentStreak);

    // Check for proactive nudge
    const coachPrefs = user.ai_coaching_prefs as Record<string, boolean> | null;
    const nudgeTopic = await determineNudgeTopic(user.id, user.daily_step_goal, coachPrefs, budget, recentSteps);
    let nudgeText = "";
    if (nudgeTopic) {
      const nudgeLabels: Record<string, string> = {
        inactivity: "You haven't worked out in a while — even a short session helps!",
        recovery: "You've been training hard — consider a rest day for recovery.",
        nutrition_gap: "Big burn today but intake is low — prioritise protein tonight.",
        consistency: "Great consistency this week — keep the momentum going!",
        // A streak of 1 isn't worth protecting; mention from 2 days up.
        steps: `You're at ${todayStepCount.toLocaleString()} steps — ${Math.max(0, user.daily_step_goal - todayStepCount).toLocaleString()} more to hit your goal.${currentStreak >= 2 ? ` Don't break your ${currentStreak}-day streak!` : ''}`,
      };
      // Escaped once, here; the result is interpolated raw below.
      nudgeText = `\n\n\u{1F4A1} ${escapeHtml(nudgeLabels[nudgeTopic] ?? "")}`;
    }

    // Telegram 400s past 4096 characters with no placeholder to fall back on. The nudge is
    // budgeted separately because `recordNudge` burns the 48 h cooldown, so a clipped nudge
    // would count as delivered.
    await sendHtml(
      user.telegram_id,
      clampHtml(
        `\u{1F4AC} <b>Daily Coach</b>\n\n${escapeHtml(message)}`,
        TELEGRAM_TEXT_LIMIT - nudgeText.length,
      ) + nudgeText,
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
