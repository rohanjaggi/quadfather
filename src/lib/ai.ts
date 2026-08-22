import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI, ThinkingLevel, type ThinkingConfig } from "@google/genai";
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

// --- Shared config ---

/**
 * Hard ceiling on a single provider round-trip; a hung provider must not pin the
 * function.
 *
 * Vercel kills these routes at 60 s. The old budget was 45 s × 2 attempts = 90 s,
 * so a slow provider was guaranteed to blow the function limit *before* its own
 * timeout fired — the caller was killed mid-flight and the user got nothing, no
 * log line, no fallback. One attempt at 30 s leaves room for the Telegram file
 * download that precedes a photo analysis and still surfaces a hung provider as
 * a catchable error rather than a silent platform kill.
 */
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 0;

/**
 * Output-token budgets: JSON extraction is short and structured, prose needs more
 * room.
 *
 * `max_completion_tokens` / `maxOutputTokens` count *thinking* tokens too on the
 * default reasoning models, so a tight cap can be spent entirely on reasoning and
 * return an empty string. Thinking is minimised per-provider below; the JSON
 * budget carries extra headroom on top of that for providers that ignore the hint.
 */
const MAX_TOKENS_JSON = 2048;
const MAX_TOKENS_TEXT = 1500;

const SUPPORTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

type SupportedImageType = (typeof SUPPORTED_IMAGE_TYPES)[number];

/**
 * Every provider rejects anything outside this set (HEIC/HEIF/BMP/TIFF come back
 * as an opaque 422), so fail early with a message the user can act on.
 */
function assertSupportedImageType(mimeType: string): SupportedImageType {
  const normalised = (mimeType ?? "").split(";")[0].trim().toLowerCase();
  const candidate = normalised === "image/jpg" ? "image/jpeg" : normalised;
  if (!(SUPPORTED_IMAGE_TYPES as readonly string[]).includes(candidate)) {
    throw new Error(
      `Unsupported image type "${mimeType || "unknown"}" — use JPEG, PNG, WebP or GIF`,
    );
  }
  return candidate as SupportedImageType;
}

// --- Prompt templating ---

/**
 * Fill `{placeholder}` slots in a prompt template.
 *
 * Uses a replacer *function* so `$&`, `$1`, `$$`… inside user-supplied values are
 * inserted literally rather than being interpreted by `String.prototype.replace`,
 * and substitutes in a single pass so an injected value can never itself be
 * treated as a placeholder. Unknown placeholders are left untouched.
 */
export function fillTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{([a-z_][a-z0-9_]*)\}/gi, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(values, key) ? values[key] : match,
  );
}

// --- Numeric coercion (never let NaN reach the database) ---

/**
 * Matches the first number in a string, tolerating the shapes models actually
 * emit: `-12`, `1.5`, a bare-decimal `.5`, and exponent notation `1e3` / `2.5E-2`.
 *
 * The leading-dot and exponent branches are not cosmetic. The old
 * `/-?\d+(?:\.\d+)?/` skipped the dot in `".5"` and matched `5` — a 10× overstate
 * on a macro — and truncated `"1e3"` to `1`, a 1000× understate.
 */
