import { NextResponse } from "next/server";
import { GrammyError } from "grammy";
import { getBot, setupBotCommands } from "@/lib/telegram-bot";
import {
  ApiError,
  timingSafeEqualStr,
  withErrorHandling,
} from "@/lib/api-handler";

const BOT_TOKEN = process.env.BOTFATHER_TOKEN ?? "";
const WEBHOOK_URL = process.env.WEBHOOK_URL ?? "";
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET ?? "";

/**
 * One-shot bot bootstrap: registers commands and points Telegram's webhook here,
 * authenticated with the bot token. Fails closed when `BOTFATHER_TOKEN`,
 * `WEBHOOK_URL` or `WEBHOOK_SECRET` is unset, so no one can re-point the webhook.
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

  // grammY throws on Telegram's `ok: false`; pass Telegram's reason on to the admin.
  let result: true;
  try {
    result = await getBot().api.setWebhook(`${WEBHOOK_URL}/api/webhook/${WEBHOOK_SECRET}`);
  } catch (err) {
    if (err instanceof GrammyError) throw new ApiError(502, err.description);
    throw err;
  }

  return NextResponse.json({
    commands: "registered",
    webhook: result,
  });
});
