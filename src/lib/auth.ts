import crypto from "node:crypto";
import { NextRequest } from "next/server";
import { prisma } from "./prisma";
import { decrypt } from "./crypto";
import type { AIProvider } from "./models";

const BOT_TOKEN = process.env.BOTFATHER_TOKEN ?? "";
const SKIP_TELEGRAM_AUTH =
  (process.env.SKIP_TELEGRAM_AUTH ?? "false").toLowerCase() === "true";
const DEV_USER_ID = parseInt(process.env.DEV_USER_ID ?? "12345678", 10);

/**
 * How long a signed initData payload stays usable, in seconds.
 *
 * initData is a bearer credential: the signature proves Telegram issued it but
 * says nothing about *when*, so without this an intercepted header would
 * authenticate that user forever. The window has to be generous because the
 * mini-app SDK does not refresh `WebApp.initData` while the app stays open —
 * a short TTL would log out anyone who leaves the app backgrounded. 24h is
 * Telegram's own suggested bound; do not shorten it.
 */
const MAX_AUTH_AGE_SECONDS = 86_400;

interface TelegramUser {
  id: number;
  username?: string;
  first_name?: string;
}

/**
 * Constant-time comparison that tolerates a length mismatch.
 *
 * `crypto.timingSafeEqual` throws `RangeError` when the buffers differ in
 * length, so a malformed `hash=abc` used to escape as an unhandled error and
 * be mapped to a 500 instead of the 401 it is.
 *
 * This duplicates `timingSafeEqualStr` in `@/lib/api-handler` on purpose:
 * api-handler imports this module, so importing it back would close a cycle.
 */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length || ab.length === 0) return false;
  return crypto.timingSafeEqual(ab, bb);
}

export function verifyTelegramAuth(initData: string): TelegramUser {
  if (SKIP_TELEGRAM_AUTH) {
    return { id: DEV_USER_ID, username: "devuser", first_name: "Dev" };
  }

  // Fail closed: with an empty bot token the HMAC secret is a publicly known
  // constant, so anyone could sign an initData payload for any user id.
  // The message deliberately avoids the words "initData"/"hash" so route
  // handlers map it to a 500 (server misconfiguration) rather than a 401.
  if (!BOT_TOKEN) {
    throw new Error("Server misconfigured: BOTFATHER_TOKEN is not set");
  }

  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  params.delete("hash");

  if (!hash) {
    throw new Error("Missing hash in initData");
  }

  const dataCheckString = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");

  const secretKey = crypto
    .createHmac("sha256", "WebAppData")
    .update(BOT_TOKEN)
    .digest();
  const expectedHash = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  if (!safeEqual(expectedHash, hash)) {
    throw new Error("Invalid initData signature");
  }

  // Only meaningful once the signature checks out: `auth_date` is covered by
  // the HMAC, so before that point it is attacker-controlled. `Number(null)`
  // is NaN, so a payload without the field is rejected too. The message keeps
  // the word "initData" on purpose — `AUTH_ERROR_PATTERNS` in
  // `@/lib/api-handler` matches on it to map this to a 401 rather than a 500.
  const authDate = Number(params.get("auth_date"));
  if (
    !Number.isFinite(authDate) ||
    Date.now() / 1000 - authDate > MAX_AUTH_AGE_SECONDS
  ) {
    throw new Error("initData has expired");
  }

  return JSON.parse(params.get("user") ?? "{}");
}

export async function getAuthenticatedUser(request: NextRequest) {
  const initData = request.headers.get("x-telegram-init-data") ?? "";
  const telegramUser = verifyTelegramAuth(initData);

  const user = await prisma.user.findUnique({
    where: { telegram_id: telegramUser.id },
  });

  if (!user) {
    throw new Error("User not found");
  }

  return user;
}

export async function getAuthenticatedUserByToken(request: NextRequest) {
  const authHeader = request.headers.get("authorization") ?? "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match || !match[1]) {
    throw new Error("Missing or invalid Authorization header");
  }
  const token = match[1];

  const user = await prisma.user.findUnique({
    where: { access_token: token },
  });

  if (!user) {
    throw new Error("Invalid access token");
  }

  return user;
}

export async function getAuthenticatedUserFlexible(request: NextRequest) {
  const initData = request.headers.get("x-telegram-init-data");
  if (initData) {
    return getAuthenticatedUser(request);
  }
  return getAuthenticatedUserByToken(request);
}

export function getUserAICredentials(user: {
  ai_provider: string | null;
  ai_api_key: string | null;
  ai_model: string | null;
}): { provider: AIProvider; apiKey: string; model: string | null } {
  if (user.ai_provider && user.ai_api_key) {
    return {
      provider: user.ai_provider as AIProvider,
      apiKey: decrypt(user.ai_api_key),
      model: user.ai_model,
    };
  }

  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    return { provider: "gemini", apiKey: geminiKey, model: null };
  }

  const openrouterKey = process.env.OPENROUTER_API_KEY;
  if (openrouterKey) {
    return { provider: "openrouter", apiKey: openrouterKey, model: null };
  }

  throw new Error("No API key configured. Set one up in Settings.");
}
