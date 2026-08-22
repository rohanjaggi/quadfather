import { NextRequest, NextResponse } from "next/server";
import type { Update } from "grammy/types";
import { BotError } from "grammy";
import { waitUntil } from "@vercel/functions";
import { timingSafeEqualStr } from "@/lib/api-handler";
import { getBot } from "@/lib/telegram-bot";

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET ?? "";

/** Upper bound on grammY's `getMe` call — see `getInitedBot` below. */
const INIT_TIMEOUT_MS = 8000;

// Telegram re-delivers an update whenever the webhook does not answer 2xx
// quickly. Photo / /log_meal / /coach / /insights all do file download + LLM +
// DB write and routinely exceed grammY's 10 s default timeout, which produced
// duplicate food logs and duplicate AI spend. So: acknowledge the update
// immediately and let the handler run in the background via `waitUntil`.
export const dynamic = "force-dynamic";
export const maxDuration = 60; // Vercel hobby maximum, in seconds.

/**
 * `bot.handleUpdate` requires `bot.botInfo`, which `webhookCallback` used to
 * populate implicitly. Cache the init promise module-level so a warm instance
 * only calls `getMe` once.
 */
let initPromise: Promise<void> | null = null;

async function getInitedBot() {
  const bot = getBot();
  if (bot.isInited()) return bot;

  if (!initPromise) {
    // `init` retries `getMe` *indefinitely* on network / 5xx errors, so without
    // a signal the cached promise can stay pending forever on a warm instance
    // and wedge every later request. Cap it, and drop the cache on any outcome
    // that did not actually initialise the bot (timeout, abort, rejection) so
    // the next request gets a fresh attempt rather than a poisoned promise.
    // The cast bridges a grammY typing wart: it declares `signal` with the
    // `abort-controller` shim it carries for Deno compatibility, which is
    // structurally incompatible with the global `AbortSignal` even though this
    // is exactly the object it forwards to `fetch`.
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

  // Constant-time: the shared helper also treats a length mismatch (and the
  // empty string) as a plain mismatch, since `timingSafeEqual` throws on
  // unequal buffer lengths and the length of a URL path segment is not a
  // secret worth protecting.
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

  // Construction / init happens *before* anything has been handed off, so no
  // side effect has occurred yet: a 500 here is safe to retry and surfaces the
  // outage (e.g. an empty BOTFATHER_TOKEN makes `new Bot("")` throw).
  let bot: Awaited<ReturnType<typeof getInitedBot>>;
  try {
    bot = await getInitedBot();
  } catch (e) {
    console.error("Webhook: bot init failed:", e);
    return NextResponse.json({ detail: "Bot unavailable" }, { status: 500 });
  }

  // Detached on purpose: Telegram gets its 200 now and the handler keeps
  // running in the background.
  //
  // NOTE: `waitUntil` is a Vercel primitive and is a no-op outside a Vercel
  // request context — self-hosting this route would need a different mechanism
  // (a queue, or simply awaiting the handler and accepting the retry risk).
  waitUntil(
    bot.handleUpdate(update).catch(async (err) => {
      console.error("Webhook update failed:", err);
      // `handleUpdate` (singular) *throws* the `BotError`; only the private
      // `handleUpdates` (plural) feeds it to `bot.catch`. Route it ourselves so
      // the user-facing "something went wrong" reply in `bot.catch` still runs.
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
