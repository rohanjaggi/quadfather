# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The owner plus a small circle of friends, each opening it from the Quadfather Telegram bot on their phone. Nobody is marketed to; nobody arrives cold. Users already care about training and eating well and log most days.

## Product Purpose

A personal nutrition, hydration and training log that turns daily logging into a ritual worth keeping. It answers "how is today going, and what's left?" in a glance, makes logging a meal near-effortless (photo, text, or manual), and adds AI coaching on top of the user's own data. Success is a habit: people keep opening it after meals and at the start or end of the day because it feels good to use, not because they have to.

## Positioning

One private place for food, water, steps, lifts and runs, living inside Telegram next to the conversations people already have, with AI estimates and coaching from the model and key each user chooses. It is a personal tool for a small circle, not a mass-market fitness platform.

## Operating Context

- Opened only inside Telegram as a Mini App: phone width, Telegram's own header and safe areas, launched from bot buttons or the menu. No standalone browser use, no web login.
- Main moments of use, in order of frequency: a quick log right after a meal (snap or describe, confirm, see what's left); a slower morning or evening check-in on the day and week; reading the daily coach tip and weekly insights (also delivered in the bot chat).
- Secondary: logging sets mid-gym-session, reviewing runs synced from Strava, steps arriving via an Apple Shortcut.

## Capabilities and Constraints

- Meal logging by photo, text or manual macros, with AI estimates (calories, protein, carbs, fats, fibre) and saved foods.
- Water logging with a configurable bottle; steps with goal and extra calorie allowance; daily goals for every metric.
- Workout templates, set/rep/weight logging, AI progression predictions, PRs, muscle map and imbalance flags, weekly training recap.
- Runs: manual, photo, or Strava sync, with AI analysis and running PRs.
- Analytics: 7- and 30-day trends; AI daily coach and weekly insights.
- Settings: personal stats/onboarding, goals, coaching, Strava, steps sync, bring-your-own AI key.
- Stack: Next.js 14 App Router on Vercel, Prisma/Supabase, grammY bot. Telegram WebApp APIs (haptics, BackButton, MainButton, header/background colour) are available and preferred over generic web patterns.
- Auth failure UX is "open from Telegram" plus retry, never a browser login.

## Brand Commitments

- The name **Quadfather** stays.
- The current Q-with-fork logo (`public/logo.png`) is not binding and may be redrawn.
- The owner wants to keep the animated, slowly shifting gradient on the dashboard date, and is open to extending that idea elsewhere where it stays tasteful.
- Desired register (owner's words): upscale, tasteful, a lifestyle app that sells a way of living, with smooth transitions.

## Evidence on Hand

Real personal logging data in the owner's database (meals, water, steps, workouts, runs). No testimonials, user counts, press or marketing claims exist; none should be invented.

## Product Principles

1. Logging a meal should be the shortest path in the app.
2. Today first: the day's state reads at a glance before any detail.
3. Coaching is earned from the user's own data, never generic advice.
4. Feel like a ritual, not a spreadsheet: calm, considered, rewarding to return to.
5. Native to Telegram: respect its chrome, gestures and haptics rather than fighting them.
