# Quadfather

A personal nutrition and hydration tracker built as a Telegram Mini App.

## Features

- **Meal logging** — scan a photo, describe in text, or enter macros manually
- **AI-powered analysis** — estimates calories, protein, carbs, and fats from photos or text descriptions
- **AI meal suggestions** — get meal ideas that fit your remaining daily calorie and protein budget
- **Bring Your Own Key** — use your own OpenAI, Anthropic, or Gemini API key (encrypted at rest)
- **Water tracking** — configurable bottle size with one-tap logging
- **Daily goals** — set targets for calories, protein, and water intake
- **Analytics** — 7-day and 30-day trend charts for nutrition and hydration
- **Saved foods** — save frequently eaten meals for quick re-logging
- **Telegram bot** — check your daily summary, log meals, and get AI photo analysis directly in chat

## Tech Stack

- **Frontend**: Next.js 14 (App Router), React 18, Tailwind CSS
- **Backend**: Next.js API Route Handlers (no separate server)
- **Database**: PostgreSQL on Supabase, Prisma ORM
- **AI**: OpenAI GPT-4o-mini / Anthropic Claude Sonnet / Gemini 2.5 Flash (user's choice via BYOK)
- **Bot**: grammY (Telegram Bot API)
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
DATABASE_URL=          # Supabase PostgreSQL connection pooler URL
BOTFATHER_TOKEN=       # Telegram bot token from @BotFather
ENCRYPTION_KEY=        # 32-byte hex string for encrypting user API keys
WEBHOOK_URL=           # Your deployment URL (for Telegram webhook)
WEBHOOK_SECRET=        # Random secret string for webhook auth
MINI_APP_URL=          # Your deployment URL (for bot inline buttons)
SKIP_TELEGRAM_AUTH=    # Set to "true" for local dev
DEV_USER_ID=           # Your Telegram user ID for local dev
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
