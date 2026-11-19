---
name: Quadfather
description: A warm, calm Telegram Mini App for logging food, water and training and seeing what is left today.
colors:
  ground: "#F3EEE8"
  card: "#FFFFFF"
  ink: "#1F2A24"
  muted: "#646B66"
  line: "rgba(31, 42, 36, 0.07)"
  line-strong: "rgba(31, 42, 36, 0.13)"
  track: "#F1ECE6"
  action: "#2F6B4F"
  action-soft: "rgba(47, 107, 79, 0.11)"
  action-ink: "#FFFFFF"
  over: "#B4432F"
  good: "#2F6B4F"
  m-calories: "#CB8C76"
  m-protein: "#B4808F"
  m-carbs: "#D6B068"
  m-fats: "#C4A285"
  m-fibre: "#A9A47C"
  m-water: "#86A2BE"
  m-steps: "#93A79E"
  gradient-clay: "#C0705A"
  gradient-ochre: "#D9A441"
  gradient-slate: "#5C7FA3"
typography:
  display:
    fontFamily: "Figtree, system-ui, sans-serif"
    fontSize: "52px"
    fontWeight: 700
    lineHeight: 1.04
    letterSpacing: "-0.035em"
  hero-figure:
    fontFamily: "Figtree, system-ui, sans-serif"
    fontSize: "64px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.045em"
    fontFeature: "tnum"
  stat-figure:
    fontFamily: "Figtree, system-ui, sans-serif"
    fontSize: "44px"
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: "-0.03em"
    fontFeature: "tnum"
  headline:
    fontFamily: "Figtree, system-ui, sans-serif"
    fontSize: "30px"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Figtree, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 700
    letterSpacing: "-0.015em"
  card-title:
    fontFamily: "Figtree, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 600
    letterSpacing: "-0.005em"
  body:
    fontFamily: "Figtree, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.45
    fontFeature: "tnum"
  label:
    fontFamily: "Figtree, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 600
  tab-label:
    fontFamily: "Figtree, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 600
rounded:
  bar: "3px"
  column: "4px"
  control: "14px"
  button: "16px"
  card: "20px"
  sheet: "24px"
  pill: "99px"
spacing:
  page-x: "18px"
  page-top: "24px"
  card-y: "18px"
  card-x: "20px"
  stack: "12px"
  group: "22px"
  touch: "44px"
  row: "52px"
components:
  button-primary:
    backgroundColor: "{colors.action}"
    textColor: "{colors.action-ink}"
    typography: "{typography.card-title}"
    rounded: "{rounded.button}"
    padding: "14px 18px"
    height: "52px"
    width: "100%"
  button-secondary:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "12px 16px"
    height: "48px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.muted}"
    rounded: "{rounded.control}"
    padding: "10px 14px"
    height: "44px"
  button-pill:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "8px 14px"
    height: "36px"
  button-pill-active:
    backgroundColor: "{colors.action-soft}"
    textColor: "{colors.action}"
  input-field:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "12px 14px"
    height: "48px"
  card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "18px 20px"
  segmented:
    backgroundColor: "{colors.track}"
    textColor: "{colors.muted}"
    rounded: "{rounded.control}"
    padding: "3px"
  segmented-selected:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "11px"
    height: "36px"
  nav-tab-active:
    backgroundColor: "{colors.action-soft}"
    textColor: "{colors.action}"
    typography: "{typography.tab-label}"
    rounded: "15px"
    size: "54px 30px"
  nav-log-button:
    backgroundColor: "{colors.action}"
    textColor: "{colors.action-ink}"
    rounded: "27px"
    size: "54px"
  sheet:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sheet} {rounded.sheet} 0 0"
    padding: "10px 18px 22px"
---

# Design System: Quadfather

## Overview

**Creative North Star: "The Kind Kitchen Notebook"**

A warm consumer app done with real care. Warm paper ground, white cards that each answer one question, plain sentence-case words, and a single deep green that only ever means "tap me". Numbers are the heroes: big, tabular, set in Figtree at 700 with tight tracking, so "940 kcal left" reads without arithmetic.

Density is phone-native and generous. One column at 390px inside Telegram's chrome, cards stacked 12px apart, rows at least 52px tall. Colour beyond ink and green is reserved for data: muted clay, berry, ochre, sand, olive, slate and sage tints mark progress, never words. The only flourish is a four-stop gradient (clay, green, ochre, slate) that appears in exactly four places and never moves twice at once.

