import { NextRequest, NextResponse } from "next/server";
import type { Update } from "grammy/types";
import { BotError } from "grammy";
import { waitUntil } from "@vercel/functions";
import { timingSafeEqualStr } from "@/lib/api-handler";
import { getBot } from "@/lib/telegram-bot";

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET ?? "";

/** Upper bound on grammY's `getMe` call — see `getInitedBot` below. */
const INIT_TIMEOUT_MS = 8000;

// Telegram re-delivers any update the webhook doesn't 2xx quickly, and photo / /log_meal / /coach /
// /insights routinely exceed grammY's 10 s default, duplicating logs and AI spend. So acknowledge
// immediately and run the handler in the background via `waitUntil`.
export const dynamic = "force-dynamic";
export const maxDuration = 60; // Vercel hobby maximum, in seconds.

/** `bot.handleUpdate` needs `bot.botInfo`; cache the init promise so a warm instance calls `getMe` once. */
let initPromise: Promise<void> | null = null;

async function getInitedBot() {
  const bot = getBot();
  if (bot.isInited()) return bot;

  if (!initPromise) {
    // `init` retries `getMe` indefinitely, so cap it, and drop the cache on any outcome that
    // didn't initialise the bot so a failure can't poison later requests. The cast bridges
    // grammY's `abort-controller` shim typing, which clashes with the global `AbortSignal`.
    const signal = AbortSignal.timeout(INIT_TIMEOUT_MS) as unknown as Parameters<
      typeof bot.init
    >[0];
    initPromise = bot.init(signal).finally(() => {
      if (!bot.isInited()) initPromise = null;
    });
  }
  await initPromise;
  return bot;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ secret: string }> },
) {
  // Fail closed: an unset secret must not turn the webhook into an open endpoint.
  if (!WEBHOOK_SECRET) {
    console.error("Webhook misconfigured: WEBHOOK_SECRET is not set");
    return NextResponse.json({ detail: "Webhook misconfigured" }, { status: 500 });
  }

  // Constant-time via the shared helper, which treats a length mismatch as a mismatch
  // (`timingSafeEqual` throws on unequal lengths).
  const { secret } = await params;
  if (!timingSafeEqualStr(secret, WEBHOOK_SECRET)) {
    return NextResponse.json({ detail: "Forbidden" }, { status: 403 });
  }

  let update: Update;
  try {
    update = (await request.json()) as Update;
  } catch (e) {
    console.error("Webhook: could not parse update body:", e);
    return NextResponse.json({ detail: "Bad Request" }, { status: 400 });
  }

  // Init happens before any hand-off, so a 500 here is safe to retry (e.g. empty BOTFATHER_TOKEN throws).
  let bot: Awaited<ReturnType<typeof getInitedBot>>;
  try {
    bot = await getInitedBot();
  } catch (e) {
    console.error("Webhook: bot init failed:", e);
    return NextResponse.json({ detail: "Bot unavailable" }, { status: 500 });
  }

  // Detached on purpose: Telegram gets its 200 now. `waitUntil` is a Vercel primitive and a
  // no-op elsewhere; self-hosting would need a queue or an awaited handler.
  waitUntil(
    bot.handleUpdate(update).catch(async (err) => {
      console.error("Webhook update failed:", err);
      // `handleUpdate` throws the `BotError`; route it to `bot.catch` ourselves so the user-facing reply runs.
      if (err instanceof BotError) {
        try {
          await bot.errorHandler(err);
        } catch (handlerErr) {
          console.error("Webhook: bot error handler threw:", handlerErr);
        }
      }
    }),
  );

  return new Response(null, { status: 200 });
}
