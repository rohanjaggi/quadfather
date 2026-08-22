# Quadfather — Code Review: Bugs, Pain Points & Improvements

*Deep-dive review of the full repo (July 2026). Build ✅ and `tsc --noEmit` ✅ both pass. No tests exist, ESLint is unconfigured, and there are real bugs below. Items are ordered by priority within each section; file:line references are from the current `main`.*

---

## 1. 🔴 Critical — fix these first

### 1.1 Anyone on Telegram can burn your Gemini/OpenRouter quota
There is no user allowlist. Any Telegram user who opens the bot gets a row created via `POST /api/users`, and `getUserAICredentials()` (`src/lib/auth.ts:125-133`) silently falls back to **your** server-side `GEMINI_API_KEY` / `OPENROUTER_API_KEY` when a user has no BYOK key. Every AI endpoint (photo analysis, parse, suggestions, coach) is therefore billable-by-strangers.
- [ ] Add an allowlist (env var of telegram IDs, or a `is_approved` flag on `User`) checked in `getAuthenticatedUser`
- [ ] Or: only fall back to server keys when `telegram_id === DEV/OWNER id`
- [ ] Related: `has_api_key` in `POST /api/users` (`src/app/api/users/route.ts:50`) reports `true` just because a server fallback key exists — the UI can't tell "I set a key" from "the owner pays"

### 1.2 Cron & webhook auth fail *open* when env vars are missing
- `src/app/api/cron/daily-coach/route.ts:26` (and weekly-insights, weekly-exercise): `authHeader !== \`Bearer ${CRON_SECRET}\`` — if `CRON_SECRET` is unset, sending `Authorization: Bearer ` (empty) passes, and the endpoint mass-messages every user.
- `src/app/api/webhook/[secret]/route.ts:13`: `if (WEBHOOK_SECRET && secret !== WEBHOOK_SECRET)` — if `WEBHOOK_SECRET` is unset, **every** request is accepted.
- [ ] Fail closed: `if (!CRON_SECRET || authHeader !== ...) return 401` (same for webhook)
- [ ] Nicer: use Telegram's native `secret_token` on `setWebhook` + grammY's built-in check instead of a secret in the URL path

