# Quadfather

A personal nutrition, hydration, and fitness tracker built as a Telegram Mini App.

## Features

- **Meal logging** — scan a photo, describe in text, or enter macros manually
- **AI-powered analysis** — estimates calories, protein, carbs, fats, and fiber from photos or text descriptions with confidence levels and portion assumptions
- **AI meal suggestions** — get meal ideas that fit your remaining daily macro budget
- **AI coaching** — daily coaching tips and weekly pattern insights based on your logged data
- **Model selection** — choose your preferred model per provider (GPT-5.4 Mini, Claude 4.5 Haiku, Gemini 3 Flash, etc.)
- **Bring Your Own Key** — use your own OpenAI, Anthropic, Gemini, or OpenRouter API key (encrypted at rest)
- **Water tracking** — configurable bottle size with one-tap logging and custom amounts
- **Step counting** — log daily steps via Apple Shortcuts integration with goal tracking and extra calorie allowance
- **Workout logging** — create workout templates, log sessions with exercises, sets, reps, and weight
- **Progression prediction** — AI predicts the next session's sets, reps, and weight per exercise from your history, with a rule-based fallback
- **Personal records** — automatic PR tracking for lifts (heaviest set, estimated 1RM) and runs (fastest pace, longest run, fastest 5K/10K)
- **Muscle map** — visualises which muscle groups recent sessions hit, and flags imbalances
- **Weekly training digest** — a weekly workout recap delivered in the bot alongside the nutrition insights
- **Running & activity tracking** — log runs with AI analysis of pace, splits, and performance
- **Strava sync** — connect Strava over OAuth and import your runs (tokens encrypted at rest)
- **Daily goals** — set targets for calories, protein, carbs, fats, fiber, water, and steps
- **Analytics** — 7-day and 30-day trend charts for nutrition and hydration
- **Food history** — view and browse previously logged meals
- **Saved foods** — save frequently eaten meals for quick re-logging
- **Dietary restrictions** — set restrictions that AI respects when suggesting meals
- **Onboarding** — guided setup for personal stats (sex, weight, height, age, activity level, fitness goal) to calculate recommended macros
- **Profile management** — update personal info, goals, and API key
- **Telegram bot** — check your daily summary, log meals, get AI coaching and insights directly in chat

## Tech Stack

- **Frontend**: Next.js 14 (App Router), React 18, Tailwind CSS
- **Backend**: Next.js API Route Handlers (no separate server)
- **Database**: PostgreSQL on Supabase, Prisma ORM
- **AI**: OpenAI GPT-5.4 Mini / Anthropic Claude 4.5 Haiku / Gemini 3 Flash / OpenRouter (user's choice via BYOK)
- **Bot**: grammY (Telegram Bot API)
- **Integrations**: Strava (OAuth run import), Apple Shortcuts (step counting)
- **Deployment**: Vercel, with the AI digests triggered by a GitHub Actions cron
- **Scheduled jobs**: `.github/workflows/ai-cron.yml` calls `/api/cron/*` (daily coach, weekly insights, weekly training digest)

## Setup

```bash
npm install                # `postinstall` runs `prisma generate` automatically
cp .env.local.example .env.local
# Fill in your env vars (see below)
npx prisma migrate deploy  # apply prisma/migrations to your database
npm run seed               # load the exercise catalogue
npm run dev
```

## Environment Variables

```
DATABASE_URL=            # Supabase PostgreSQL connection pooler URL
BOTFATHER_TOKEN=         # Telegram bot token from @BotFather; also the initData HMAC secret
ENCRYPTION_KEY=          # 32-byte hex — encrypts AI/Strava keys, signs the Strava OAuth state
WEBHOOK_URL=             # Your deployment URL (for the Telegram webhook)
WEBHOOK_SECRET=          # Random string; the secret path segment /api/webhook/<secret>
MINI_APP_URL=            # Your deployment URL (bot inline buttons; unset = buttons omitted)
CRON_SECRET=             # Bearer secret for /api/cron/*; unset = the cron routes refuse to run
GEMINI_API_KEY=          # (Optional) Server-side Gemini key — fallback when user has no BYOK key
OPENROUTER_API_KEY=      # (Optional) Server-side OpenRouter key — second fallback after Gemini
STRAVA_CLIENT_ID=        # (Optional) Strava API application client ID
STRAVA_CLIENT_SECRET=    # (Optional) Strava API application client secret
STRAVA_REDIRECT_URI=     # (Optional) <deployment>/api/strava/callback
SKIP_TELEGRAM_AUTH=      # Local dev only — set to "true" to bypass initData verification
DEV_USER_ID=             # Your Telegram user ID for local dev
```

That is every variable you set yourself, and `.env.local.example` mirrors it.
Two things live outside the list:

- **`NODE_ENV`** is read in `src/lib/prisma.ts` (to decide whether to cache the
  Prisma client on `globalThis`), but Next.js sets it for you — don't set it by
  hand.
- **GitHub Actions secrets.** The AI digests are triggered by
  `.github/workflows/ai-cron.yml`, not by Vercel cron, so the repository needs
  its own secrets: `CRON_SECRET` (the *same* value as in Vercel — the workflow
  sends it as the bearer token) and `APP_URL` (your deployment origin, e.g.
  `https://your-app.vercel.app`). `APP_URL` is only ever a GitHub Actions
  secret; the app never reads it.

## Telegram Bot Commands

| Command | Description |
|---------|-------------|
| `/start` | Welcome message and intro |
| `/today` | Today's calorie, protein, and water summary |
| `/log` | Open the meal logger |
| `/log_meal` | Log a meal from text description |
| `/log_water` | Log one bottle of water instantly |
| `/water` | Open the water tracker |
| `/trends` | View your progress charts |
| `/goals` | Update your daily goals |
| `/coach` | Get today's AI coaching tip |
| `/insights` | Get AI weekly pattern analysis |
| `/key` | Set up your AI API key |
| `/help` | Show all commands |

You can also send a photo of your meal directly in chat for AI macro analysis.

## Related

- [quadfather-experiments](https://github.com/rohanjaggi/quadfather-experiments) — prompt experiments for AI meal analysis and coaching
