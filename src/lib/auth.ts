import crypto from "node:crypto";
import { NextRequest } from "next/server";
import { prisma } from "./prisma";
import { decrypt } from "./crypto";
import { ApiError, timingSafeEqualStr } from "./api-error";
import type { AICredentials, AIProvider } from "./models";

const BOT_TOKEN = process.env.BOTFATHER_TOKEN ?? "";
const SKIP_TELEGRAM_AUTH =
  (process.env.SKIP_TELEGRAM_AUTH ?? "false").toLowerCase() === "true";
const DEV_USER_ID = parseInt(process.env.DEV_USER_ID ?? "12345678", 10);

/**
 * How long signed initData stays usable, in seconds. It is a bearer credential and the
 * signature says nothing about age. Generous because the SDK doesn't refresh `WebApp.initData`
 * while the app stays open; 24h is Telegram's own suggested bound, do not shorten it.
 */
const MAX_AUTH_AGE_SECONDS = 86_400;

interface TelegramUser {
  id: number;
  username?: string;
  first_name?: string;
}

export function verifyTelegramAuth(initData: string): TelegramUser {
  if (SKIP_TELEGRAM_AUTH) {
    return { id: DEV_USER_ID, username: "devuser", first_name: "Dev" };
  }

  // Fail closed: with an empty bot token the HMAC secret is a publicly known
  // constant, so anyone could sign an initData payload for any user id.
  if (!BOT_TOKEN) {
    throw new Error("Server misconfigured: BOTFATHER_TOKEN is not set");
  }

  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  params.delete("hash");

  if (!hash) {
    throw new ApiError(401, "Missing hash in initData");
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

  if (!timingSafeEqualStr(expectedHash, hash)) {
    throw new ApiError(401, "Invalid initData signature");
  }

  // Only meaningful after the signature checks: `auth_date` is HMAC-covered. `Number(null)` is NaN, so a missing field is rejected.
  const authDate = Number(params.get("auth_date"));
  if (
    !Number.isFinite(authDate) ||
    Date.now() / 1000 - authDate > MAX_AUTH_AGE_SECONDS
  ) {
    throw new ApiError(401, "initData has expired");
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
    throw new ApiError(404, "User not found");
  }

  return user;
}

export async function getAuthenticatedUserByToken(request: NextRequest) {
  const authHeader = request.headers.get("authorization") ?? "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match || !match[1]) {
    throw new ApiError(401, "Missing or invalid Authorization header");
  }
  const token = match[1];

  const user = await prisma.user.findUnique({
    where: { access_token: token },
  });

  if (!user) {
    throw new ApiError(401, "Invalid access token");
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

/** The user's own key, else this deployment's shared key, else null. Throws if the stored key can't be decrypted. */
export function findUserAICredentials(user: {
  ai_provider: string | null;
  ai_api_key: string | null;
  ai_model: string | null;
}): AICredentials | null {
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

  return null;
}

export function getUserAICredentials(
  user: Parameters<typeof findUserAICredentials>[0],
): AICredentials {
  const credentials = findUserAICredentials(user);
  if (!credentials) throw new ApiError(400, "No API key configured. Set one up in Settings.");
  return credentials;
}
