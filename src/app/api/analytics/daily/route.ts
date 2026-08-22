import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withUser, optionalInt } from "@/lib/api-handler";

export const GET = withUser(async (request, user) => {
  // `?days=abc` used to be NaN, which passed the `< 1 || > 90` check and then
  // built a window from Invalid Dates.
  const days =
    optionalInt(request.nextUrl.searchParams.get("days"), "days", { min: 1, max: 90 }) ?? 7;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Day boundaries, oldest first. Built with exactly the local-midnight
  // arithmetic the per-day loop used (local `setHours`, UTC-formatted label) —
  // the local-vs-UTC mismatch in here is a known, separate piece of work, so
  // this rewrite must not quietly change which log lands in which bucket.
  const buckets: { start: number; end: number; label: string }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const dayStart = new Date(today);
    dayStart.setDate(dayStart.getDate() - i);
    const dayEnd = new Date(dayStart);
    dayEnd.setHours(23, 59, 59, 999);
    buckets.push({ start: dayStart.getTime(), end: dayEnd.getTime(), label: dayStart.toISOString().split("T")[0] });
  }

  const rangeStart = new Date(buckets[0].start);
  const rangeEnd = new Date(buckets[buckets.length - 1].end);

  // Two queries for the whole range instead of two per day: `?days=90` used to
  // issue 180 round-trips to render one chart.
  const [foodLogs, waterLogs] = await Promise.all([
    prisma.foodLog.findMany({
      where: { user_id: user.id, logged_at: { gte: rangeStart, lte: rangeEnd } },
      select: { logged_at: true, calories: true, protein: true, carbohydrates: true, fats: true, fiber: true },
    }),
    prisma.waterLog.findMany({
      where: { user_id: user.id, logged_at: { gte: rangeStart, lte: rangeEnd } },
      select: { logged_at: true, amount_liters: true },
    }),
  ]);

  // Binary search rather than `(t - start) / DAY_MS`: the boundaries are local
  // midnights, so a DST day is 23 or 25 hours long and fixed-width arithmetic
  // would shift a whole day's logs into the neighbouring bucket.
  const bucketIndex = (t: number): number => {
    let lo = 0;
    let hi = buckets.length - 1;
    let found = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (t < buckets[mid].start) hi = mid - 1;
      else {
        found = mid;
        lo = mid + 1;
      }
    }
    // `<= end` keeps the old per-day `lte: dayEnd` semantics exactly.
    return found >= 0 && t <= buckets[found].end ? found : -1;
  };

  const foodByDay: (typeof foodLogs)[] = buckets.map(() => []);
  const waterByDay: (typeof waterLogs)[] = buckets.map(() => []);
  for (const log of foodLogs) {
    const i = bucketIndex(log.logged_at.getTime());
    if (i >= 0) foodByDay[i].push(log);
  }
  for (const log of waterLogs) {
    const i = bucketIndex(log.logged_at.getTime());
    if (i >= 0) waterByDay[i].push(log);
  }

  const result = buckets.map((bucket, i) => {
    const dayFood = foodByDay[i];
    const dayWater = waterByDay[i];
    return {
      date: bucket.label,
      calories: Math.round(
        dayFood.reduce((s, l) => s + (l.calories ?? 0), 0),
      ),
      protein:
        Math.round(
          dayFood.reduce((s, l) => s + (l.protein ?? 0), 0) * 10,
        ) / 10,
      carbohydrates:
        Math.round(
          dayFood.reduce((s, l) => s + (l.carbohydrates ?? 0), 0) * 10,
        ) / 10,
      fats:
        Math.round(
          dayFood.reduce((s, l) => s + (l.fats ?? 0), 0) * 10,
        ) / 10,
      fiber:
        Math.round(
          dayFood.reduce((s, l) => s + (l.fiber ?? 0), 0) * 10,
        ) / 10,
      water:
        Math.round(
          dayWater.reduce((s, l) => s + l.amount_liters, 0) * 100,
        ) / 100,
      meals_logged: dayFood.length,
    };
  });

  return NextResponse.json({
    days: result,
    goals: {
      calories: user.daily_calorie_goal,
      protein: user.daily_protein_goal,
      carbohydrates: user.daily_carbs_goal,
      fats: user.daily_fats_goal,
      fiber: user.daily_fiber_goal,
      water: user.daily_water_goal,
    },
  });
});