const NUMERIC_RE = /-?(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?/;

/**
 * Returns a finite number or null. Tolerates "~500" / "500 kcal" style strings.
 *
 * Thousands separators are stripped before the numeric match — `"1,200"` used
 * to match only the leading `1` and silently store a 200× understatement. Only
 * commas that actually sit between digit groups are removed, so a decimal comma
 * ("1,5") is left alone rather than being read as 15.
 */
export function coerceNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const match = value.replace(/(\d),(?=\d{3}(?!\d))/g, "$1").match(NUMERIC_RE);
    if (match) {
      const parsed = Number(match[0]);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

function toInt(value: unknown, fallback = 0): number {
  return Math.round(coerceNumber(value) ?? fallback);
}

function toDecimal(value: unknown, fallback = 0): number {
  return Math.round((coerceNumber(value) ?? fallback) * 10) / 10;
}

function toNullableDecimal(value: unknown): number | null {
  const parsed = coerceNumber(value);
  return parsed === null ? null : Math.round(parsed * 10) / 10;
}

// --- JSON extraction ---

function cleanJson(raw: string): string {
  return raw
    .trim()
    .replace(/^```(?:json)?\s*/, "")
    .replace(/\s*```$/, "");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Grab the first top-level `{...}` / `[...]` span, so prose preambles don't break parsing. */
export function extractJsonBlock(text: string, kind: "object" | "array"): string | null {
  const open = kind === "object" ? "{" : "[";
  const close = kind === "object" ? "}" : "]";
  const start = text.indexOf(open);
  const end = text.lastIndexOf(close);
  if (start === -1 || end <= start) return null;
  return text.slice(start, end + 1);
}

/**
 * Strip code fences, isolate the first top-level object, parse it. Shared with
 * `lib/predict` so every AI JSON path tolerates the same provider quirks.
 */
export function parseJsonObject(raw: string): Record<string, unknown> {
  const cleaned = cleanJson(raw);
  if (!cleaned) throw new Error("AI returned an empty response");

  const block = extractJsonBlock(cleaned, "object");
  if (!block) throw new Error("Failed to parse AI response");

  let data: unknown;
  try {
    data = JSON.parse(block);
  } catch {
    throw new Error("Failed to parse AI response");
  }
  if (!isRecord(data)) throw new Error("AI returned an unexpected format");
  return data;
}

function parseAnalysisResponse(raw: string): MealAnalysisResult {
  const data = parseJsonObject(raw);

  // Presence (`"calories" in data`) is not validity: `{"calories": null}`,
  // `{"calories": []}` and `{"calories": true}` all pass a key check, and
  // `toInt`/`toDecimal` then quietly coerce them to 0 — a real meal logged as a
  // 0 kcal row the user has to notice and fix by hand. Coerce first and reject
  // anything that isn't a finite number, exactly like `analyseRunScreenshot`.
  const calories = coerceNumber(data.calories);
  const protein = coerceNumber(data.protein);
  const carbohydrates = coerceNumber(data.carbohydrates);
  const fats = coerceNumber(data.fats);

  // `"food_name" in data` used to be enough, so `{"food_name": null}` was logged
  // as a meal literally called "null". Numbers are still accepted — a model that
  // answers `2` for a name is odd but not a reason to throw away the analysis.
  const foodName =
    typeof data.food_name === "string" || typeof data.food_name === "number"
      ? String(data.food_name).trim()
      : "";
  if (!foodName) {
    throw new Error("AI response missing fields: food_name");
  }

  const requiredMacros: [string, number | null][] = [
    ["calories", calories],
    ["protein", protein],
    ["carbohydrates", carbohydrates],
    ["fats", fats],
  ];
  const invalid = requiredMacros.filter(([, v]) => v === null).map(([k]) => k);
  if (invalid.length > 0) {
    throw new Error(
      `AI returned incomplete nutrition data: ${invalid.join(", ")}`,
    );
  }

  // Fiber is the one macro models routinely omit, and 0 is a defensible default
  // for it in a way it never is for calories.
  return {
    food_name: foodName,
    calories: Math.round(calories as number),
    protein: toDecimal(protein),
    carbohydrates: toDecimal(carbohydrates),
    fats: toDecimal(fats),
    fiber: toDecimal(data.fiber),
    confidence: String(data.confidence ?? "medium"),
    notes: String(data.notes ?? ""),
  };
}

function parseSuggestionsResponse(raw: string): MealSuggestion[] {
  const cleaned = cleanJson(raw);
  if (!cleaned) throw new Error("AI returned an empty response");

  let parsed: unknown;

  const arrayBlock = extractJsonBlock(cleaned, "array");
  if (arrayBlock) {
    try {
      parsed = JSON.parse(arrayBlock);
    } catch {
      parsed = undefined;
    }
  }

  // Some models wrap the array, e.g. {"suggestions": [...]} or {"meals": [...]}.
  if (!Array.isArray(parsed)) {
    const objectBlock = extractJsonBlock(cleaned, "object");
    if (objectBlock) {
      try {
        const wrapper: unknown = JSON.parse(objectBlock);
        if (isRecord(wrapper)) {
          // Not simply the *first* array: key order is whatever the model felt
          // like, so `{"notes": ["…"], "meals": [ {...}, {...} ]}` handed back
          // the notes and every suggestion was dropped. The payload we want is
          // the longest array of objects; string arrays like `notes` can never
          // win because they hold no records at all.
          const nested = Object.values(wrapper)
            .filter((v): v is unknown[] => Array.isArray(v))
            .map((arr) => ({ arr, score: arr.filter(isRecord).length }))
            .filter((c) => c.score > 0)
            .sort((a, b) => b.score - a.score)[0]?.arr;
          if (nested) parsed = nested;
        }
      } catch {
        /* fall through to the format error below */
      }
    }
  }

  if (!Array.isArray(parsed)) {
    throw new Error("AI returned an unexpected format");
  }

  return parsed.filter(isRecord).map((s) => ({
    name: String(s.name ?? "Suggested meal"),
    description: String(s.description ?? ""),
    reason: s.reason ? String(s.reason) : undefined,
    calories: toInt(s.calories),
    protein: toDecimal(s.protein),
    carbohydrates: toDecimal(s.carbohydrates),
    fats: toDecimal(s.fats),
    fiber: toDecimal(s.fiber),
  }));
}

// --- OpenAI-compatible (OpenAI + OpenRouter) ---

interface OpenAICompatTarget {
  baseURL?: string;
  /**
   * OpenAI's current chat models reject the deprecated `max_tokens`;
   * OpenRouter normalises `max_tokens` across every upstream provider.
   */
  maxTokensParam: "max_tokens" | "max_completion_tokens";
}

const OPENAI_TARGET: OpenAICompatTarget = {
  maxTokensParam: "max_completion_tokens",
};

const OPENROUTER_TARGET: OpenAICompatTarget = {
  baseURL: "https://openrouter.ai/api/v1",
  maxTokensParam: "max_tokens",
};

function openaiCompat(apiKey: string, baseURL?: string): OpenAI {
  return new OpenAI({
    apiKey,
    baseURL,
    timeout: REQUEST_TIMEOUT_MS,
    maxRetries: MAX_RETRIES,
  });
}

function tokenLimit(
  target: OpenAICompatTarget,
  maxTokens: number,
): { max_tokens: number } | { max_completion_tokens: number } {
  return target.maxTokensParam === "max_tokens"
    ? { max_tokens: maxTokens }
    : { max_completion_tokens: maxTokens };
}

/**
 * The output-token cap covers reasoning tokens as well as the visible reply, so
 * on the default reasoning models (gpt-5.4-mini and friends) a short JSON call
 * could spend its whole budget thinking and return `""` — which surfaced to the
 * user as "couldn't analyse that". Every call here wants a small, mechanical
 * JSON or a few sentences of prose; none of it benefits from extended reasoning.
 *
 * OpenRouter normalises `reasoning_effort` across upstreams and ignores it for
 * models that have no reasoning mode, so the same hint is safe on both targets.
 */
const REASONING_EFFORT = { reasoning_effort: "low" } as const;

async function openaiCompatVision(
  target: OpenAICompatTarget,
  apiKey: string,
  model: string,
  imageBase64: string,
  mimeType: SupportedImageType,
  prompt: string,
  maxTokens: number,
): Promise<string> {
  const client = openaiCompat(apiKey, target.baseURL);
  const response = await client.chat.completions.create({
    model,
    ...tokenLimit(target, maxTokens),
    ...REASONING_EFFORT,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: { url: `data:${mimeType};base64,${imageBase64}` },
          },
          { type: "text", text: prompt },
        ],
      },
    ],
  });
  return response.choices[0]?.message?.content ?? "";
}

