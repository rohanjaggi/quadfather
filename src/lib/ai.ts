import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";

export type AIProvider = "openai" | "anthropic" | "gemini" | "openrouter";

const VISION_PROMPT = `You are a registered dietitian with 20 years of clinical experience in portion estimation. Analyze this meal photograph step by step.

Additional context from user: {description}

Follow this reasoning process internally before producing your answer:

1. IDENTIFY: List every distinct food item visible. Note cooking methods (fried, grilled, steamed) and any visible sauces, oils, or toppings.

2. ESTIMATE PORTIONS: For each item, estimate grams using these visual anchors:
   - Closed fist ≈ 1 cup ≈ 200ml cooked rice/pasta
   - Palm (no fingers) ≈ 85g cooked meat/fish
   - Thumb tip ≈ 1 tsp ≈ 5g butter/oil
   - Cupped hand ≈ 40g nuts/snacks
   - Standard dinner plate = 26cm diameter
   - Standard bowl = ~300ml
   Use any visible plates, utensils, hands, or packaging as scale reference.

3. HIDDEN CALORIES: Account for cooking oils (1-2 tbsp per fried/stir-fried item = 120-240 kcal), sauces, dressings, coconut milk, and sugar in beverages. These are often invisible but calorically significant.

4. CALCULATE: Sum macros for all items. Verify that calories ≈ (protein × 4) + (carbs × 4) + (fats × 9). If the math is off by more than 10%, revise.

5. SANITY CHECK: Confirm your total is in a reasonable range:
   - Snack/side: 100-300 kcal
   - Light meal: 300-500 kcal
   - Standard meal: 500-800 kcal
   - Large/restaurant meal: 800-1200 kcal
   - Hawker/fast food combo: 600-1000 kcal

Respond with ONLY a raw JSON object — no markdown, no code fences, no explanation:

{
  "food_name": "descriptive name for this meal",
  "calories": <integer>,
  "protein": <number in grams, one decimal>,
  "carbohydrates": <number in grams, one decimal>,
  "fats": <number in grams, one decimal>,
  "fiber": <number in grams, one decimal>,
  "confidence": "high" | "medium" | "low",
  "notes": "brief note on portion assumptions and any hidden calories accounted for"
}

Confidence guide:
- "high": items clearly identifiable, portions unambiguous, standard dish
- "medium": some items obscured or portion estimated from context
- "low": image unclear, heavily mixed dish, or unusual preparation

Be realistic. When uncertain about portion size, estimate toward the higher end rather than underestimating.`;

const TEXT_PROMPT = `You are a registered dietitian estimating nutritional content from a food description. Think through this systematically.

Food description: {text}

Follow this reasoning process internally:

1. DECOMPOSE: Identify each distinct food component in this description (e.g., "chicken rice" → rice + poached chicken + chilli sauce + cucumber).

2. PORTION: Estimate grams for each component. When the description is ambiguous, use these defaults:
   - "a bowl" = 300ml medium bowl (~250g food)
   - "a plate" / "a serving" = one standard hawker/restaurant portion
   - "a cup" = 240ml
   - "a piece" / "a slice" = one standard unit
   - No quantity mentioned = one typical single serving
   - "some" / "a bit" = approximately 50-75g

3. CALCULATE: Estimate macros for each component, then sum totals. Verify calories ≈ (protein × 4) + (carbs × 4) + (fats × 9).

4. ACCOUNT FOR PREPARATION: Factor in cooking method — fried adds 1-2 tbsp oil (~120-240 kcal), gravies/curries add coconut milk or oil, sauces add sugar and fat.

Respond with ONLY a raw JSON object — no markdown, no code fences, no explanation:

{
  "food_name": "descriptive name for this food",
  "calories": <integer>,
  "protein": <number in grams, one decimal>,
  "carbohydrates": <number in grams, one decimal>,
  "fats": <number in grams, one decimal>,
  "fiber": <number in grams, one decimal>,
  "confidence": "high" | "medium" | "low",
  "notes": "portion assumptions and components identified"
}

Confidence guide:
- "high": specific quantities given, well-known standardised food, branded item with known nutrition
- "medium": common food but portion assumed, typical preparation assumed
- "low": very generic description, many possible preparations, composite dish with high variability

Be realistic. When uncertain, estimate toward the higher end rather than underestimating.`;

