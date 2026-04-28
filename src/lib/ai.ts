import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";

export type AIProvider = "openai" | "anthropic" | "gemini";

const VISION_PROMPT = `You are a precise nutrition analyst. Analyze this meal photograph and estimate its nutritional content.

Additional context from user: {description}

Respond with ONLY a raw JSON object — no markdown, no code fences, no explanation. Exactly this structure:

{
  "food_name": "descriptive name for this meal",
  "calories": <integer>,
  "protein": <number in grams, one decimal>,
  "carbohydrates": <number in grams, one decimal>,
  "fats": <number in grams, one decimal>,
  "fiber": <number in grams, one decimal>,
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
  "fiber": <number in grams, one decimal>,
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
    "fats": <number, one decimal>,
    "fiber": <number, one decimal>
  }
]`;

export interface MealSuggestion {
  name: string;
  description: string;
  calories: number;
  protein: number;
  carbohydrates: number;
  fats: number;
  fiber: number;
}

export interface MealAnalysisResult {
  food_name: string;
  calories: number;
  protein: number;
  carbohydrates: number;
  fats: number;
  fiber: number;
  confidence: string;
  notes: string;
}

function cleanJson(raw: string): string {
  return raw
    .trim()
    .replace(/^```(?:json)?\s*/, "")
    .replace(/\s*```$/, "");
}

function parseAnalysisResponse(raw: string): MealAnalysisResult {
  const cleaned = cleanJson(raw);
  if (!cleaned) throw new Error("AI returned an empty response");

  const data = JSON.parse(cleaned);
  const required = [
    "food_name",
    "calories",
    "protein",
    "carbohydrates",
    "fats",
  ];
  const missing = required.filter((k) => !(k in data));
  if (missing.length > 0) {
    throw new Error(`AI response missing fields: ${missing.join(", ")}`);
  }

  return {
    food_name: String(data.food_name),
    calories: Math.round(Number(data.calories)),
    protein: Math.round(Number(data.protein) * 10) / 10,
    carbohydrates: Math.round(Number(data.carbohydrates) * 10) / 10,
    fats: Math.round(Number(data.fats) * 10) / 10,
    fiber: Math.round(Number(data.fiber ?? 0) * 10) / 10,
    confidence: String(data.confidence ?? "medium"),
    notes: String(data.notes ?? ""),
  };
}

function parseSuggestionsResponse(raw: string): MealSuggestion[] {
  const cleaned = cleanJson(raw);
  if (!cleaned) throw new Error("AI returned an empty response");

  const suggestions: MealSuggestion[] = JSON.parse(cleaned);
  return suggestions.map((s) => ({
    name: String(s.name),
    description: String(s.description),
    calories: Math.round(Number(s.calories)),
    protein: Math.round(Number(s.protein) * 10) / 10,
    carbohydrates: Math.round(Number(s.carbohydrates) * 10) / 10,
    fats: Math.round(Number(s.fats) * 10) / 10,
    fiber: Math.round(Number(s.fiber ?? 0) * 10) / 10,
  }));
}

// --- OpenAI ---

async function openaiVision(
  apiKey: string,
  imageBytes: Buffer,
  mimeType: string,
  prompt: string,
): Promise<string> {
  const client = new OpenAI({ apiKey });
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
  return response.choices[0]?.message?.content ?? "";
}

async function openaiText(
  apiKey: string,
  prompt: string,
): Promise<string> {
  const client = new OpenAI({ apiKey });
  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
  });
  return response.choices[0]?.message?.content ?? "";
}

// --- Anthropic ---

async function anthropicVision(
  apiKey: string,
  imageBytes: Buffer,
  mimeType: string,
  prompt: string,
): Promise<string> {
  const client = new Anthropic({ apiKey });
  const base64Image = imageBytes.toString("base64");
  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mimeType as
                | "image/jpeg"
                | "image/png"
                | "image/gif"
                | "image/webp",
              data: base64Image,
            },
          },
          { type: "text", text: prompt },
        ],
      },
    ],
  });
  const block = response.content[0];
  return block.type === "text" ? block.text : "";
}

async function anthropicText(
  apiKey: string,
  prompt: string,
): Promise<string> {
  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });
  const block = response.content[0];
  return block.type === "text" ? block.text : "";
}

// --- Gemini ---

async function geminiVision(
  apiKey: string,
  imageBytes: Buffer,
  mimeType: string,
  prompt: string,
): Promise<string> {
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [
      {
        role: "user",
        parts: [
          {
            inlineData: {
              mimeType,
              data: imageBytes.toString("base64"),
            },
          },
          { text: prompt },
        ],
      },
    ],
  });
  return response.text ?? "";
}

async function geminiText(
  apiKey: string,
  prompt: string,
): Promise<string> {
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
  });
  return response.text ?? "";
}

// --- Routing ---

async function callVision(
  provider: AIProvider,
  apiKey: string,
  imageBytes: Buffer,
  mimeType: string,
  prompt: string,
): Promise<string> {
  switch (provider) {
    case "openai":
      return openaiVision(apiKey, imageBytes, mimeType, prompt);
    case "anthropic":
      return anthropicVision(apiKey, imageBytes, mimeType, prompt);
    case "gemini":
      return geminiVision(apiKey, imageBytes, mimeType, prompt);
  }
}

async function callText(
  provider: AIProvider,
  apiKey: string,
  prompt: string,
): Promise<string> {
  switch (provider) {
    case "openai":
      return openaiText(apiKey, prompt);
    case "anthropic":
      return anthropicText(apiKey, prompt);
    case "gemini":
      return geminiText(apiKey, prompt);
  }
}

// --- Public API ---

export async function analyseMeal(
  provider: AIProvider,
  apiKey: string,
  imageBytes: Buffer,
  mimeType: string,
  description: string = "",
): Promise<MealAnalysisResult> {
  const prompt = VISION_PROMPT.replace(
    "{description}",
    description || "No additional context provided.",
  );
  const raw = await callVision(provider, apiKey, imageBytes, mimeType, prompt);
  return parseAnalysisResult(raw);
}

export async function parseFood(
  provider: AIProvider,
  apiKey: string,
  text: string,
): Promise<MealAnalysisResult> {
  const prompt = TEXT_PROMPT.replace("{text}", text);
  const raw = await callText(provider, apiKey, prompt);
  return parseAnalysisResult(raw);
}

export async function suggestMeals(
  provider: AIProvider,
  apiKey: string,
  remainingCalories: number,
  remainingProtein: number,
  mealsLogged: string[],
): Promise<MealSuggestion[]> {
  const prompt = SUGGEST_PROMPT.replace(
    "{calories}",
    String(Math.round(remainingCalories)),
  )
    .replace("{protein}", String(Math.round(remainingProtein)))
    .replace(
      "{meals}",
      mealsLogged.length > 0 ? mealsLogged.join(", ") : "nothing yet",
    );
  const raw = await callText(provider, apiKey, prompt);
  return parseSuggestionsResponse(raw);
}

function parseAnalysisResult(raw: string): MealAnalysisResult {
  return parseAnalysisResponse(raw);
}
