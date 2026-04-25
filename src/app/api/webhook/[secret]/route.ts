import { NextRequest, NextResponse } from "next/server";
import { webhookCallback } from "grammy";
import { getBot } from "@/lib/telegram-bot";

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET ?? "";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ secret: string }> },
) {
  try {
    const { secret } = await params;
    if (WEBHOOK_SECRET && secret !== WEBHOOK_SECRET) {
      return NextResponse.json({ detail: "Forbidden" }, { status: 403 });
    }

    const handleUpdate = webhookCallback(getBot(), "std/http");
    return handleUpdate(request);
  } catch (e) {
    console.error("Webhook error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 },
    );
  }
}