const SUGGEST_PROMPT = `You are a Singapore-based sports nutritionist who knows local hawker food, kopitiam fare, supermarket options, and home cooking. You combine nutrition science with practical meal accessibility.

Remaining daily budget:
- Calories: {calories} kcal
- Protein: {protein}g

Current time: {time_of_day}
Already eaten today: {meals}
{restrictions_block}
{saved_foods_block}
{exercise_block}

Timing guidance:
- Morning: prioritise protein (25-35g) to break overnight fast, include complex carbs for energy
- Post-exercise: higher carb:protein ratio (3:1), moderate-GI carbs for glycogen replenishment
- Midday: balanced macro meal, largest meal of the day is appropriate
- Afternoon snack: protein-focused (15-25g), moderate calories, high satiety
- Evening dinner: good protein serving (30-40g), moderate carbs
- Late night: light, protein-rich, low-fat (Greek yogurt, eggs, cottage cheese)

Suggest exactly 3 meals following these rules:
- Each MUST fit within the remaining budget (total of all 3 should not exceed budget)
- Each must use a DIFFERENT primary protein source (e.g., chicken, fish, tofu, eggs, beef, legumes)
- Each should represent a different cuisine style or preparation method
- At least one should be quick/convenient (under 10 min or readily available at hawker/convenience store)
- Include specific portion sizes (e.g., "200g grilled chicken breast" not just "chicken")
- Prioritise hitting the protein target
- Consider satiety: prefer high-fiber, high-protein, volume-rich foods when budget is tight
- Do NOT repeat anything similar to what they already ate today

Singapore food reference ranges (use for accuracy):
- Chicken rice (1 plate): 600-700 kcal, 35-40g P
- Nasi lemak (packet): 500-600 kcal, 15-20g P
- Ban mian soup: 400-500 kcal, 20-25g P
- Yong tau foo (6 items + soup): 350-450 kcal, 20-30g P
- Economy rice (1 meat 2 veg): 500-700 kcal, 25-35g P
- Protein shake (1 scoop + milk): 200-250 kcal, 30-35g P
- Greek yogurt bowl (200g + granola): 250-350 kcal, 20-25g P

Respond with ONLY a raw JSON array — no markdown, no code fences, no explanation:

[
  {
    "name": "specific meal name with portion",
    "description": "one sentence on what it includes and where to get it",
    "reason": "why this fits the remaining budget and goals",
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
  reason?: string;
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
    reason: s.reason ? String(s.reason) : undefined,
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
    model: "gpt-5.4-mini",
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
    model: "gpt-5.4-mini",
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
    model: "claude-haiku-4-5-20251001",
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
    model: "claude-haiku-4-5-20251001",
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
    model: "gemini-3.1-flash-lite-preview",
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
    model: "gemini-3.1-flash-lite-preview",
    contents: prompt,
  });
  return response.text ?? "";
}

// --- OpenRouter ---

async function openrouterVision(
  apiKey: string,
  imageBytes: Buffer,
  mimeType: string,
  prompt: string,
): Promise<string> {
  const client = new OpenAI({ apiKey, baseURL: "https://openrouter.ai/api/v1" });
  const base64Image = imageBytes.toString("base64");
  const response = await client.chat.completions.create({
    model: "google/gemini-3.1-flash-lite-preview",
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

async function openrouterText(
  apiKey: string,
  prompt: string,
): Promise<string> {
  const client = new OpenAI({ apiKey, baseURL: "https://openrouter.ai/api/v1" });
  const response = await client.chat.completions.create({
    model: "google/gemini-3.1-flash-lite-preview",
    messages: [{ role: "user", content: prompt }],
  });
  return response.choices[0]?.message?.content ?? "";
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
    case "openrouter":
      return openrouterVision(apiKey, imageBytes, mimeType, prompt);
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
    case "openrouter":
      return openrouterText(apiKey, prompt);
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
  dietaryRestrictions: string[] = [],
  savedFoodNames: string[] = [],
  exerciseToday: number = 0,
): Promise<MealSuggestion[]> {
  const restrictionsBlock = dietaryRestrictions.length > 0
    ? `\nDietary restrictions (MUST respect — do not suggest meals that violate these): ${dietaryRestrictions.join(', ')}`
    : '';

  const savedFoodsBlock = savedFoodNames.length > 0
    ? `\nThe user's favourite/saved meals (prefer these when they fit the budget): ${savedFoodNames.slice(0, 10).join(', ')}`
    : '';

  const exerciseBlock = exerciseToday > 0
    ? `\nThe user exercised today and burned ~${Math.round(exerciseToday)} extra kcal.`
    : '';

  const hour = new Date().getUTCHours() + 8;
  const timeOfDay = hour < 11 ? 'morning (breakfast/brunch time)'
    : hour < 14 ? 'midday (lunch time)'
    : hour < 17 ? 'afternoon (snack time)'
    : hour < 21 ? 'evening (dinner time)'
    : 'late night (light snack time)';

  const prompt = SUGGEST_PROMPT
    .replace("{calories}", String(Math.round(remainingCalories)))
    .replace("{protein}", String(Math.round(remainingProtein)))
    .replace("{meals}", mealsLogged.length > 0 ? mealsLogged.join(", ") : "nothing yet")
    .replace("{time_of_day}", timeOfDay)
    .replace("{restrictions_block}", restrictionsBlock)
    .replace("{saved_foods_block}", savedFoodsBlock)
    .replace("{exercise_block}", exerciseBlock);

  const raw = await callText(provider, apiKey, prompt);
  return parseSuggestionsResponse(raw);
}

