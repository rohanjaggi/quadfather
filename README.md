# Quadfather

A personal nutrition, hydration, and fitness tracker built as a Telegram Mini App.

## Features

- **Meal logging** — scan a photo, describe in text, or enter macros manually
- **AI-powered analysis** — estimates calories, protein, carbs, fats, and fiber from photos or text descriptions
- **AI meal suggestions** — get meal ideas that fit your remaining daily macro budget
- **Bring Your Own Key** — use your own OpenAI, Anthropic, or Gemini API key (encrypted at rest)
- **Water tracking** — configurable bottle size with one-tap logging
- **Daily goals** — set targets for calories, protein, carbs, fats, fiber, and water
- **Running & activity tracking** — log runs, cycling, and hikes manually or sync from Strava
- **Strava integration** — connect your Strava account to auto-sync activities and add exercise calories to your daily allowance
- **Analytics** — 7-day and 30-day trend charts for nutrition and hydration
- **Saved foods** — save frequently eaten meals for quick re-logging
- **Onboarding** — guided setup for personal stats (sex, weight, height, age, activity level, fitness goal) to calculate recommended macros
- **Profile management** — update personal info, goals, API key, and Strava connection
- **Telegram bot** — check your daily summary, log meals, and get AI photo analysis directly in chat

## Tech Stack

- **Frontend**: Next.js 14 (App Router), React 18, Tailwind CSS
- **Backend**: Next.js API Route Handlers (no separate server)
- **Database**: PostgreSQL on Supabase, Prisma ORM
- **AI**: OpenAI GPT-5.4 Mini / Anthropic Claude 4.5 Haiku / Gemini 3.1 Flash Lite / OpenRouter (user's choice via BYOK)
- **Bot**: grammY (Telegram Bot API)
- **Integrations**: Strava API (activity sync)
- **Deployment**: Vercel

## Setup

```bash
npm install
cp .env.local.example .env.local
# Fill in your env vars (see below)
npx prisma generate
npm run dev
```

## Environment Variables

```
DATABASE_URL=            # Supabase PostgreSQL connection pooler URL
BOTFATHER_TOKEN=         # Telegram bot token from @BotFather
ENCRYPTION_KEY=          # 32-byte hex string for encrypting user API keys
WEBHOOK_URL=             # Your deployment URL (for Telegram webhook)
WEBHOOK_SECRET=          # Random secret string for webhook auth
MINI_APP_URL=            # Your deployment URL (for bot inline buttons)
STRAVA_CLIENT_ID=        # Strava API application client ID
STRAVA_CLIENT_SECRET=    # Strava API application client secret
STRAVA_REDIRECT_URI=     # OAuth callback URL for Strava
GEMINI_API_KEY=          # (Optional) Server-side Gemini key — fallback when user has no BYOK key
OPENROUTER_API_KEY=      # (Optional) Server-side OpenRouter key — second fallback after Gemini
SKIP_TELEGRAM_AUTH=      # Set to "true" for local dev
DEV_USER_ID=             # Your Telegram user ID for local dev
```

## Telegram Bot Commands

| Command | Description |
|---------|-------------|
| `/start` | Welcome message and intro |
| `/today` | Today's calorie, protein, and water summary |
| `/log` | Open the meal logger |
| `/water` | Open the water tracker |
| `/trends` | View progress charts |
| `/goals` | Update daily targets |
| `/key` | Set or update your AI API key |
| `/help` | Show all commands |

You can also send a photo of your meal directly in chat for AI macro analysis.
