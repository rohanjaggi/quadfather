import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser, getUserAICredentials } from "@/lib/auth";
import { analyseMeal } from "@/lib/ai";

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    const { provider, apiKey, model } = getUserAICredentials(user);

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
    const result = await analyseMeal(
      provider,
      apiKey,
      model,
      imageBytes,
      image.type,
      description,
    );
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Internal error";
    if (message === "User not found") {
      return NextResponse.json({ detail: message }, { status: 404 });
    }
    if (message.includes("initData") || message.includes("hash")) {
      return NextResponse.json({ detail: message }, { status: 401 });
    }
    if (message.includes("No API key")) {
      return NextResponse.json({ detail: message }, { status: 403 });
    }
    return NextResponse.json({ detail: message }, { status: 422 });
  }
}
