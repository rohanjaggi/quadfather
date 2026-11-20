import { NextResponse } from "next/server";
import { getUserAICredentials } from "@/lib/auth";
import { analyseMeal } from "@/lib/ai";
import { callAIProvider, readImageUpload, withUser } from "@/lib/api-handler";

export const POST = withUser(async (request, user) => {
  const ai = getUserAICredentials(user);

  const { image, form } = await readImageUpload(request);
  const description = (form.get("description") as string | null) ?? "";

  const result = await callAIProvider("foods/analyse", () =>
    analyseMeal(ai, image, description),
  );
  return NextResponse.json(result);
});