The system rejects the template it replaced: tracked uppercase micro-labels, tinted-smudge cards, progress rings, and a fade-up cascade replaying on every block.

**Key Characteristics:**
- Warm ground, white 20px cards, hairline borders, a barely-there shadow.
- One action green; metric tints for data marks only.
- Figtree throughout, tabular numerals on every figure.
- Goals read as under / at / over, never as rings.
- One page entrance per navigation; one moving gradient at a time.
- Thin-stroke icons drawn as one set (24px grid, 1.7 stroke, round caps).

## Colors

A warm neutral world with one functional accent and a quiet family of data tints.

### Primary
- **Field Green** (`action`): every tappable thing and nothing else. Primary buttons, the centre Log button, active tab pill and label, text links ("See all", "Add a key"), the selected check in a radio row, focus rings, caret and text selection. `action-soft` (11% green) is its resting fill for pressed pills, active tabs and the Today avatar.
- **At-goal Green** (`good`): the same hex as Field Green, used only for the short "· done" word or check icon beside a goal that was just reached. Never a fill, never a block of text.

### Secondary
- **Brick** (`over`): over-goal state for metrics where exceeding is bad (calories, carbs, fats). Turns the bar, the column and the figure brick and adds "N over". Also the "Over today" hero figure.

### Tertiary (data tints)
- **Clay** (`m-calories`), **Berry** (`m-protein`), **Ochre** (`m-carbs`), **Sand** (`m-fats`), **Olive** (`m-fibre`), **Slate** (`m-water`), **Sage** (`m-steps`): progress fills, water pips, step blocks, chart bars. Too light to read as text by design.
- **Gradient stops** (`gradient-clay`, `action`, `gradient-ochre`, `gradient-slate`): only inside the four gradient moments below. The muscle heatmap uses its own clay-to-rust intensity ramp, a data mark under the same rule.

### Neutral
- **Warm Paper** (`ground`): page and sheet background; also written into Telegram's header and background colour so native chrome matches.
- **White Card** (`card`): every content surface.
- **Pine Ink** (`ink`): all primary text and hero numbers; also the toast pill.
- **Stone** (`muted`): secondary text, captions, group titles, inactive icons and tabs. 4.7:1 on ground, 5.4:1 on white.
- **Hairline** (`line`) and **Hairline Strong** (`line-strong`): card borders and row dividers; control borders and the sheet grabber.
- **Track** (`track`): empty part of every bar, column, pip and block; segmented-control well; ghost-button press.

### Named Rules
**The Green Means Tap Rule.** Field Green appears only on something the user can press. If it is not interactive, it is ink, stone, a data tint, or brick. The single exception is the at-goal "done" word and check.

**The Tints Are Marks Rule.** Metric tints colour bars, pips, blocks and chart marks only. Labels and values beside them stay ink or stone.

**The Fixed Palette Rule.** The app ships its own palette and overrides Telegram's `--tg-theme-*` variables; it does not follow the client's theme.

## Typography

**Display Font:** Figtree (with system-ui, sans-serif), weights 400–800 from Google Fonts
**Body Font:** Figtree (same family)

**Character:** One friendly geometric-humanist sans for everything; hierarchy comes from size, weight and tight negative tracking on large figures. `font-variant-numeric: tabular-nums` is set on `body`, so every figure aligns.

### Hierarchy
- **Display** (700, 52px, 1.04, -0.035em): the Today date only, with the drifting gradient. Collapses to 18px/700 in the compact header on scroll.
- **Hero figure** (700, 64px, 1, -0.045em): the one number a screen exists for ("kcal left"). Screen-level hero figures on other pages sit at 48–60px with -0.03em.
- **Stat figure** (700, 44px, 1.05, -0.03em): secondary big numbers (meal kcal, workouts this week, water added). Supporting stats at 22–28px/700.
- **Headline** (700, 30px, 1.1, -0.025em): page titles via the one PageHeader.
- **Title** (700, 20px, -0.015em): sheet titles.
- **Card title** (600, 16px, -0.005em): card headings; also the primary-button label.
- **Body** (400, 15px, 1.45): default text, rows, values. Inputs at 16px to avoid iOS zoom.
- **Label** (600, 13px, sentence case, no tracking, stone): field labels, settings and log-sheet group titles, metric captions.
- **Tab label** (600, 12px): bottom navigation only.

