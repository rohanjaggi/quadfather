import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/crypto";
import type { AIProvider } from "@/lib/models";
import {
  optionalString,
  parseJsonBody,
  unprocessable,
  withUser,
} from "@/lib/api-handler";

const VALID_PROVIDERS: readonly AIProvider[] = ["openai", "anthropic", "gemini", "openrouter"];
/** `User.ai_model` is `VarChar(80)`; longer ids used to 500 on write. */
const MAX_MODEL_LENGTH = 80;

export const POST = withUser(async (request, user) => {
  const body = await parseJsonBody(request);
  const { provider, api_key } = body;

  if (typeof provider !== "string" || !(VALID_PROVIDERS as readonly string[]).includes(provider)) {
    throw unprocessable(`Invalid provider. Must be one of: ${VALID_PROVIDERS.join(", ")}`);
  }
  if (!api_key || typeof api_key !== "string" || api_key.length < 10) {
    throw unprocessable("Invalid API key");
  }

  // Trim first so trailing whitespace doesn't count against the column width.
  const rawModel = optionalString(body.model, "model");
  const trimmed = rawModel?.trim();
  if (trimmed && trimmed.length > MAX_MODEL_LENGTH) {
    throw unprocessable(`model must be at most ${MAX_MODEL_LENGTH} characters`);
  }
  const model = trimmed ? trimmed : null;

  await prisma.user.update({
    where: { id: user.id },
    data: {
      ai_provider: provider,
      ai_api_key: encrypt(api_key),
      ai_model: model,
    },
  });

  return NextResponse.json({ provider, model, has_api_key: true });
});

export const DELETE = withUser(async (request, user) => {
  await prisma.user.update({
    where: { id: user.id },
    data: { ai_provider: null, ai_api_key: null, ai_model: null },
  });

  return NextResponse.json({ has_api_key: false });
});
