import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";
import { getModelForProvider, type AIProvider } from "@/lib/models";

const VISION_PROMPT = `Estimate the nutritional content of the food shown.

Additional context from user: {description}

Return ONLY valid JSON:

{
  "food_name": "descriptive name for this meal",
  "calories": <integer>,
  "protein": <number in grams, one decimal>,
  "carbohydrates": <number in grams, one decimal>,
  "fats": <number in grams, one decimal>,
  "fiber": <number in grams, one decimal>,
  "confidence": "high" | "medium" | "low",
  "notes": "brief note on portion assumptions"
}`;

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
  model: string,
  imageBytes: Buffer,
  mimeType: string,
  prompt: string,
): Promise<string> {
  const client = new OpenAI({ apiKey });
  const base64Image = imageBytes.toString("base64");
  const response = await client.chat.completions.create({
    model,
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
  model: string,
  prompt: string,
): Promise<string> {
  const client = new OpenAI({ apiKey });
  const response = await client.chat.completions.create({
    model,
    messages: [{ role: "user", content: prompt }],
  });
  return response.choices[0]?.message?.content ?? "";
}

// --- Anthropic ---

async function anthropicVision(
  apiKey: string,
  model: string,
  imageBytes: Buffer,
  mimeType: string,
  prompt: string,
): Promise<string> {
  const client = new Anthropic({ apiKey });
  const base64Image = imageBytes.toString("base64");
  const response = await client.messages.create({
    model,
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
  model: string,
  prompt: string,
): Promise<string> {
  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model,
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });
  const block = response.content[0];
  return block.type === "text" ? block.text : "";
}

// --- Gemini ---

async function geminiVision(
  apiKey: string,
  model: string,
  imageBytes: Buffer,
  mimeType: string,
  prompt: string,
): Promise<string> {
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model,
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
  model: string,
  prompt: string,
): Promise<string> {
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model,
    contents: prompt,
  });
  return response.text ?? "";
}

// --- OpenRouter ---

