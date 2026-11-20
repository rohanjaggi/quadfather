import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  parseJsonBody,
  requireNumber,
  unprocessable,
  withUser,
} from "@/lib/api-handler";
import { dayRange } from "@/lib/day";
import { WATER_LOG_SELECT } from "@/lib/selects";

/** Sanity ceilings — a single log is one drink, not a day's intake. */
const MAX_LITERS = 10;
const MAX_BOTTLES = 50;

export const GET = withUser(async (request, user) => {
  const logs = await prisma.waterLog.findMany({
    where: { user_id: user.id, logged_at: { gte: dayRange().start } },
    orderBy: { logged_at: "desc" },
    select: WATER_LOG_SELECT,
  });

  return NextResponse.json(logs);
});

export const POST = withUser(async (request, user) => {
  const body = await parseJsonBody(request);

  if (body.amount_liters == null && body.bottles == null) {
    throw unprocessable("Provide either amount_liters or bottles");
  }

  const bottleSize = user.water_bottle_size;
  let amountLiters: number;
  let bottles: number | null;

  if (body.bottles != null) {
    // Reject `"2"` (NaN) and negative/0 amounts, which would corrupt the day's total.
    const count = requireNumber(body.bottles, "bottles", { max: MAX_BOTTLES });
    if (count <= 0) throw unprocessable("bottles must be greater than 0");
    if (!(bottleSize > 0)) {
      throw unprocessable("Set a bottle size in Settings before logging bottles");
    }
    amountLiters = count * bottleSize;
    bottles = count;
  } else {
    const liters = requireNumber(body.amount_liters, "amount_liters", { max: MAX_LITERS });
    if (liters <= 0) throw unprocessable("amount_liters must be greater than 0");
    amountLiters = liters;
    bottles = bottleSize > 0 ? Math.round((amountLiters / bottleSize) * 100) / 100 : null;
  }

  const log = await prisma.waterLog.create({
    data: {
      user_id: user.id,
      amount_liters: amountLiters,
      bottles,
      water_bottle_size: bottleSize,
    },
    select: WATER_LOG_SELECT,
  });

  return NextResponse.json(log, { status: 201 });
});