async function openaiCompatText(
  target: OpenAICompatTarget,
  apiKey: string,
  model: string,
  prompt: string,
  maxTokens: number,
): Promise<string> {
  const client = openaiCompat(apiKey, target.baseURL);
  const response = await client.chat.completions.create({
    model,
    ...tokenLimit(target, maxTokens),
    ...REASONING_EFFORT,
    messages: [{ role: "user", content: prompt }],
  });
  return response.choices[0]?.message?.content ?? "";
}

// --- Anthropic ---

function anthropicClient(apiKey: string): Anthropic {
  return new Anthropic({
    apiKey,
    timeout: REQUEST_TIMEOUT_MS,
    maxRetries: MAX_RETRIES,
  });
}

async function anthropicVision(
  apiKey: string,
  model: string,
  imageBase64: string,
  mimeType: SupportedImageType,
  prompt: string,
  maxTokens: number,
): Promise<string> {
  const client = anthropicClient(apiKey);
  const response = await client.messages.create({
    model,
    max_tokens: maxTokens,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mimeType,
              data: imageBase64,
            },
          },
          { type: "text", text: prompt },
        ],
      },
    ],
  });
  const block = response.content[0];
  return block?.type === "text" ? block.text : "";
}

async function anthropicText(
  apiKey: string,
  model: string,
  prompt: string,
  maxTokens: number,
): Promise<string> {
  const client = anthropicClient(apiKey);
  const response = await client.messages.create({
    model,
    max_tokens: maxTokens,
    messages: [{ role: "user", content: prompt }],
  });
  const block = response.content[0];
  return block?.type === "text" ? block.text : "";
}

