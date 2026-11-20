import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withUser } from "@/lib/api-handler";
import { daysAgoStart } from "@/lib/day";
import { FOOD_LOG_SELECT, foodLogRow } from "@/lib/selects";
import { distinctRecent } from "@/components/food/meals";

const WINDOW_DAYS = 30;
const LIMIT = 10;
// shortcut: dedupes the newest 300 logs in JS; move to SQL DISTINCT ON if someone logs 300+ meals a month
const SCAN = 300;

/** The user's last few different meals, newest first, for one-tap "Log again". */
export const GET = withUser(async (request, user) => {
  const logs = await prisma.foodLog.findMany({
    where: { user_id: user.id, logged_at: { gte: daysAgoStart(WINDOW_DAYS) }, food_name: { not: null } },
    orderBy: { logged_at: "desc" },
    take: SCAN,
    select: FOOD_LOG_SELECT,
  });

  return NextResponse.json(
    distinctRecent(logs.map((l) => ({ ...foodLogRow(l), food_name: l.food_name ?? "" })), LIMIT),
  );
});
