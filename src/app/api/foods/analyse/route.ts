import { NextRequest, NextResponse } from "next/server";
import { verifyTelegramAuth } from "@/lib/auth";
import { analyseMeal } from "@/lib/openai";

export async function POST(request: NextRequest) {
  try {
    const initData = request.headers.get("x-telegram-init-data") ?? "";
    verifyTelegramAuth(initData);

    const formData = await request.formData();
    const image = formData.get("image") as File | null;
    const description = (formData.get("description") as string) ?? "";

    if (!image || !image.type.startsWith("image/")) {
      return NextResponse.json(
        { detail: "File must be an image" },
        { status: 422 },
      );
    }

    const imageBytes = Buffer.from(await image.arrayBuffer());
    const result = await analyseMeal(imageBytes, image.type, description);
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
