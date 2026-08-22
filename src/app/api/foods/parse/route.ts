import { NextResponse } from "next/server";
import { getUserAICredentials } from "@/lib/auth";
import { parseFood } from "@/lib/ai";
import {
  callAIProvider,
  parseJsonBody,
  requireString,
  withUser,
} from "@/lib/api-handler";

/** Bounds the prompt (and so the bill) — a meal description isn't an essay. */
const MAX_TEXT = 2000;

export const POST = withUser(async (request, user) => {
  const { provider, apiKey, model } = getUserAICredentials(user);

  const body = await parseJsonBody(request);
  const text = requireString(body.text, "text", { maxLength: MAX_TEXT });

  const result = await callAIProvider("foods/parse", () =>
    parseFood(provider, apiKey, model, text),
  );
  return NextResponse.json(result);
});
