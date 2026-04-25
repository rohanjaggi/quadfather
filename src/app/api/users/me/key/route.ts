import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/crypto";
import type { AIProvider } from "@/lib/ai";

const VALID_PROVIDERS: AIProvider[] = ["openai", "anthropic", "gemini"];

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    const { provider, api_key } = await request.json();

    if (!VALID_PROVIDERS.includes(provider)) {
      return NextResponse.json(
        { detail: `Invalid provider. Must be one of: ${VALID_PROVIDERS.join(", ")}` },
        { status: 422 },
      );
    }
    if (!api_key || typeof api_key !== "string" || api_key.length < 10) {
      return NextResponse.json(
        { detail: "Invalid API key" },
        { status: 422 },
      );
    }

    const encrypted = encrypt(api_key);
    await prisma.user.update({
      where: { id: user.id },
      data: { ai_provider: provider, ai_api_key: encrypted },
    });

    return NextResponse.json({ provider, has_api_key: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Internal error";
    if (message === "User not found") {
      return NextResponse.json({ detail: message }, { status: 404 });
    }
    if (message.includes("initData") || message.includes("hash")) {
      return NextResponse.json({ detail: message }, { status: 401 });
    }
    return NextResponse.json({ detail: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);

    await prisma.user.update({
      where: { id: user.id },
      data: { ai_provider: null, ai_api_key: null },
    });

    return NextResponse.json({ has_api_key: false });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Internal error";
    if (message === "User not found") {
      return NextResponse.json({ detail: message }, { status: 404 });
    }
    if (message.includes("initData") || message.includes("hash")) {
      return NextResponse.json({ detail: message }, { status: 401 });
    }
    return NextResponse.json({ detail: message }, { status: 500 });
  }
}
