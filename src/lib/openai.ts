import OpenAI from "openai";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? "";

const VISION_PROMPT = `You are a precise nutrition analyst. Analyze this meal photograph and estimate its nutritional content.

Additional context from user: {description}

Respond with ONLY a raw JSON object — no markdown, no code fences, no explanation. Exactly this structure:

{
  "food_name": "descriptive name for this meal",
  "calories": <integer>,
  "protein": <number in grams, one decimal>,
  "carbohydrates": <number in grams, one decimal>,
  "fats": <number in grams, one decimal>,
  "confidence": "high" | "medium" | "low",
  "notes": "brief note on portion assumptions"
}

Base macros on a typical single serving unless the image or description clearly shows otherwise. Be realistic — do not underestimate.`;

const TEXT_PROMPT = `You are a precise nutrition analyst. Estimate the nutritional content of the following food description.

Food description: {text}

Respond with ONLY a raw JSON object — no markdown, no code fences, no explanation. Exactly this structure:

{
  "food_name": "descriptive name for this food",
  "calories": <integer>,
  "protein": <number in grams, one decimal>,
  "carbohydrates": <number in grams, one decimal>,
  "fats": <number in grams, one decimal>,
  "confidence": "high" | "medium" | "low",
  "notes": "brief note on portion assumptions"
}

Base macros on a typical single serving unless the description clearly states otherwise. Be realistic — do not underestimate.`;

const SUGGEST_PROMPT = `You are a nutrition advisor. The user has the following remaining daily budget:
- Calories remaining: {calories} kcal
- Protein remaining: {protein}g

They have already eaten today: {meals}

Suggest exactly 3 meals that fit within their remaining budget. Each meal should be a realistic, common meal — not exotic or unusual. Prioritise hitting the protein target.

Respond with ONLY a raw JSON array — no markdown, no code fences, no explanation:

[
  {
    "name": "meal name",
    "description": "one sentence description",
    "calories": <integer>,
    "protein": <number, one decimal>,
    "carbohydrates": <number, one decimal>,
    "fats": <number, one decimal>
  }
]`;

export interface MealSuggestion {
  name: string;
  description: string;
  calories: number;
  protein: number;
  carbohydrates: number;
  fats: number;
}

export interface MealAnalysisResult {
  food_name: string;
  calories: number;
  protein: number;
  carbohydrates: number;
  fats: number;
  confidence: string;
  notes: string;
}

export async function analyseMeal(
  imageBytes: Buffer,
  mimeType: string,
  description: string = "",
): Promise<MealAnalysisResult> {
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  const client = new OpenAI({ apiKey: OPENAI_API_KEY });
  const prompt = VISION_PROMPT.replace(
    "{description}",
    description || "No additional context provided.",
  );

  const base64Image = imageBytes.toString("base64");

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: { url: `data:${mimeType};base64,${base64Image}` },
          },
          { type: "text", text: prompt },
        ],
      },
    ],
  });

  const raw = (response.choices[0]?.message?.content ?? "")
    .trim()
    .replace(/^```(?:json)?\s*/, "")
    .replace(/\s*```$/, "");

  if (!raw) {
    throw new Error("OpenAI returned an empty response");
  }

  const data = JSON.parse(raw);
  const required = ["food_name", "calories", "protein", "carbohydrates", "fats"];
  const missing = required.filter((k) => !(k in data));
  if (missing.length > 0) {
    throw new Error(`OpenAI response missing fields: ${missing.join(", ")}`);
  }

  return {
    food_name: String(data.food_name),
    calories: Math.round(Number(data.calories)),
    protein: Math.round(Number(data.protein) * 10) / 10,
    carbohydrates: Math.round(Number(data.carbohydrates) * 10) / 10,
    fats: Math.round(Number(data.fats) * 10) / 10,
    confidence: String(data.confidence ?? "medium"),
    notes: String(data.notes ?? ""),
  };
}

function parseAnalysisResponse(raw: string): MealAnalysisResult {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/, "")
    .replace(/\s*```$/, "");

  if (!cleaned) {
    throw new Error("OpenAI returned an empty response");
  }

  const data = JSON.parse(cleaned);
  const required = ["food_name", "calories", "protein", "carbohydrates", "fats"];
  const missing = required.filter((k) => !(k in data));
  if (missing.length > 0) {
    throw new Error(`OpenAI response missing fields: ${missing.join(", ")}`);
  }

  return {
    food_name: String(data.food_name),
    calories: Math.round(Number(data.calories)),
    protein: Math.round(Number(data.protein) * 10) / 10,
    carbohydrates: Math.round(Number(data.carbohydrates) * 10) / 10,
    fats: Math.round(Number(data.fats) * 10) / 10,
    confidence: String(data.confidence ?? "medium"),
    notes: String(data.notes ?? ""),
  };
}

export async function parseFood(text: string): Promise<MealAnalysisResult> {
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  const client = new OpenAI({ apiKey: OPENAI_API_KEY });
  const prompt = TEXT_PROMPT.replace("{text}", text);

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
  });

  return parseAnalysisResponse(response.choices[0]?.message?.content ?? "");
}

export async function suggestMeals(
  remainingCalories: number,
  remainingProtein: number,
  mealsLogged: string[],
): Promise<MealSuggestion[]> {
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  const client = new OpenAI({ apiKey: OPENAI_API_KEY });
  const prompt = SUGGEST_PROMPT.replace("{calories}", String(Math.round(remainingCalories)))
    .replace("{protein}", String(Math.round(remainingProtein)))
    .replace("{meals}", mealsLogged.length > 0 ? mealsLogged.join(", ") : "nothing yet");

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
  });

  const raw = (response.choices[0]?.message?.content ?? "")
    .trim()
    .replace(/^```(?:json)?\s*/, "")
    .replace(/\s*```$/, "");

  if (!raw) {
    throw new Error("OpenAI returned an empty response");
  }

  const suggestions: MealSuggestion[] = JSON.parse(raw);
  return suggestions.map((s) => ({
    name: String(s.name),
    description: String(s.description),
    calories: Math.round(Number(s.calories)),
    protein: Math.round(Number(s.protein) * 10) / 10,
    carbohydrates: Math.round(Number(s.carbohydrates) * 10) / 10,
    fats: Math.round(Number(s.fats) * 10) / 10,
  }));
}
