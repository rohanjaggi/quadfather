import { NextResponse } from "next/server";
import { getUserAICredentials } from "@/lib/auth";
import { analyseMeal } from "@/lib/ai";
import { ApiError, badRequest, callAIProvider, unprocessable, withUser } from "@/lib/api-handler";

/**
 * Formats every provider actually accepts. Anthropic/OpenAI reject HEIC, BMP,
 * TIFF and friends with a generic 422 of their own, so catch them here where
 * we can say what went wrong.
 */
const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "image/gif"];
/** Vercel's body limit is 4.5 MB on the hobby tier; cap well before the SDKs do. */
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export const POST = withUser(async (request, user) => {
  const { provider, apiKey, model } = getUserAICredentials(user);

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    throw badRequest("Malformed multipart form data");
  }

  const image = formData.get("image");
  const description = (formData.get("description") as string | null) ?? "";

  if (!image || typeof image === "string") {
    throw unprocessable("An image file is required");
  }
  if (!ALLOWED_MIME.includes(image.type)) {
    throw unprocessable("Image must be a JPEG, PNG, WebP or GIF");
  }
  if (image.size > MAX_IMAGE_BYTES) {
    throw new ApiError(413, "Image must be smaller than 8 MB");
  }

  const imageBytes = Buffer.from(await image.arrayBuffer());
  const result = await callAIProvider("foods/analyse", () =>
    analyseMeal(provider, apiKey, model, imageBytes, image.type, description),
  );
  return NextResponse.json(result);
});