function parseAnalysisResult(raw: string): MealAnalysisResult {
  return parseAnalysisResponse(raw);
}

const DAILY_COACH_PROMPT = `You are a friendly nutrition coach reviewing a user's day. Here's their data:

Daily goals: {goals}
What they ate today: {meals}
Macros consumed: {macros_consumed}
Water: {water_consumed}L / {water_goal}L
Exercise: {exercise}
{restrictions_block}

Give a short, encouraging coaching message (2-3 sentences max). Be specific about what they did well and give ONE actionable tip for tomorrow. Keep it warm but direct — no bullet points, no headers, just natural conversational text.`;

export async function generateDailyCoach(
  provider: AIProvider,
  apiKey: string,
  context: {
    goals: { calories: number; protein: number };
    consumed: { calories: number; protein: number; carbs: number; fats: number };
    meals: string[];
    waterConsumed: number;
    waterGoal: number;
    exerciseCalories: number;
    dietaryRestrictions: string[];
  },
): Promise<string> {
  const restrictionsBlock = context.dietaryRestrictions.length > 0
    ? `Dietary restrictions: ${context.dietaryRestrictions.join(', ')}`
    : '';

  const prompt = DAILY_COACH_PROMPT
    .replace("{goals}", `${context.goals.calories} kcal, ${context.goals.protein}g protein`)
    .replace("{meals}", context.meals.length > 0 ? context.meals.join(', ') : 'nothing logged')
    .replace("{macros_consumed}", `${context.consumed.calories} kcal, ${context.consumed.protein}g P, ${context.consumed.carbs}g C, ${context.consumed.fats}g F`)
    .replace("{water_consumed}", String(context.waterConsumed.toFixed(1)))
    .replace("{water_goal}", String(context.waterGoal))
    .replace("{exercise}", context.exerciseCalories > 0 ? `Burned ~${Math.round(context.exerciseCalories)} kcal` : 'No exercise logged')
    .replace("{restrictions_block}", restrictionsBlock);

  const raw = await callText(provider, apiKey, prompt);
  return raw.trim();
}