// --- Gemini ---

/**
 * Keep Gemini's thinking budget at the floor, for the same reason as
 * `REASONING_EFFORT`: `maxOutputTokens` is spent on thinking tokens first, so a
 * capped JSON call can come back empty.
 *
 * The control differs by generation and the wrong one is a hard 400, not a
 * silently-ignored hint: Gemini 3 models (the defaults — `gemini-3-flash-preview`,
 * `gemini-3.1-*`) take `thinkingLevel` and reject `thinkingBudget`, while 2.5 and
 * earlier take `thinkingBudget` (0 = disabled) and don't know `thinkingLevel`.
 * Unrecognised model strings get no thinking config at all rather than a guess.
 */
function geminiThinkingConfig(model: string): ThinkingConfig | undefined {
  const generation = /^(?:models\/)?gemini-(\d+)/i.exec(model)?.[1];
  if (!generation) return undefined;
  const major = Number(generation);
  if (major >= 3) return { thinkingLevel: ThinkingLevel.LOW };
  return { thinkingBudget: 0 };
}

function geminiClient(apiKey: string): GoogleGenAI {
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      timeout: REQUEST_TIMEOUT_MS,
      // `attempts` counts the original request, so this is 1 attempt, no retry.
      retryOptions: { attempts: MAX_RETRIES + 1 },
    },
  });
}