async function openrouterVision(
  apiKey: string,
  model: string,
  imageBytes: Buffer,
  mimeType: string,
  prompt: string,
): Promise<string> {
  const client = new OpenAI({ apiKey, baseURL: "https://openrouter.ai/api/v1" });
  const base64Image = imageBytes.toString("base64");
  const response = await client.chat.completions.create({
    model,
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
  model: string,
  prompt: string,
): Promise<string> {
  const client = new OpenAI({ apiKey, baseURL: "https://openrouter.ai/api/v1" });
  const response = await client.chat.completions.create({
    model,
    messages: [{ role: "user", content: prompt }],
  });
  return response.choices[0]?.message?.content ?? "";
}

// --- Routing ---

async function callVision(
  provider: AIProvider,
  apiKey: string,
  model: string,
  imageBytes: Buffer,
  mimeType: string,
  prompt: string,
): Promise<string> {
  switch (provider) {
    case "openai":
      return openaiVision(apiKey, model, imageBytes, mimeType, prompt);
    case "anthropic":
      return anthropicVision(apiKey, model, imageBytes, mimeType, prompt);
    case "gemini":
      return geminiVision(apiKey, model, imageBytes, mimeType, prompt);
    case "openrouter":
      return openrouterVision(apiKey, model, imageBytes, mimeType, prompt);
  }
}

async function callText(
  provider: AIProvider,
  apiKey: string,
  model: string,
  prompt: string,
): Promise<string> {
  switch (provider) {
    case "openai":
      return openaiText(apiKey, model, prompt);
    case "anthropic":
      return anthropicText(apiKey, model, prompt);
    case "gemini":
      return geminiText(apiKey, model, prompt);
    case "openrouter":
      return openrouterText(apiKey, model, prompt);
  }
}

// --- Public API ---

export async function analyseMeal(
  provider: AIProvider,
  apiKey: string,
  model: string | null,
  imageBytes: Buffer,
  mimeType: string,
  description: string = "",
): Promise<MealAnalysisResult> {
  const resolvedModel = getModelForProvider(provider, model);
  const prompt = VISION_PROMPT.replace(
    "{description}",
    description || "No additional context provided.",
  );
  const raw = await callVision(provider, apiKey, resolvedModel, imageBytes, mimeType, prompt);
  return parseAnalysisResult(raw);
}

export async function parseFood(
  provider: AIProvider,
  apiKey: string,
  model: string | null,
  text: string,
): Promise<MealAnalysisResult> {
  const resolvedModel = getModelForProvider(provider, model);
  const prompt = TEXT_PROMPT.replace("{text}", text);
  const raw = await callText(provider, apiKey, resolvedModel, prompt);
  return parseAnalysisResult(raw);
}

export async function suggestMeals(
  provider: AIProvider,
  apiKey: string,
  model: string | null,
  remainingCalories: number,
  remainingProtein: number,
  mealsLogged: string[],
  dietaryRestrictions: string[] = [],
  savedFoodNames: string[] = [],
  exerciseToday: number = 0,
): Promise<MealSuggestion[]> {
  const resolvedModel = getModelForProvider(provider, model);
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

  const raw = await callText(provider, apiKey, resolvedModel, prompt);
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
{steps_block}
{restrictions_block}

Give a short, encouraging coaching message (2-3 sentences max). Be specific about what they did well and give ONE actionable tip for tomorrow. Keep it warm but direct — no bullet points, no headers, just natural conversational text.`;

export async function generateDailyCoach(
  provider: AIProvider,
  apiKey: string,
  model: string | null,
  context: {
    goals: { calories: number; protein: number };
    consumed: { calories: number; protein: number; carbs: number; fats: number };
    meals: string[];
    waterConsumed: number;
    waterGoal: number;
    exerciseCalories: number;
    dietaryRestrictions: string[];
    steps?: { today: number; goal: number; streak: number; extraAllowance: number };
  },
): Promise<string> {
  const resolvedModel = getModelForProvider(provider, model);
  const restrictionsBlock = context.dietaryRestrictions.length > 0
    ? `Dietary restrictions: ${context.dietaryRestrictions.join(', ')}`
    : '';

  let stepsBlock = '';
  if (context.steps) {
    const { today, goal, streak, extraAllowance } = context.steps;
    stepsBlock = `Steps: ${today.toLocaleString()} / ${goal.toLocaleString()} goal`;
    if (streak > 0) stepsBlock += ` (${streak}-day streak)`;
    if (extraAllowance > 0) stepsBlock += ` — earned +${extraAllowance} kcal`;
  }

  const prompt = DAILY_COACH_PROMPT
    .replace("{goals}", `${context.goals.calories} kcal, ${context.goals.protein}g protein`)
    .replace("{meals}", context.meals.length > 0 ? context.meals.join(', ') : 'nothing logged')
    .replace("{macros_consumed}", `${context.consumed.calories} kcal, ${context.consumed.protein}g P, ${context.consumed.carbs}g C, ${context.consumed.fats}g F`)
    .replace("{water_consumed}", String(context.waterConsumed.toFixed(1)))
    .replace("{water_goal}", String(context.waterGoal))
    .replace("{exercise}", context.exerciseCalories > 0 ? `Burned ~${Math.round(context.exerciseCalories)} kcal` : 'No exercise logged')
    .replace("{steps_block}", stepsBlock)
    .replace("{restrictions_block}", restrictionsBlock);

  const raw = await callText(provider, apiKey, resolvedModel, prompt);
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
  model: string | null,
  context: {
    goals: { calories: number; protein: number; water: number };
    days: { date: string; calories: number; protein: number; water: number }[];
    exerciseTotal: number;
    exerciseSessions: number;
    dietaryRestrictions: string[];
  },
): Promise<string> {
  const resolvedModel = getModelForProvider(provider, model);
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

  const raw = await callText(provider, apiKey, resolvedModel, prompt);
  return raw.trim();
}

export async function analyseRunScreenshot(
  provider: AIProvider,
  apiKey: string,
  model: string | null,
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
  const resolvedModel = getModelForProvider(provider, model);
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
      raw = await openaiVision(apiKey, resolvedModel, imageBytes, mimeType, prompt)
      break
    case 'anthropic':
      raw = await anthropicVision(apiKey, resolvedModel, imageBytes, mimeType, prompt)
      break
    case 'gemini':
      raw = await geminiVision(apiKey, resolvedModel, imageBytes, mimeType, prompt)
      break
    case 'openrouter':
      raw = await openrouterVision(apiKey, resolvedModel, imageBytes, mimeType, prompt)
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

const TRENDS_COACH_PROMPT = `You are a friendly, knowledgeable nutrition coach reviewing a client's food tracking data. Speak naturally — like a nutritionist chatting with them over coffee. No bullet points, no headers, no formatting. Just 3-4 sentences of warm, specific feedback.

Period: {period} days
Goals: {goals}
{restrictions_block}

Day-by-day data:
{daily_breakdown}

Averages: {averages}
Macro split: {macro_split}
Exercise: {exercise_total} kcal burned across {exercise_sessions} sessions

Guidelines for your response:
- Reference specific numbers and patterns you see (e.g. "Your protein dropped to 80g on the last two days")
- Acknowledge one thing they're doing well
- Give one specific, actionable suggestion for the next few days
- If they have dietary restrictions, factor those into suggestions (e.g. plant-based protein sources)
- For 7-day data: focus on recent momentum and day-to-day consistency
- For 30-day data: focus on longer-term trends and weekly patterns
- Keep it conversational — like texting a friend who happens to be a nutritionist`;

export async function generateTrendsCoach(
  provider: AIProvider,
  apiKey: string,
  model: string | null,
  context: {
    period: number;
    goals: { calories: number; protein: number; carbs: number; fats: number; fiber: number; water: number };
    days: { date: string; calories: number; protein: number; carbs: number; fats: number; fiber: number; water: number; meals_logged: number }[];
    exerciseTotal: number;
    exerciseSessions: number;
    dietaryRestrictions: string[];
  },
): Promise<string> {
  const resolvedModel = getModelForProvider(provider, model);

  const restrictionsBlock = context.dietaryRestrictions.length > 0
    ? `Dietary restrictions: ${context.dietaryRestrictions.join(', ')}`
    : 'No dietary restrictions noted.';

  const dailyBreakdown = context.days.map(d =>
    `${d.date}: ${d.calories} kcal, ${d.protein}g P, ${d.carbs}g C, ${d.fats}g F, ${d.fiber}g fiber, ${d.water.toFixed(1)}L water (${d.meals_logged} meals)`
  ).join('\n');

  const activeDays = context.days.filter(d => d.meals_logged > 0);
  const count = Math.max(activeDays.length, 1);
  const avgCal = Math.round(activeDays.reduce((s, d) => s + d.calories, 0) / count);
  const avgPro = Math.round(activeDays.reduce((s, d) => s + d.protein, 0) / count);
  const avgCarbs = Math.round(activeDays.reduce((s, d) => s + d.carbs, 0) / count);
  const avgFats = Math.round(activeDays.reduce((s, d) => s + d.fats, 0) / count);
  const avgFiber = Math.round(activeDays.reduce((s, d) => s + d.fiber, 0) / count);
  const avgWater = (activeDays.reduce((s, d) => s + d.water, 0) / count).toFixed(1);

  const totalCals = avgCal || 1;
  const pP = Math.round((avgPro * 4 / totalCals) * 100);
  const pC = Math.round((avgCarbs * 4 / totalCals) * 100);
  const pF = Math.round((avgFats * 9 / totalCals) * 100);

  const prompt = TRENDS_COACH_PROMPT
    .replace('{period}', String(context.period))
    .replace('{goals}', `${context.goals.calories} kcal, ${context.goals.protein}g protein, ${context.goals.carbs}g carbs, ${context.goals.fats}g fats, ${context.goals.fiber}g fiber, ${context.goals.water}L water`)
    .replace('{restrictions_block}', restrictionsBlock)
    .replace('{daily_breakdown}', dailyBreakdown)
    .replace('{averages}', `${avgCal} kcal, ${avgPro}g P, ${avgCarbs}g C, ${avgFats}g F, ${avgFiber}g fiber, ${avgWater}L water per day`)
    .replace('{macro_split}', `Protein ${pP}%, Carbs ${pC}%, Fats ${pF}%`)
    .replace('{exercise_total}', String(Math.round(context.exerciseTotal)))
    .replace('{exercise_sessions}', String(context.exerciseSessions));

  const raw = await callText(provider, apiKey, resolvedModel, prompt);
  return raw.trim();
}

const WORKOUT_PARSE_PROMPT = `You are a fitness coach parsing a freeform workout description into structured data.

Input: {text}

Parse this into individual exercises with sets, reps, and weight. Common formats:
- "bench 80kg 4x8" = bench press, 4 sets of 8 reps at 80kg
- "push-ups 3x15" = push-ups, 3 sets of 15 reps, no weight
- "deadlift 120 3x5" = deadlift, 3 sets of 5 reps at 120kg
- "plank 3x60s" = plank, 3 sets of 60 reps (treat seconds as reps for time-based)

Return ONLY valid JSON:

{
  "name": "short workout name (e.g. 'Upper Body', 'Push Day', 'Quick Arms')",
  "exercises": [
    {
      "exercise_name": "full exercise name",
      "sets": [{"reps": <number>, "weight_kg": <number or null>}],
      "order": <1-based position>
    }
  ],
  "confidence": "high" | "medium" | "low",
  "notes": "brief note on any assumptions made"
}

If the same set scheme repeats (e.g. 4x8), expand into individual set objects all with the same reps/weight.
If no weight mentioned, use null for weight_kg (bodyweight exercise).
Confidence is "high" if all exercises clearly specified, "medium" if some interpretation needed, "low" if very ambiguous.`;

export async function parseWorkoutText(
  provider: AIProvider,
  apiKey: string,
  model: string | null,
  text: string,
): Promise<{
  name: string
  exercises: { exercise_name: string; sets: { reps: number; weight_kg: number | null }[]; order: number }[]
  confidence: string
  notes: string
}> {
  const resolvedModel = getModelForProvider(provider, model);
  const prompt = WORKOUT_PARSE_PROMPT.replace("{text}", text);
  const raw = await callText(provider, apiKey, resolvedModel, prompt);
  const cleaned = cleanJson(raw);
  if (!cleaned) throw new Error("AI returned an empty response");
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Failed to parse AI response");
  const data = JSON.parse(jsonMatch[0]);

  if (!data.name || !Array.isArray(data.exercises) || data.exercises.length === 0) {
    throw new Error("AI response missing name or exercises");
  }

  return {
    name: String(data.name),
    exercises: data.exercises.map((ex: { exercise_name: string; sets: { reps: number; weight_kg: number | null }[]; order: number }) => ({
      exercise_name: String(ex.exercise_name),
      sets: Array.isArray(ex.sets) ? ex.sets.map((s: { reps: number; weight_kg: number | null }) => ({
        reps: Number(s.reps),
        weight_kg: s.weight_kg != null ? Number(s.weight_kg) : null,
      })) : [],
      order: Number(ex.order),
    })),
    confidence: String(data.confidence ?? "medium"),
    notes: String(data.notes ?? ""),
  };
}

const WORKOUT_ANALYSIS_PROMPT = `You are a concise fitness coach analyzing a workout just completed.

Workout: {workout_name}
Exercises performed:
{exercises}

Progress context:
{progress_context}

Training focus: {training_focus}

Respond with ONLY valid JSON:
{
  "muscle_groups_hit": ["list of muscle groups worked"],
  "prs": [{"exercise": "name", "type": "weight"|"reps", "value": "description"}],
  "volume_comparison": "brief comparison vs previous session (e.g. '+12% volume' or 'first session')",
  "takeaway": "one actionable sentence for next session (max 25 words)"
}

PRs to include: {prs}
Keep the takeaway specific and actionable. No fluff.`;

export async function generateWorkoutAnalysis(
  provider: AIProvider,
  apiKey: string,
  model: string | null,
  context: {
    workoutName: string
    exercises: { name: string; sets: { reps: number; weight_kg: number | null }[] }[]
    progressContext: string
    trainingFocus: string
    prs: { exercise_name: string; type: string; value: string }[]
  },
): Promise<{
  muscle_groups_hit: string[]
  prs: { exercise: string; type: 'weight' | 'reps'; value: string }[]
  volume_comparison: string
  takeaway: string
}> {
  const resolvedModel = getModelForProvider(provider, model);

  const exercisesStr = context.exercises.map(ex =>
    `${ex.name}: ${ex.sets.map(s => `${s.reps}${s.weight_kg ? ` @ ${s.weight_kg}kg` : ''}`).join(', ')}`
  ).join('\n');

  const prsStr = context.prs.length > 0
    ? context.prs.map(p => `${p.exercise_name}: ${p.type} PR — ${p.value}`).join(', ')
    : 'None this session';

  const prompt = WORKOUT_ANALYSIS_PROMPT
    .replace('{workout_name}', context.workoutName)
    .replace('{exercises}', exercisesStr)
    .replace('{progress_context}', context.progressContext)
    .replace('{training_focus}', context.trainingFocus)
    .replace('{prs}', prsStr);

  const raw = await callText(provider, apiKey, resolvedModel, prompt);
  const cleaned = cleanJson(raw);
  if (!cleaned) throw new Error('AI returned an empty response');
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Failed to parse AI response');
  return JSON.parse(jsonMatch[0]);
}

const WEEKLY_EXERCISE_PROMPT = `You are a concise fitness coach delivering a weekly training digest.

Training focus: {training_focus}
Sessions this week: {session_count}
Current streak: {streak} consecutive days with a workout

Volume by muscle group (sets this week vs last week):
{volume_breakdown}

Stalled exercises (3+ sessions without 1RM improvement):
{stall_alerts}

Respond in plain text (no markdown, no bullet points beyond "•"). Format:

Line 1: One-sentence volume summary (mention total sessions + any imbalances)
Line 2-3: If stalls exist, "• [exercise]: [specific suggestion]" for each (max 3)
Line 4: One forward-looking sentence — what to prioritize next week based on training focus and current data

Keep it under 100 words total. Be specific with numbers. Warm but direct.`;

export async function generateWeeklyExerciseDigest(
  provider: AIProvider,
  apiKey: string,
  model: string | null,
  context: {
    trainingFocus: string
    sessionCount: number
    streak: number
    volumeBreakdown: string
    stallAlerts: string
  },
): Promise<string> {
  const resolvedModel = getModelForProvider(provider, model);

  const prompt = WEEKLY_EXERCISE_PROMPT
    .replace('{training_focus}', context.trainingFocus)
    .replace('{session_count}', String(context.sessionCount))
    .replace('{streak}', String(context.streak))
    .replace('{volume_breakdown}', context.volumeBreakdown || 'No data')
    .replace('{stall_alerts}', context.stallAlerts || 'None');

  const raw = await callText(provider, apiKey, resolvedModel, prompt);
  return raw.trim();
}

const WORKOUT_SUGGESTION_PROMPT = `You are a fitness coach. Based on the user's recent training history, suggest what they should train today in ONE short sentence (max 20 words).

Recent workouts (last 7 days):
{recent_workouts}

Available templates: {templates}
User's fitness goal: {fitness_goal}

If they haven't trained in 5+ days, encourage them warmly.
If they trained yesterday, consider recovery.
Focus on muscle groups NOT recently hit.

Respond with ONLY valid JSON:
{"suggestion": "one sentence suggestion", "template_id": <number or null if no template fits>}`;

export async function generateWorkoutSuggestion(
  provider: AIProvider,
  apiKey: string,
  model: string | null,
  context: {
    recentWorkouts: { name: string; date: string; exercises: string[] }[];
    templates: { id: number; name: string }[];
    fitnessGoal: string;
  },
): Promise<{ suggestion: string; template_id: number | null }> {
  const resolvedModel = getModelForProvider(provider, model);

  const recentStr = context.recentWorkouts.length > 0
    ? context.recentWorkouts.map(w => `${w.date}: ${w.name} (${w.exercises.join(', ')})`).join('\n')
    : 'No workouts in the last 7 days';

  const templatesStr = context.templates.length > 0
    ? context.templates.map(t => `${t.id}: ${t.name}`).join(', ')
    : 'No templates saved';

  const prompt = WORKOUT_SUGGESTION_PROMPT
    .replace('{recent_workouts}', recentStr)
    .replace('{templates}', templatesStr)
    .replace('{fitness_goal}', context.fitnessGoal || 'general fitness');

  const raw = await callText(provider, apiKey, resolvedModel, prompt);
  const cleaned = cleanJson(raw);
  if (!cleaned) return { suggestion: "Time to train! Pick a workout and get moving.", template_id: null };
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return { suggestion: "Time to train! Pick a workout and get moving.", template_id: null };
  const data = JSON.parse(jsonMatch[0]);
  return {
    suggestion: String(data.suggestion ?? "Time to train!"),
    template_id: data.template_id ?? null,
  };
}
