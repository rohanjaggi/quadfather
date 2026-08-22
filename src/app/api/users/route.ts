import { NextResponse } from "next/server";
import { Prisma, type User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verifyTelegramAuth } from "@/lib/auth";
import { hasActivityReadScope } from "@/lib/strava";
import { parseJsonStringArray, withErrorHandling } from "@/lib/api-handler";

/**
 * Register (or re-register) the caller.
 *
 * The client calls this on every boot, and React StrictMode double-mounts the
 * provider in dev, so two POSTs can land at once. A find-then-create raced with
 * itself and the loser hit the `telegram_id` unique index (P2002 → 500), so the
 * write is an `upsert`: 201 the first time, 200 for an existing account.
 *
 * The upsert alone still isn't enough — Prisma emulates it with a read followed
 * by a write, so the loser of a tight race can *still* surface P2002 (which the
 * shared error mapper turns into a 409 and `registerUser()` treats as a fatal
 * boot failure). Catching it and re-reading is the last link: by definition the
 * row now exists, and the winner created it, so this request is a 200.
 */
export const POST = withErrorHandling(async (request) => {
  const initData = request.headers.get("x-telegram-init-data") ?? "";
  const telegramUser = verifyTelegramAuth(initData);

  const existing = await prisma.user.findUnique({
    where: { telegram_id: telegramUser.id },
    select: { id: true },
  });

  let raced = false;
  let user: User;
  try {
    user = await prisma.user.upsert({
      where: { telegram_id: telegramUser.id },
      // Nothing to refresh on an existing account — the profile is user-owned,
      // and `username` is only meaningful at sign-up.
      update: {},
      create: {
        telegram_id: telegramUser.id,
        username: telegramUser.username ?? null,
      },
    });
  } catch (e) {
    if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) {
      throw e;
    }
    const reread = await prisma.user.findUnique({
      where: { telegram_id: telegramUser.id },
    });
    // Only a P2002 on `telegram_id` can be re-read this way; anything else that
    // reports P2002 here has no row to find and should still surface as an error.
    if (!reread) throw e;
    user = reread;
    raced = true;
  }

  return NextResponse.json(
    {
      id: user.id,
      telegram_id: Number(user.telegram_id),
      username: user.username,
      first_name: telegramUser.first_name ?? null,
      goals: {
        daily_protein_goal: user.daily_protein_goal,
        daily_calorie_goal: user.daily_calorie_goal,
        daily_water_goal: user.daily_water_goal,
        daily_carbs_goal: user.daily_carbs_goal,
        daily_fats_goal: user.daily_fats_goal,
        daily_fiber_goal: user.daily_fiber_goal,
        daily_step_goal: user.daily_step_goal,
      },
      ...(user.sex && {
        personal: {
          sex: user.sex,
          weight_kg: user.weight_kg,
          height_cm: user.height_cm,
          age: user.age,
          activity_level: user.activity_level,
          fitness_goal: user.fitness_goal,
        },
      }),
      water_bottle_size: user.water_bottle_size,
      ai_provider: user.ai_provider,
      ai_model: user.ai_model,
      has_api_key: !!(user.ai_api_key || process.env.GEMINI_API_KEY || process.env.OPENROUTER_API_KEY),
      dietary_restrictions: parseJsonStringArray(user.dietary_restrictions),
      ai_features_enabled: user.ai_features_enabled,
      ai_coaching_prefs: user.ai_coaching_prefs ?? undefined,
      training_focus: user.training_focus ?? null,
      strava_connected: !!user.strava_access_token,
      // Tokens are stored even when the granted scope lacks activity read, in
      // which case /runs/sync 409s forever — the client needs to know so it can
      // prompt for a reconnect. `true` when not connected (nothing to fix).
      strava_scope_ok: !user.strava_access_token || hasActivityReadScope(user.strava_scope),
      strava_last_synced_at: user.strava_last_synced_at?.toISOString() ?? null,
    },
    { status: existing || raced ? 200 : 201 },
  );
});
