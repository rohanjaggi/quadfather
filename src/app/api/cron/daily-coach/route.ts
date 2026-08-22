import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateDailyCoach } from "@/lib/ai";
import type { AIProvider } from "@/lib/models";
import { decrypt } from "@/lib/crypto";
import { determineNudgeTopic, recordNudge } from "@/lib/coach";
import { getDailyBudget } from "@/lib/budget";
import { escapeHtml } from "@/lib/html";
import { clampHtml, TELEGRAM_TEXT_LIMIT } from "@/lib/telegram-bot";
import { checkCronAuth } from "../auth";
import { Bot } from "grammy";

const BOT_TOKEN = process.env.BOTFATHER_TOKEN ?? "";
const DAY_MS = 86400000;

/**
 * Number of consecutive calendar days *ending yesterday* on which the user hit
 * their step goal.
 *
 * Yesterday is the last day that can count: today is still in progress, so a
 * streak that included it would drop back to 0 every morning (the old code
 * started at today, saw a partial count below goal, and broke out immediately —
 * the streak was therefore always 0 and the "don't break your streak" line was
 * unreachable). Days are UTC days because that is how `StepLog.date` is stored,
 * and a missing day breaks the streak — the old loop walked the sorted list and
 * happily counted non-consecutive dates.
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

  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  let streak = 0;
  // Bounded by the number of distinct days we fetched — the streak can never
  // be longer than that, and the loop always terminates.
  for (let back = 1; back <= byDay.size; back++) {
    const day = new Date(todayStart.getTime() - back * DAY_MS)
      .toISOString()
      .slice(0, 10);
    const steps = byDay.get(day);
    if (steps === undefined || steps < goal) break;
    streak++;
  }
  return streak;
}

function getAICredentials(user: { ai_provider: string | null; ai_api_key: string | null; ai_model: string | null }) {
  if (user.ai_provider && user.ai_api_key) {
    return { provider: user.ai_provider as AIProvider, apiKey: decrypt(user.ai_api_key), model: user.ai_model };
  }
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) return { provider: "gemini" as AIProvider, apiKey: geminiKey, model: null as string | null };
  const openrouterKey = process.env.OPENROUTER_API_KEY;
  if (openrouterKey) return { provider: "openrouter" as AIProvider, apiKey: openrouterKey, model: null as string | null };
  return null;
}

export async function GET(request: NextRequest) {
  const authFailure = checkCronAuth(request);
  if (authFailure) return authFailure;

  const users = await prisma.user.findMany({
    where: { ai_features_enabled: true },
  });

  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const bot = new Bot(BOT_TOKEN);
  let sent = 0;

  for (const user of users) {
    const coachPrefs = user.ai_coaching_prefs as Record<string, boolean> | null;
    if (coachPrefs?.daily_coach === false) continue;

    try {
      // Inside the per-user try: `getAICredentials` calls `decrypt`, which throws
      // on a rotated ENCRYPTION_KEY, a corrupt ciphertext, or a legacy plaintext
      // key. Outside, that throw escaped the loop and 500'd the whole cron, so
      // one user with an unreadable key meant *nobody* got a digest that day.
      const creds = getAICredentials(user);
      if (!creds) continue;

      const thirtyDaysAgo = new Date(todayStart.getTime() - 30 * DAY_MS);
      // Canonical budget — identical maths to the dashboard (/api/users/me).
      const [budget, recentSteps] = await Promise.all([
        getDailyBudget(user, todayStart),
        prisma.stepLog.findMany({ where: { user_id: user.id, date: { gte: thirtyDaysAgo } }, orderBy: { date: 'desc' } }),
      ]);

      if (budget.food.meals_logged === 0 && budget.logs.workouts.length === 0) continue;

      const consumed = {
        calories: Math.round(budget.food.calories),
        protein: Math.round(budget.food.protein),
        carbs: Math.round(budget.food.carbohydrates),
        fats: Math.round(budget.food.fats),
      };
      const meals = budget.logs.food.map(l => l.food_name).filter((n): n is string => !!n);
      const waterConsumed = budget.water_liters;
      // Raw burn — what the coach talks about ("you burned ~X today"). The
      // dampened half of it is already inside `total_goal`, and the prompt says
      // so, so the model must not add it to the goal a second time.
      const exerciseCalories = budget.runs_raw + budget.workouts_raw;
      const dietaryRestrictions: string[] = user.dietary_restrictions
        ? JSON.parse(user.dietary_restrictions) : [];

      const todayStepCount = budget.steps;
      const currentStreak = stepStreakEndingYesterday(recentSteps, user.daily_step_goal);
      const stepAllowance = budget.steps_credit;

      const message = await generateDailyCoach(creds.provider, creds.apiKey, creds.model, {
        // Exercise/step credits are already folded into total_goal.
        goals: { calories: Math.round(budget.total_goal), protein: user.daily_protein_goal },
        consumed,
        meals,
        waterConsumed,
        waterGoal: user.daily_water_goal,
        exerciseCalories,
        dietaryRestrictions,
        steps: {
          today: todayStepCount,
          goal: user.daily_step_goal,
          streak: currentStreak,
          extraAllowance: stepAllowance,
        },
      });

      // Check for proactive nudge
      const nudgeTopic = await determineNudgeTopic(user.id, user.daily_step_goal, coachPrefs);
      let nudgeText = "";
      if (nudgeTopic) {
        const nudgeLabels: Record<string, string> = {
          inactivity: "You haven't worked out in a while — even a short session helps!",
          recovery: "You've been training hard — consider a rest day for recovery.",
          nutrition_gap: "Big burn today but intake is low — prioritise protein tonight.",
          consistency: "Great consistency this week — keep the momentum going!",
          // A "streak" of 1 isn't a streak worth protecting, so only mention it
          // from 2 consecutive goal-hitting days up.
          steps: `You're at ${todayStepCount.toLocaleString()} steps — ${Math.max(0, user.daily_step_goal - todayStepCount).toLocaleString()} more to hit your goal.${currentStreak >= 2 ? ` Don't break your ${currentStreak}-day streak!` : ''}`,
        };
        // Escaped once, here; the result is interpolated raw below.
        nudgeText = `\n\n\u{1F4A1} ${escapeHtml(nudgeLabels[nudgeTopic] ?? "")}`;
      }

      // Telegram 400s on anything over 4096 characters and there is no
      // placeholder to fall back to here, so a chatty model meant the user got
      // nothing at all. The nudge is budgeted for separately rather than being
      // truncated away: `recordNudge` below burns the 48 h cooldown, so a nudge
      // clipped off the end would be marked as delivered without being seen.
      await bot.api.sendMessage(
        Number(user.telegram_id),
        clampHtml(
          `\u{1F4AC} <b>Daily Coach</b>\n\n${escapeHtml(message)}`,
          TELEGRAM_TEXT_LIMIT - nudgeText.length,
        ) + nudgeText,
        { parse_mode: "HTML" },
      );
      sent++;

      // Only *after* the message actually reached Telegram. Recording the nudge
      // first burned the 48 h per-topic cooldown on sends that failed (user
      // blocked the bot, HTML parse error, rate limit), so the nudge was
      // silently skipped for two days having never been seen.
      if (nudgeTopic) {
        try {
          await recordNudge(user.id, nudgeTopic);
        } catch (err) {
          console.error(`Recording nudge failed for user ${user.id}:`, err);
        }
      }
    } catch (err) {
      console.error(`Daily coach failed for user ${user.id}:`, err);
    }
  }

  return NextResponse.json({ sent, total: users.length });
}
