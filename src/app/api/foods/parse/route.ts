import { NextRequest, NextResponse } from "next/server";
import { verifyTelegramAuth } from "@/lib/auth";
import { parseFood } from "@/lib/openai";

export async function POST(request: NextRequest) {
  try {
    const initData = request.headers.get("x-telegram-init-data") ?? "";
    verifyTelegramAuth(initData);

    const { text } = await request.json();
    if (!text || typeof text !== "string") {
      return NextResponse.json(
        { detail: "text is required" },
        { status: 422 },
      );
    }

    const result = await parseFood(text);
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Internal error";
    if (message.includes("initData") || message.includes("hash")) {
      return NextResponse.json({ detail: message }, { status: 401 });
    }
    if (message.includes("OPENAI") || message.includes("OpenAI")) {
      return NextResponse.json({ detail: message }, { status: 503 });
    }
    return NextResponse.json({ detail: message }, { status: 422 });
  }
}