async function geminiVision(
  apiKey: string,
  model: string,
  imageBase64: string,
  mimeType: SupportedImageType,
  prompt: string,
  maxTokens: number,
): Promise<string> {
  const ai = geminiClient(apiKey);
  const response = await ai.models.generateContent({
    model,
    config: { maxOutputTokens: maxTokens, thinkingConfig: geminiThinkingConfig(model) },
    contents: [
      {
        role: "user",
        parts: [
          {
            inlineData: {
              mimeType,
              data: imageBase64,
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
  maxTokens: number,
): Promise<string> {
  const ai = geminiClient(apiKey);
  const response = await ai.models.generateContent({
    model,
    config: { maxOutputTokens: maxTokens, thinkingConfig: geminiThinkingConfig(model) },
    contents: prompt,
  });
  return response.text ?? "";
}

// --- Routing ---

async function callVision(
  provider: AIProvider,
  apiKey: string,
  model: string,
  imageBase64: string,
  mimeType: string,
  prompt: string,
  maxTokens: number = MAX_TOKENS_JSON,
): Promise<string> {
  const imageType = assertSupportedImageType(mimeType);
  switch (provider) {
    case "openai":
      return openaiCompatVision(OPENAI_TARGET, apiKey, model, imageBase64, imageType, prompt, maxTokens);
    case "anthropic":
      return anthropicVision(apiKey, model, imageBase64, imageType, prompt, maxTokens);
    case "gemini":
      return geminiVision(apiKey, model, imageBase64, imageType, prompt, maxTokens);
    case "openrouter":
      return openaiCompatVision(OPENROUTER_TARGET, apiKey, model, imageBase64, imageType, prompt, maxTokens);
  }
}

async function callText(
  provider: AIProvider,
  apiKey: string,
  model: string,
  prompt: string,
  maxTokens: number = MAX_TOKENS_JSON,
): Promise<string> {
  switch (provider) {
    case "openai":
      return openaiCompatText(OPENAI_TARGET, apiKey, model, prompt, maxTokens);
    case "anthropic":
      return anthropicText(apiKey, model, prompt, maxTokens);
    case "gemini":
      return geminiText(apiKey, model, prompt, maxTokens);
    case "openrouter":
      return openaiCompatText(OPENROUTER_TARGET, apiKey, model, prompt, maxTokens);
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
  const prompt = fillTemplate(VISION_PROMPT, {
    description: description || "No additional context provided.",
  });
  const raw = await callVision(
    provider,
    apiKey,
    resolvedModel,
    imageBytes.toString("base64"),
    mimeType,
    prompt,
    MAX_TOKENS_JSON,
  );
  return parseAnalysisResult(raw);
}

export async function parseFood(
  provider: AIProvider,
  apiKey: string,
  model: string | null,
  text: string,
): Promise<MealAnalysisResult> {
  const resolvedModel = getModelForProvider(provider, model);
  const prompt = fillTemplate(TEXT_PROMPT, { text });
  const raw = await callText(provider, apiKey, resolvedModel, prompt, MAX_TOKENS_JSON);
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
    ? `\nThe user exercised today, earning ~${Math.round(exerciseToday)} extra kcal (this credit is already reflected in the remaining budget above — do not add it again).`
    : '';

  const hour = new Date().getUTCHours() + 8;
  const timeOfDay = hour < 11 ? 'morning (breakfast/brunch time)'
    : hour < 14 ? 'midday (lunch time)'
    : hour < 17 ? 'afternoon (snack time)'
    : hour < 21 ? 'evening (dinner time)'
    : 'late night (light snack time)';

  const prompt = fillTemplate(SUGGEST_PROMPT, {
    calories: String(Math.round(remainingCalories)),
    protein: String(Math.round(remainingProtein)),
    meals: mealsLogged.length > 0 ? mealsLogged.join(", ") : "nothing yet",
    time_of_day: timeOfDay,
    restrictions_block: restrictionsBlock,
    saved_foods_block: savedFoodsBlock,
    exercise_block: exerciseBlock,
  });

  const raw = await callText(provider, apiKey, resolvedModel, prompt, MAX_TOKENS_JSON);
  return parseSuggestionsResponse(raw);
}

function parseAnalysisResult(raw: string): MealAnalysisResult {
  return parseAnalysisResponse(raw);
}

const DAILY_COACH_PROMPT = `You are a friendly nutrition coach reviewing a user's day. Here's their data:

Daily goals (this calorie figure ALREADY includes any exercise and step credit earned today): {goals}
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
    if (extraAllowance > 0) {
      stepsBlock += ` — earned +${extraAllowance} kcal, already credited into the daily goal above (do not add it again)`;
    }
  }

  const prompt = fillTemplate(DAILY_COACH_PROMPT, {
    goals: `${context.goals.calories} kcal, ${context.goals.protein}g protein`,
    meals: context.meals.length > 0 ? context.meals.join(', ') : 'nothing logged',
    macros_consumed: `${context.consumed.calories} kcal, ${context.consumed.protein}g P, ${context.consumed.carbs}g C, ${context.consumed.fats}g F`,
    water_consumed: String(context.waterConsumed.toFixed(1)),
    water_goal: String(context.waterGoal),
    exercise: context.exerciseCalories > 0
      ? `burned ~${Math.round(context.exerciseCalories)} kcal today (50% of this is already credited into the daily goal above — do not add it again)`
      : 'No exercise logged',
    steps_block: stepsBlock,
    restrictions_block: restrictionsBlock,
  });

  const raw = await callText(provider, apiKey, resolvedModel, prompt, MAX_TOKENS_TEXT);
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

  const prompt = fillTemplate(WEEKLY_INSIGHTS_PROMPT, {
    goals: `${context.goals.calories} kcal, ${context.goals.protein}g protein, ${context.goals.water}L water`,
    daily_breakdown: dailyBreakdown,
    averages: `${avgCal} kcal/day, ${avgPro}g protein/day`,
    exercise_total: String(Math.round(context.exerciseTotal)),
    exercise_sessions: String(context.exerciseSessions),
    restrictions_block: restrictionsBlock,
  });

  const raw = await callText(provider, apiKey, resolvedModel, prompt, MAX_TOKENS_TEXT);
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

  // The caller already base64-encoded the upload; pass it straight through.
  const raw = await callVision(
    provider,
    apiKey,
    resolvedModel,
    imageBase64,
    mimeType,
    prompt,
    MAX_TOKENS_JSON,
  )

  const data = parseJsonObject(raw)

  const distanceMeters = coerceNumber(data.distance_meters)
  const durationSeconds = coerceNumber(data.duration_seconds)
  const caloriesBurned = coerceNumber(data.calories_burned)

  const required: [string, number | null][] = [
    ['distance_meters', distanceMeters],
    ['duration_seconds', durationSeconds],
    ['calories_burned', caloriesBurned],
  ]
  for (const [key, value] of required) {
    if (value === null) {
      throw new Error(`AI response missing or invalid field: ${key}`)
    }
  }

  const pacePerKm = toNullableDecimal(data.pace_per_km)
  const averageHeartrate = coerceNumber(data.average_heartrate)
  const confidence = data.confidence

  return {
    distance_meters: Math.round(distanceMeters as number),
    duration_seconds: Math.round(durationSeconds as number),
    calories_burned: Math.round(caloriesBurned as number),
    ...(pacePerKm !== null ? { pace_per_km: pacePerKm } : {}),
    ...(averageHeartrate !== null
      ? { average_heartrate: Math.round(averageHeartrate) }
      : {}),
    confidence:
      confidence === 'high' || confidence === 'medium' || confidence === 'low'
        ? confidence
        : 'low',
    notes: String(data.notes ?? ''),
  }
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

  const prompt = fillTemplate(TRENDS_COACH_PROMPT, {
    period: String(context.period),
    goals: `${context.goals.calories} kcal, ${context.goals.protein}g protein, ${context.goals.carbs}g carbs, ${context.goals.fats}g fats, ${context.goals.fiber}g fiber, ${context.goals.water}L water`,
    restrictions_block: restrictionsBlock,
    daily_breakdown: dailyBreakdown,
    averages: `${avgCal} kcal, ${avgPro}g P, ${avgCarbs}g C, ${avgFats}g F, ${avgFiber}g fiber, ${avgWater}L water per day`,
    macro_split: `Protein ${pP}%, Carbs ${pC}%, Fats ${pF}%`,
    exercise_total: String(Math.round(context.exerciseTotal)),
    exercise_sessions: String(context.exerciseSessions),
  });

  const raw = await callText(provider, apiKey, resolvedModel, prompt, MAX_TOKENS_TEXT);
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
  const prompt = fillTemplate(WORKOUT_PARSE_PROMPT, { text });
  const raw = await callText(provider, apiKey, resolvedModel, prompt, MAX_TOKENS_JSON);
  const data = parseJsonObject(raw);

  // Filter *before* the emptiness check. The old order counted raw entries, so a
  // model that answered `{"exercises": ["bench 4x8"]}` — strings, not objects —
  // sailed through as a success and returned an empty exercise list, which the
  // caller then saved as a workout with nothing in it.
  const exercises = (Array.isArray(data.exercises) ? data.exercises : [])
    .filter(isRecord)
    .map((ex, index) => ({
      exercise_name: String(ex.exercise_name ?? ""),
      sets: (Array.isArray(ex.sets) ? ex.sets : []).filter(isRecord).map((s) => ({
        reps: toInt(s.reps),
        weight_kg: s.weight_kg != null ? toNullableDecimal(s.weight_kg) : null,
      })),
      order: toInt(ex.order, index + 1),
    }))
    // Same trap one level down: an exercise whose sets were all unparseable is
    // not a logged exercise.
    .filter((ex) => ex.exercise_name.length > 0 && ex.sets.length > 0);

  if (!data.name || exercises.length === 0) {
    throw new Error("AI response missing name or exercises");
  }

  return {
    name: String(data.name),
    exercises,
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

  const prompt = fillTemplate(WORKOUT_ANALYSIS_PROMPT, {
    workout_name: context.workoutName,
    exercises: exercisesStr,
    progress_context: context.progressContext,
    training_focus: context.trainingFocus,
    prs: prsStr,
  });

  const raw = await callText(provider, apiKey, resolvedModel, prompt, MAX_TOKENS_JSON);
  const data = parseJsonObject(raw);

  // This object is persisted on the workout and served from cache forever,
  // so a malformed shape must never make it past here.
  const volumeComparison =
    typeof data.volume_comparison === 'string' ? data.volume_comparison.trim() : '';
  const takeaway = typeof data.takeaway === 'string' ? data.takeaway.trim() : '';
  if (!volumeComparison || !takeaway) {
    throw new Error('AI returned an invalid analysis');
  }

  return {
    muscle_groups_hit: Array.isArray(data.muscle_groups_hit)
      ? data.muscle_groups_hit.map((m: unknown) => String(m))
      : [],
    prs: Array.isArray(data.prs)
      ? data.prs.filter(isRecord).map((pr) => ({
          exercise: String(pr.exercise ?? ''),
          type: pr.type === 'reps' ? ('reps' as const) : ('weight' as const),
          value: String(pr.value ?? ''),
        }))
      : [],
    volume_comparison: volumeComparison,
    takeaway,
  };
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

  const prompt = fillTemplate(WEEKLY_EXERCISE_PROMPT, {
    training_focus: context.trainingFocus,
    session_count: String(context.sessionCount),
    streak: String(context.streak),
    volume_breakdown: context.volumeBreakdown || 'No data',
    stall_alerts: context.stallAlerts || 'None',
  });

  const raw = await callText(provider, apiKey, resolvedModel, prompt, MAX_TOKENS_TEXT);
  return raw.trim();
}

const WORKOUT_RECAP_PROMPT = `You are a concise strength coach reviewing a lifter's training data.

Period: {period} days
Workouts logged: {workout_count}
Total volume: {total_volume}kg
Previous period volume: {prev_volume}kg
Muscle groups hit: {muscles_hit}
Muscle groups missed: {muscles_missed}
PRs this period: {prs_summary}

Exercises performed:
{exercise_summary}

Write a 2-4 sentence training recap. Cover: frequency, volume trend vs previous period, any muscle coverage gaps. End with one specific, actionable suggestion. Be factual and coach-like — no motivational fluff, no greetings, no sign-offs.`;

export async function generateWorkoutRecap(
  provider: AIProvider,
  apiKey: string,
  model: string | null,
  context: {
    period: number
    workoutCount: number
    totalVolume: number
    prevVolume: number
    musclesHit: string[]
    musclesMissed: string[]
    prsSummary: string
    exerciseSummary: string
  },
): Promise<string> {
  const resolvedModel = getModelForProvider(provider, model)

  const prompt = fillTemplate(WORKOUT_RECAP_PROMPT, {
    period: String(context.period),
    workout_count: String(context.workoutCount),
    total_volume: String(context.totalVolume),
    prev_volume: String(context.prevVolume),
    muscles_hit: context.musclesHit.join(', ') || 'none',
    muscles_missed: context.musclesMissed.join(', ') || 'none',
    prs_summary: context.prsSummary || 'none',
    exercise_summary: context.exerciseSummary,
  })

  const raw = await callText(provider, apiKey, resolvedModel, prompt, MAX_TOKENS_TEXT)
  return raw.trim()
}

export { callText as callTextDirect }