const WEEKLY_INSIGHTS_PROMPT = `You are a nutrition analyst reviewing a user's past 7 days. Here's their data:

Goals: {goals}

Day-by-day:
{daily_breakdown}

Weekly averages: {averages}
Exercise: {exercise_total} kcal across {exercise_sessions} sessions
{restrictions_block}

Give exactly 3 short insights about patterns (1 sentence each). Be specific with numbers. Focus on: consistency, weak spots, and positive trends. Format as plain text with each insight on a new line starting with a bullet "•".`;

export async function generateWeeklyInsights(
  provider: AIProvider,
  apiKey: string,
  context: {
    goals: { calories: number; protein: number; water: number };
    days: { date: string; calories: number; protein: number; water: number }[];
    exerciseTotal: number;
    exerciseSessions: number;
    dietaryRestrictions: string[];
  },
): Promise<string> {
  const restrictionsBlock = context.dietaryRestrictions.length > 0
    ? `Dietary restrictions: ${context.dietaryRestrictions.join(', ')}`
    : '';

  const dailyBreakdown = context.days.map(d =>
    `${d.date}: ${d.calories} kcal, ${d.protein}g P, ${d.water.toFixed(1)}L water`
  ).join('\n');

  const avgCal = Math.round(context.days.reduce((s, d) => s + d.calories, 0) / Math.max(context.days.length, 1));
  const avgPro = Math.round(context.days.reduce((s, d) => s + d.protein, 0) / Math.max(context.days.length, 1));

  const prompt = WEEKLY_INSIGHTS_PROMPT
    .replace("{goals}", `${context.goals.calories} kcal, ${context.goals.protein}g protein, ${context.goals.water}L water`)
    .replace("{daily_breakdown}", dailyBreakdown)
    .replace("{averages}", `${avgCal} kcal/day, ${avgPro}g protein/day`)
    .replace("{exercise_total}", String(Math.round(context.exerciseTotal)))
    .replace("{exercise_sessions}", String(context.exerciseSessions))
    .replace("{restrictions_block}", restrictionsBlock);

  const raw = await callText(provider, apiKey, prompt);
  return raw.trim();
}

export async function analyseRunScreenshot(
  provider: AIProvider,
  apiKey: string,
  imageBase64: string,
  mimeType: string,
): Promise<{
  distance_meters: number
  duration_seconds: number
  calories_burned: number
  pace_per_km?: number
  average_heartrate?: number
  confidence: 'high' | 'medium' | 'low'
  notes: string
}> {
  const prompt = `Analyze this running/exercise screenshot and extract the following data.
Return ONLY valid JSON with these fields:
- distance_meters: total distance in meters (convert from km/miles if needed)
- duration_seconds: total duration in seconds (convert from mm:ss or hh:mm:ss)
- calories_burned: calories/kcal burned (estimate ~70 kcal/km if not shown)
- pace_per_km: pace in minutes per kilometer (decimal, e.g. 5.5 for 5:30/km). null if not visible
- average_heartrate: average heart rate in BPM. null if not visible
- confidence: "high" if all key metrics clearly visible, "medium" if some estimated, "low" if image unclear
- notes: brief description of what you see (app name, any issues)

If the image is not a running/exercise screenshot, return confidence "low" with notes explaining why.
Convert all units to metric (meters, seconds, min/km).`

  const imageBytes = Buffer.from(imageBase64, 'base64')

  let raw: string
  switch (provider) {
    case 'openai':
      raw = await openaiVision(apiKey, imageBytes, mimeType, prompt)
      break
    case 'anthropic':
      raw = await anthropicVision(apiKey, imageBytes, mimeType, prompt)
      break
    case 'gemini':
      raw = await geminiVision(apiKey, imageBytes, mimeType, prompt)
      break
    case 'openrouter':
      raw = await openrouterVision(apiKey, imageBytes, mimeType, prompt)
      break
  }

  const cleaned = cleanJson(raw)
  if (!cleaned) throw new Error('AI returned an empty response')
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('Failed to parse AI response')
  const data = JSON.parse(jsonMatch[0])

  const required = ['distance_meters', 'duration_seconds', 'calories_burned'] as const
  for (const key of required) {
    if (typeof data[key] !== 'number') {
      throw new Error(`AI response missing or invalid field: ${key}`)
    }
  }

  return data
}
