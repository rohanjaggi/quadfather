import crypto from "node:crypto";
import { NextRequest } from "next/server";
import { prisma } from "./prisma";
import { decrypt } from "./crypto";
import type { AIProvider } from "./models";

const BOT_TOKEN = process.env.BOTFATHER_TOKEN ?? "";
const SKIP_TELEGRAM_AUTH =
  (process.env.SKIP_TELEGRAM_AUTH ?? "false").toLowerCase() === "true";
const DEV_USER_ID = parseInt(process.env.DEV_USER_ID ?? "12345678", 10);

interface TelegramUser {
  id: number;
  username?: string;
  first_name?: string;
}

export function verifyTelegramAuth(initData: string): TelegramUser {
  if (SKIP_TELEGRAM_AUTH) {
    return { id: DEV_USER_ID, username: "devuser", first_name: "Dev" };
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

  if (
    !crypto.timingSafeEqual(
      Buffer.from(expectedHash),
      Buffer.from(hash),
    )
  ) {
    throw new Error("Invalid initData signature");
  }

  return JSON.parse(params.get("user") ?? "{}");
}

export function verifyBotAuth(request: NextRequest): number {
  const botToken = request.headers.get("x-bot-token") ?? "";
  const telegramId = request.nextUrl.searchParams.get("telegram_id");

  if (!BOT_TOKEN || botToken !== BOT_TOKEN) {
    throw new Error("Invalid bot token");
  }
  if (!telegramId) {
    throw new Error("Missing telegram_id");
  }
  return parseInt(telegramId, 10);
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
