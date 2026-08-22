import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Without this the route reads nothing from the request, so Next prerenders it
// at build time and every probe gets a cached 200 — including while the
// database is down.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok" });
  } catch (e) {
    console.error("Health check failed:", e);
    return NextResponse.json({ status: "degraded" }, { status: 503 });
  }
}
