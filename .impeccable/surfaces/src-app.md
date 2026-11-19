---
version: 1
slug: "src-app"
primary_target: "src/app"
related_targets: ["src/components"]
---

# Quadfather Mini App — whole-app overhaul

## Scope and mode
Every route of the Telegram Mini App (`src/app/**`, `src/components/**`), rebuilt in one pass. Mode: Operate. Phone width only, inside Telegram's chrome.

## Audience, job, task
Owner plus a few friends. Main moments: quick log after a meal; morning/evening check-in on the day; reading the AI coach. Primary task on Today: know what's left, then log.

## Confirmed decisions (owner, 2026-11-20)
- Direction: Warm Consumer App (picked on the decision page and in chat).
- Today leads with layout A, refined: "kcal left" hero + protein to go; long lines for calories and protein only; secondary metrics as three different small forms (macro mini-columns with goal cap and over-goal break-through, water bottle pips at the user's bottle size, steps as ten blocks). Approved mock: `.impeccable/mocks/today-lead-a.html`.
- Rings removed everywhere; every goal metric shows under / at / over states.
- Navigation: four tabs (Today, Food, Training, Trends) plus a central Log button opening one log sheet (meal, water, workout, run). Settings moves behind an avatar button in the Today header. One name per destination, used in nav and page title alike.
- Keep the animated gradient date; extend the gradient only where it means something: goal reached (one sweep on that number), a new log landing in the list, AI working (shimmer instead of spinner), date collapsing into a compact header on scroll. Never more than one moving gradient on screen.
- Whole app in one pass, not Today-first.

## Memorable moment
Logging a meal: the sheet closes, the row lands in Today's log with a gradient sweep, and "kcal left" counts down to its new value.

## Unresolved
- Water pip cap for small bottles with large goals (e.g. 330 ml vs 4 L): cap at 8 pips with a numeric remainder, unless the owner prefers otherwise.
- Logo redraw (not binding) is out of scope for this pass.

## Direction contract
THESIS: The friendly consumer-app canon done with real care: one idea per card, plain words, and a single green that only ever means "tap me". Refuses the current template of uppercase micro-labels, tinted-smudge cards, rings, and a fade-up cascade on every block.
OWN-WORLD: Warm ground #F3EEE8, white cards #FFFFFF with 20px radius, 1px hairline rgba(31,42,36,.07) and a barely-there shadow, ink #1F2A24, muted #646B66, action green #2F6B4F reserved for actionable elements only. Muted metric tints (calories clay #CB8C76, protein berry #B4808F, carbs ochre #D6B068, fats sand #C4A285, water slate #86A2BE, steps sage #93A79E), over-goal brick. Figtree throughout, tabular numerals on every figure, about five sizes. Thin-stroke icons drawn as one set. Gradient date in clay, green, ochre, slate.
STORY: Open, see today's date shifting colour, read "940 kcal left · 52 g protein to go" without doing maths, tap Log, choose meal, confirm, and watch it land. Later, Training, Trends and Settings read as the same calm product.
FIRST VIEWPORT: Gradient date (52px Figtree 700) with "Friday · Good evening, Rohan" below and the avatar (Settings) at right of that line. White "Left today" card: 64px kcal-left hero, protein to go right-aligned, full-width green Log a meal button. Calories and protein lines, then the secondary row (macro columns, water pips, step blocks). Today's log card below. Tab bar: Today, Food, centre + Log, Training, Trends.
FORM: Dealt challenger digital-design-canon-warm-consumer-app-surface (verdict competitive; not on the grounded list), chosen over the assigned Seasonal Dial. seed:166faf8d2679e82d
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
