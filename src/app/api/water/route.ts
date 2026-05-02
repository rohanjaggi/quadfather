import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);

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

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    const body = await request.json();

    if (body.amount_liters == null && body.bottles == null) {
      return NextResponse.json(
        { detail: "Provide either amount_liters or bottles" },
        { status: 422 },
      );
    }

    const bottleSize = user.water_bottle_size;
    let amountLiters: number;
    let bottles: number | null;

    if (body.bottles != null) {
      amountLiters = body.bottles * bottleSize;
      bottles = body.bottles;
    } else {
      amountLiters = body.amount_liters ?? 0;
      bottles = bottleSize
        ? Math.round((amountLiters / bottleSize) * 100) / 100
        : null;
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
