import { NextResponse } from "next/server";
import { setupBotCommands } from "@/lib/telegram-bot";
import {
  ApiError,
  timingSafeEqualStr,
  withErrorHandling,
} from "@/lib/api-handler";

const BOT_TOKEN = process.env.BOTFATHER_TOKEN ?? "";
const WEBHOOK_URL = process.env.WEBHOOK_URL ?? "";
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET ?? "";

/**
 * One-shot bot bootstrap: registers the command list and points Telegram's
 * webhook at this deployment. Authenticated with the bot token itself.
 *
 * Fails closed on misconfiguration. Previously an unset `BOTFATHER_TOKEN` made
 * the guard compare against the literal `"Bearer "`, so anyone could re-point
 * the webhook; an unset `WEBHOOK_URL`/`WEBHOOK_SECRET` would have registered a
 * garbage URL that no route matches, silently killing the bot.
 */
export const POST = withErrorHandling(async (request) => {
  if (!BOT_TOKEN || !WEBHOOK_URL || !WEBHOOK_SECRET) {
    console.error(
      "bot/setup: BOTFATHER_TOKEN, WEBHOOK_URL and WEBHOOK_SECRET must all be set",
    );
    throw new ApiError(500, "Server misconfigured");
  }

  // Constant-time — the bot token is the credential being checked here.
  const authHeader = request.headers.get("authorization") ?? "";
  if (!timingSafeEqualStr(authHeader, `Bearer ${BOT_TOKEN}`)) {
    throw new ApiError(401, "Unauthorized");
  }

  await setupBotCommands();

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
});
