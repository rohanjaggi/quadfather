import { NextRequest, NextResponse } from "next/server";
import { setupBotCommands } from "@/lib/telegram-bot";

const BOT_TOKEN = process.env.BOTFATHER_TOKEN ?? "";
const WEBHOOK_URL = process.env.WEBHOOK_URL ?? "";
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET ?? "";

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${BOT_TOKEN}`) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }

  try {
    // Register command menu
    await setupBotCommands();

    // Set webhook
    const webhookUrl = `${WEBHOOK_URL}/api/webhook/${WEBHOOK_SECRET}`;
    const res = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: webhookUrl }),
      },
    );
    const result = await res.json();

    return NextResponse.json({
      commands: "registered",
      webhook: result,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Setup failed" },
      { status: 500 },
    );
  }
}