### Named Rules
**The Sentence Case Rule.** No uppercase, no letter-spaced micro-labels, no eyebrow above a title. A group title is 13px/600 stone in sentence case.

**The Tabular Rule.** Every figure is tabular. Units ("kcal", "g", "L") sit beside the number in stone at a smaller size.

## Layout

A single phone column inside Telegram. `main` pads 24px top, 18px sides, and `96px + safe-area-inset-bottom` at the bottom to clear the nav; `viewport-fit=cover` is required for that inset. Cards stack with 12px gaps on Today and 22px between settings groups. Card interiors pad 18px by 20px; list cards drop to 0 padding and let 52–54px rows carry 16–18px side padding with hairline dividers (inset 54px past the icon in settings). Touch targets are at least 44px; inline links extend their hit area with negative margins rather than growing visually.

Today's first viewport: gradient date, weekday and greeting with the avatar right, the "Left today" card (hero kcal, protein to go, full-width Log a meal), the totals card (two long lines, then macro columns, water pips, step blocks), then Today's log.

Navigation is four tabs plus Log: Today, Food, centre Log, Training, Trends, on a `1fr 1fr 76px 1fr 1fr` grid, 68px tall plus safe area, frosted ground (`rgba(251,248,244,.94)` with 18px blur). Settings is not a tab; it sits behind the avatar in the Today header. Water lives under Food; Runs under Training. One name per destination in nav and page title alike.

Telegram native back: PageHeader and Sheet register handlers on a shared stack (`useTelegramBack().attach`), so back closes the top sheet first, then leaves the page; the button hides when the stack empties. Outside Telegram a muted "‹ Label" link renders instead. The SDK (`@twa-dev/sdk`) touches `window` at import, so it lives only in the client-only `TelegramProvider` (loaded `ssr: false`); pages import hooks from `src/components/telegram.ts`, never the SDK.

## Elevation & Depth

Mostly flat with tonal layering: white on warm paper, defined by a hairline more than a shadow. Shadows appear only on the things that float.

### Shadow Vocabulary
- **Card** (`0 1px 3px rgba(31,42,36,.04)`): every card; nearly invisible.
- **Raised** (`0 8px 24px -8px rgba(31,42,36,.22)`): floating surfaces.
- **Primary button** (`0 2px 6px rgba(47,107,79,.18)`): green-tinted lift on the primary action; removed when disabled.
- **Log button** (`0 6px 16px -6px rgba(47,107,79,.6)`): the centre nav button.
- **Sheet** (`0 -12px 40px -12px rgba(31,42,36,.3)`) over a `rgba(31,42,36,.32)` scrim.
- **Segmented selected** (`0 1px 3px rgba(31,42,36,.1)`).

### Named Rules
**The Hairline First Rule.** Cards separate from the ground by a 1px `line` border; shadow is a whisper, never a drop.

## Shapes

Soft, friendly rounding scaled to element size: 20px cards, 16px primary button and textarea, 14px controls and inputs, 24px sheet top corners, full pills for chips and the Log button, 3–5px on data marks (bars 3px, macro columns 4px, water pips 5px). Bars are 6px tall; macro columns 12×44px with a 1.5px stone goal rule on top; step blocks are a 5×2 grid of 12×19px tiles.

## Components

### Buttons
- **Shape:** gently rounded (16px primary, 14px others, full pill for chips).
- **Primary:** Field Green fill, white 16px/600 label, full width, 52px min height, optional leading icon.
- **Secondary:** white with `line-strong` border, ink 15px/600, 48px; hover to ground.
- **Ghost:** transparent, stone text, 44px; press to track.
- **Pill:** white with border, 36px; active state is `action-soft` fill with green text.
- **Press:** every button scales to 0.98 on active; disabled drops to 40% opacity.

### Chips / Segmented
- **Segmented:** one control app-wide. Track well (3px padding, 14px radius); the selected option is a white 11px-radius tab with ink text and a soft shadow; others stone. Radio-group semantics, arrow keys move.