### 1.3 Live secrets sitting in dead directories
- `fastapi/.env` contains a real `DATABASE_URL`, `BOTFATHER_TOKEN`, and `GEMINI_API_KEY` for the long-decommissioned FastAPI stack. The rest of `fastapi/` is only `__pycache__` — the source was deleted, the secrets weren't.
- Root `.env` contains the real bot token (gitignored, but duplicated across `.env` / `.env.local` / `fastapi/.env`).
- [ ] Delete `fastapi/`, `frontend/` (only orphaned `node_modules` + `.next`), and root `.venv/`
- [ ] Rotate the bot token & Gemini key (they've lived in multiple loose files for months)
- [ ] Remove the stale `heroku` git remote (`git remote remove heroku`) — deployment is Vercel
- [ ] Consolidate on a single `.env.local`

### 1.4 Fire-and-forget work on serverless can be silently killed
`src/app/api/workouts/route.ts:77`: `updateProgressAfterWorkout(...).catch(...)` runs *after* the response is returned. On Vercel the function can be frozen the moment the response is sent — PR detection and progress snapshots are then lost non-deterministically (this would look like "sometimes my PRs don't register").
- [ ] Either `await` it (it's fast enough) or use `waitUntil` / Next 15's `after()`

---

## 2. 🟠 Security hardening (worth doing, lower urgency)

- **`SKIP_TELEGRAM_AUTH` is a prod foot-gun** (`src/lib/auth.ts:19`). If it's ever set in Vercel, all auth is bypassed and every request becomes `DEV_USER_ID`. Guard it: `if (SKIP_TELEGRAM_AUTH && process.env.NODE_ENV !== "production")`.
- **No `auth_date` freshness check** in `verifyTelegramAuth` — a captured `initData` blob is valid forever (replay). Telegram docs recommend rejecting anything older than ~1 hour/day.
- **`timingSafeEqual` throws on length mismatch** (`src/lib/auth.ts:46`): a `hash` param of a different length throws `RangeError`, which the routes' string-matching then maps to **500**, not 401. Compare digests of equal length (hash both sides) or check length first.
- **Missing `user` in initData** → `JSON.parse("{}")` → `telegramUser.id === undefined` → `findUnique({ where: { telegram_id: undefined }})` throws a Prisma error → 500. Validate the parsed user has an `id`.
- **Apple-Shortcuts access tokens stored in plaintext** (`users.access_token`). It's a bearer credential to the whole account; store a SHA-256 hash and look up by hash instead.
- **Strava OAuth `state` never expires** (`src/lib/strava.ts:9-21`): HMAC over `telegram_id` only, truncated to 64 bits, reusing `ENCRYPTION_KEY` as the HMAC key. Add a timestamp to the signed payload and reject states older than ~10 min; use a dedicated secret.
- **`verifyBotAuth` is dead code** (`src/lib/auth.ts:57`) — an auth path that trusts an `x-bot-token` header equal to the bot token. Nothing uses it; delete it before something does.

---

## 3. 🐛 Correctness bugs

### 3.1 Timezone handling is inconsistent everywhere (the biggest source of subtle wrongness)
You're in Singapore (UTC+8); the app has no timezone concept and mixes three conventions:
- `GET /api/users/me` (daily summary) uses **UTC** day boundaries → your "day" resets at **8am SGT**; breakfast at 7am counts toward yesterday.
- `GET /api/foods` + `/api/analytics/daily` use **server-local** time (`setHours(0,0,0,0)`) — which on Vercel is UTC anyway, but diverges in local dev.
- `src/lib/ai.ts:468`: `new Date().getUTCHours() + 8` **doesn't wrap modulo 24** — from midnight to 8am SGT the value is 24–31, so meal suggestions say "late night" even at 7am. Use `(getUTCHours() + 8) % 24`.
- `src/app/page.tsx:146` filters today's workouts by **UTC** date string while `getGreeting()` uses local time.
- [ ] Add a `timezone` (or fixed `TZ_OFFSET`) to `User`, write one `dayRange(user, date?)` helper in `src/lib/`, and use it in every route. This kills a whole bug class at once.

### 3.2 `fiber` isn't multiplied by servings
`src/app/api/foods/route.ts:72-76`: calories/protein/carbs/fats are multiplied by `servings`, fiber is not. Log 2 servings → fiber for 1.

### 3.3 Dashboard "today's steps" can show yesterday's count
`src/context/UserContext.tsx:59,68`: `api.getSteps(1)` hits `GET /steps?days=1`, whose `startDate = now - 1 day` includes **yesterday**; the context then takes `stepData[0]` (most recent log). If today has no log yet, yesterday's steps display as today's. Fetch by exact date or filter client-side.

### 3.4 Prompt interpolation with `String.replace` mangles `$`
`src/lib/ai.ts` (`TEXT_PROMPT.replace("{text}", text)` etc.): if the user's food description contains `$'`, `$&`, `$$`… JS interprets them as replacement patterns and corrupts the prompt. Use `replace("{text}", () => text)` everywhere (there are ~30 call sites; a small `fill(template, vars)` helper would clean this up).

### 3.5 Telegram HTML injection breaks bot replies
`src/lib/telegram-bot.ts`: `first_name`, AI-generated `food_name`/`notes` are interpolated into `parse_mode: "HTML"` messages unescaped. A name or AI note containing `<` makes the Telegram API reject the message (400) → user sees nothing. Add an `escapeHtml()` helper and wrap every interpolated value.

### 3.6 Bot says "key saved" even when it wasn't
`src/lib/telegram-bot.ts:532`: `updateMany` matches 0 rows if the user never opened the app, but the bot still replies "key saved successfully". Check `result.count`. Also the bot's key regex (`line 511`) accepts only `openai|anthropic|gemini` — **openrouter** is supported by the web app but not the bot (`VALID_PROVIDERS` at `line 11` diverges from `src/lib/models.ts`).

### 3.7 Strava sync `after` cursor mixes local wall-time with UTC epoch
`src/app/api/runs/sync/route.ts:21-23`: `run_date` stores Strava's `start_date_local` (`src/lib/strava.ts:173` — local wall-clock parsed as if UTC), then the sync converts it to an epoch and passes it as Strava's `after` param (true UTC). With SGT that's an 8-hour error window on every incremental sync. Store `start_date` (UTC) for the cursor, or track `last_synced_at` epoch separately. Related: the Strava **list** endpoint doesn't return `calories` on summary activities, so `activity.calories || estimateCalories(...)` (`strava.ts:167`) always uses the 70 kcal/km estimate — fetch activity detail if you want real calories. (`estimateCalories` also ignores its `durationSeconds` param.)

### 3.8 Coach numbers disagree with the dashboard
`/api/users/me` applies `DAMPENING = 0.5` to exercise burn; `cron/daily-coach` and the bot's `/coach` pass **raw** burn to the AI. The coach will praise/criticize a calorie balance the dashboard doesn't show. Extract the budget math into one shared function.

### 3.9 Step streak counts logs, not days
`cron/daily-coach/route.ts:78-82`: iterates step *logs* in date order; a missed day isn't a gap because it simply isn't in the list — streaks survive holes. Walk actual calendar days.

### 3.10 Unvalidated query/body params → 500s
- `GET /workouts?days=abc` and `GET /steps?days=abc`: `parseInt` → NaN → `setDate(NaN)` → Prisma error → 500. (`/analytics/daily` "validates" but `NaN < 1` is false, so NaN passes and returns an empty result.)
- `PUT /users/me/goals` accepts anything: negative goals, strings, arbitrary `sex`/`activity_level` values — Prisma throws, client gets a raw 500.
- `POST /runs` rejects a legit `calories_burned: 0` because of the `!calories_burned` truthiness check, while accepting strings for numbers.
- `POST /steps` with `date: "garbage"` → `new Date("garbage")` → Invalid Date → Prisma 500.
- [ ] Add zod schemas per route (see §5.1 — pairs perfectly with a shared handler wrapper)

### 3.11 Small ones
- `coach.ts:79` comment says "2+ workouts in last 2 days" but code requires `>= 3`.
- `progress.ts:244`: `Math.floor(x / 1)` is a no-op ("1 session ≈ 1 week" — the `stall_weeks` label lies).
- Deleting a workout never recomputes `ProgressSnapshot` — 1RM/stall counters go stale (fine to accept, worth knowing).
- `foods/analyse/route.ts:42`: catch-all returns **422** even for provider outages/timeouts — misleading; 502 fits better.
- `steps` POST silently keeps the higher value — you can never *correct* an over-count. Consider an explicit `force` flag.

---

## 4. 🐢 Performance

### 4.1 N+1 day-by-day queries in analytics
`GET /api/analytics/daily` runs **2 sequential queries per day** — a 30-day view is 60 round-trips through pgbouncer, 90 days is 180. Same pattern in the bot's `/insights`. Fetch the whole range once (`logged_at >= start`) and bucket in JS, or use Prisma `groupBy`.

### 4.2 Missing composite indexes
`food_logs` and `water_logs` only index `user_id`, but *every* query filters `user_id + logged_at` range. `run_logs`/`workout_logs` already do this right. Add `@@index([user_id, logged_at])` to both.

### 4.3 Full-refetch-everything on every mutation
`UserContext.refresh()` fires **8 API calls** after logging one glass of water (each re-verifying HMAC + hitting the DB). This is why logging feels slow. Adopt SWR or React Query: per-key caching, optimistic updates for log/delete, and revalidate only the affected keys. Also `refresh()` swallows errors (`console.error` only) — the UI never knows a refresh failed.

### 4.4 Misc
- `exercise-muscles.ts` (6,776 lines) is imported by a client page (`workouts/prs`) — that map ships in the JS bundle, and it **duplicates** `prisma/seed-data/exercises.json` (two sources of truth for muscle mappings that will drift). Serve it from the DB via the existing `/api/exercises`, or generate one from the other at build time.
- Cron routes loop over all users making sequential AI calls with no `maxDuration` set — you'll hit Vercel's default function timeout as user count grows. Set `export const maxDuration` on AI/cron routes.
- Strava pagination uses `per_page: 30`; the API allows 200 — fewer round-trips on first sync.
- Google Fonts loaded via `<link>` in `layout.tsx` — use `next/font` (removes FOUT + an external request in a Mini App webview).

---

## 5. 🧹 Code quality / architecture

### 5.1 The 37-copies error handler
37 of 45 route files contain the identical catch block that string-matches error messages (`message.includes("hash")` → 401 — any error whose text happens to contain "hash" becomes a 401). This is the single highest-leverage refactor:

```ts
// src/lib/handler.ts
class ApiError extends Error { constructor(public status: number, msg: string) { super(msg) } }

export function withUser(fn: (req: NextRequest, user: User) => Promise<NextResponse>) {
  return async (req: NextRequest) => {
    try { return await fn(req, await getAuthenticatedUser(req)) }
    catch (e) { /* typed ApiError → status; AuthError → 401; else log + 500 */ }
  }
}
```
Throw typed errors from `auth.ts` instead of bare `Error("...")`. Every route body shrinks to its actual logic, and adding zod parsing (§3.10) happens in one place.

### 5.2 AI credential resolution exists in 3 places
`auth.ts:getUserAICredentials`, `cron/daily-coach:getAICredentials`, `cron/weekly-exercise:getAICredentials`, plus `telegram-bot.ts:getUserAI` — four near-identical copies. One canonical function.

### 5.3 `ai.ts` is a 1,000-line grab bag
Prompts + provider plumbing + parsing in one file, and `openaiVision`/`openrouterVision` are byte-identical except `baseURL`. Suggested split: `lib/ai/prompts.ts`, `lib/ai/providers.ts` (one OpenAI-compatible client parameterized by baseURL), `lib/ai/parse.ts`. Also:
- JSON extraction is regex + `JSON.parse` with inconsistent strategies (`parseAnalysisResponse` doesn't do the `match(/\{[\s\S]*\}/)` rescue that others do). Use each provider's native **structured output / JSON mode** and validate with zod — this eliminates the "AI returned prose" failure class.
- `parseAnalysisResult` (`ai.ts:488`) is a pointless one-line wrapper.
- `generateWorkoutAnalysis` returns raw `JSON.parse` output unvalidated (`ai.ts:860`).

### 5.4 Tooling gaps
- **ESLint is not configured** — `eslint` + `eslint-config-next` are installed but there's no `.eslintrc`; `npm run lint` opens the setup wizard. Create `.eslintrc.json` with `"extends": "next/core-web-vitals"`.
- **Zero tests.** Best-value starting set (pure functions, no mocking needed): `tdee.calculateTargets`, `steps.calculateStepAllowance`, `progress.calculateEstimated1RM`/`generateSuggestion`, `crypto` round-trip, `auth.verifyTelegramAuth` (fixture initData), the AI JSON parsers. Vitest makes this a ~1h job.
- **No CI** for the app itself (only the cron workflow). Add a workflow: `npm ci && tsc --noEmit && next lint && vitest run && next build`.
- Add `"typecheck": "tsc --noEmit"` to package.json scripts.
- `.env.local.example` mentions `DIRECT_URL` but `schema.prisma` has no `directUrl` — either wire it up (`directUrl = env("DIRECT_URL")`, needed for `prisma migrate` through Supabase's pooler) or delete the example line.

### 5.5 Dead / inconsistent bits
- `GET /api/cron/weekly-exercise` is fully built but **never scheduled** — `ai-cron.yml` only fires `daily-coach` and `weekly-insights`, and the `workflow_dispatch` choices omit it too. Wire it in or delete it.
- README says water tracking has "configurable bottle size" etc. — README is good, but it documents `SKIP_TELEGRAM_AUTH`/`DEV_USER_ID` without the prod warning (§2).
- `users.created_at` is nullable (`DateTime?`) for no reason.
- `heroku` remote, `fly.toml` explorations, Vercel deploy — pick one deployment story and delete the other artifacts.

---

## 6. 🚀 Future improvements (making it a better project)

**Product**
1. **Timezone-correct days** (§3.1) — biggest real-world accuracy win for a tracker you use daily.
2. **Edit logs** — there's delete but no edit for food/water/runs; typos mean delete-and-relog.
3. **Meal photos stored** — `image_path` columns exist on `FoodLog`/`SavedFood` but nothing writes them; Supabase Storage + thumbnails in history would be a nice weekend feature.
4. **Weight tracking over time** — you store `weight_kg` as a single current value; a `WeightLog` unlocks trend charts and auto-recalculated TDEE.
5. **Strava webhook** instead of manual sync (Strava supports push subscriptions) — runs appear automatically.
6. **Offline/PWA resilience** — Mini App webviews drop connections in gyms; queue failed log posts and retry.

**Engineering**
7. The §5.1 handler + zod refactor — everything else gets easier after it.
8. SWR/React Query + optimistic updates (§4.3) — biggest perceived-speed win.
9. Structured AI outputs + zod (§5.3) — biggest reliability win for the AI features.
10. Vitest + CI (§5.4) — makes all future refactors safe.
11. Consider **Vercel Cron** (`vercel.json` crons) instead of GitHub Actions — one less moving part, same `CRON_SECRET` model (keep the fail-closed fix either way).
12. Rate-limit AI endpoints per user (even a simple daily counter in `CoachState`) — cost protection even after the allowlist.
13. Upgrade path: Next 14 → 15 (gets you `after()` for §1.4), React 19, and Prisma's `relationJoins`/`typedSql` when convenient. Low urgency; do it after tests exist.

---

## Suggested order of attack

| # | Item | Effort | Payoff |
|---|------|--------|--------|
| 1 | Fail-closed cron/webhook auth + allowlist/fallback-key guard (§1.1, §1.2) | ~1h | Stops strangers spending your money |
| 2 | Delete dead dirs, rotate secrets, remove heroku remote (§1.3) | ~30m | Hygiene + real secret exposure |
| 3 | `dayRange()` helper + user timezone (§3.1) | ~2h | Fixes daily numbers you look at every day |
| 4 | `withUser` wrapper + zod (§5.1, §3.10) | ~3h | Deletes ~500 lines, kills the 500-error class |
| 5 | Quick bug batch: fiber×servings, steps(1), `$` in prompts, HTML escape, `await` progress update | ~2h | Five real bugs, all small diffs |
| 6 | ESLint config + Vitest + CI (§5.4) | ~2h | Safety net for everything above |
| 7 | SWR/React Query (§4.3) + analytics groupBy (§4.1) + indexes (§4.2) | ~3h | App feels fast |
