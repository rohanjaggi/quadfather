import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  parseJsonBody,
  requireNumber,
  unprocessable,
  withUser,
} from "@/lib/api-handler";

/** Sanity ceilings — a single log is one drink, not a day's intake. */
const MAX_LITERS = 10;
const MAX_BOTTLES = 50;

export const GET = withUser(async (request, user) => {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const logs = await prisma.waterLog.findMany({
    where: { user_id: user.id, logged_at: { gte: todayStart } },
    orderBy: { logged_at: "desc" },
  });

  return NextResponse.json(
    logs.map((log) => ({
      id: log.id,
      amount_liters: log.amount_liters,
      bottles: log.bottles,
      water_bottle_size: log.water_bottle_size,
      logged_at: log.logged_at.toISOString(),
    })),
  );
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
    // `"2"` used to become `"2" * size` → NaN and a 500; a negative or 0 wrote
    // a row that quietly reduced (or did nothing to) the day's total.
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
  });

  return NextResponse.json(
    {
      id: log.id,
      amount_liters: log.amount_liters,
      bottles: log.bottles,
      water_bottle_size: log.water_bottle_size,
      logged_at: log.logged_at.toISOString(),
    },
    { status: 201 },
  );
});