### Cards / Containers
- **Corner Style:** 20px.
- **Background:** white on ground.
- **Shadow Strategy:** Card shadow (see Elevation).
- **Border:** 1px `line`.
- **Internal Padding:** 18px by 20px; list cards 0 with full-width rows.
- **Card title:** 16px/600 with an optional right-aligned green link.

### Inputs / Fields
- **Style:** white, 1px `line-strong`, 14px radius (16px for textareas), 48px, 16px text, stone placeholder. Labels above in 13px/600 stone.
- **Focus:** border turns green with a 3px `rgba(47,107,79,.16)` ring. Global `:focus-visible` is a 2px green outline, 2px offset.

### Navigation
- **Tabs:** 22px icon in a 54×30 pill, 12px/600 label beneath. Active: green icon and label on `action-soft` pill, `aria-current="page"`. Inactive: stone, no pill.
- **Log:** 54px green circle with a white plus, centred; opens the Log sheet (Meal, Water, Training groups).

### Progress Line (signature)
Label left in 15px ink; value 16px/600 ink then "/ goal unit" in stone right. A 6px track below fills with the metric tint. **Under:** tint fill. **At** (within 3% of goal, or past it for protein, fibre, water, steps): fill full, value plays one gradient sweep, "· done" in at-goal green. **Over** (calories, carbs, fats only): bar, value and "N over" turn brick.

### Metric Minis (signature)
Three different forms so the secondary row never repeats one graphic: macro columns with a goal cap that the fill breaks through in brick when over; water pips, one per bottle at the user's bottle size (capped at 8); steps as ten blocks, one per tenth of the goal. Caption beneath in 13px stone with the value in ink 600.

### Bottom Sheet
Ground-coloured panel, 24px top corners, 36×4 grabber, 20px/700 title with a 44px close button, max 88svh. Slides up over a scrim; closes on scrim tap, Escape, close, or Telegram back; returns focus to the opener.

### Gradient Moments (signature)
The gradient is meaning, not decoration, and appears in exactly four places:
1. **The date:** Today's date drifts (18s alternate); it moves to the compact header on scroll.
2. **Goal reached:** the number plays one 1.6s sweep that ends in ink. Fires only when a goal flips during the session, never on first render.
3. **Log landed:** the new row gets a 1.8s multiply wash that fades out.
4. **AI working:** a shimmer bar in place of a spinner.

**The One Moving Gradient Rule.** Never more than one gradient moves at a time. The date pauses (`body:has(.gradient-sweep, .row-landed, .ai-shimmer)`) while any other moment plays, and goal sweeps share one queue: each waits 1.9s for the landing wash, then for any earlier sweep, so a log that crosses calories and protein lights them in turn.

### Motion
One page entrance per navigation (0.32s fade-rise of 6px via `top`, never `transform`, so fixed children stay pinned). Easing `cubic-bezier(0.16,1,0.3,1)` for entrances and fills, no overshoot anywhere. Under reduced motion, loops stop, one-shots resolve to their end state, and spinners slow rather than stop.

## Do's and Don'ts

### Do:
- **Do** keep Field Green (#2F6B4F) on tappable elements only; the at-goal "done" word and check are the one exception.
- **Do** colour data marks with the metric tints and keep their labels ink or stone.
- **Do** show every goal metric as under / at / over, with brick only where over is bad.
- **Do** lead each screen with one tabular hero figure and plain sentence-case words.
- **Do** use PageHeader for every page title, and give sub-pages a `back` so Telegram's native button appears.
- **Do** import Telegram hooks from `src/components/telegram.ts` and keep the SDK inside the client-only provider.
- **Do** route new gradient motion through the four moments and the shared sweep queue.
- **Do** draw new icons on the 24px, 1.7-stroke, round-cap grid in `icons.tsx`.

### Don't:
- **Don't** use uppercase or letter-spaced micro-labels, or put an eyebrow above a title.
- **Don't** draw progress rings; use lines, columns, pips or blocks.
- **Don't** add a per-block fade-up cascade; the page entrance plays once in `template.tsx`.
- **Don't** let two gradients move at once, or add a fifth gradient moment.
- **Don't** use metric tints for text.
- **Don't** add a fifth tab or put Settings in the nav.
- **Don't** import `@twa-dev/sdk` from a page or any module rendered during prerender.
- **Don't** animate `transform` on a page wrapper; it re-parents fixed sheets and docks.
