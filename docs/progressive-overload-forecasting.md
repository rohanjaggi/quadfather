# Progressive Overload Forecasting

## Part 1: Full Spec (Future — ML Model)

### Goal

Replace the rule-based progression engine (`generateSuggestion()` in `src/lib/progress.ts`) with a learned model that predicts the next session's working weight and reps per exercise, personalized to the user's training history, recovery patterns, and goals.

### Why This Matters (Resume Signal)

- Time-series forecasting on real personal data with a closed feedback loop
- Feature engineering from structured lifting logs (volume, frequency, fatigue, deload history)
- Model comparison pipeline (linear regression vs gradient boosting vs LSTM)
- Demonstrable backtest: "model predicted X, I actually lifted Y, MAE = Z"

### Data Available

| Source | Fields | Granularity |
|--------|--------|-------------|
| `ExerciseLog` | exercise_name, sets (reps × weight_kg), order | Per exercise per session |
| `ProgressSnapshot` | estimated_1rm, best_set_weight, best_set_reps, total_volume_7d, sessions_since_improvement, last_improved_at | Per exercise, updated post-workout |
| `WorkoutLog` | workout_date, duration_minutes, template_id, name | Per session |
| `User` | training_focus, fitness_goal, weight_kg | Static profile |

### Feature Engineering

For each (user, exercise, session) prediction point:

| Feature | Derivation |
|---------|-----------|
| `rolling_volume_7d` | Sum of (reps × weight) across all sets for this exercise in past 7 days |
| `rolling_volume_14d` | Same, 14-day window |
| `rolling_volume_28d` | Same, 28-day window |
| `days_since_last_session` | Calendar days since last session containing this exercise |
| `sessions_since_improvement` | From ProgressSnapshot — stall counter |
| `estimated_1rm_current` | Best Epley 1RM (`weight × (1 + reps/30)`) from most recent session |
| `estimated_1rm_delta_4w` | 1RM now minus 1RM 4 weeks ago |
| `avg_reps_last_3` | Mean reps across last 3 sessions for this exercise |
| `avg_weight_last_3` | Mean working weight across last 3 sessions |
| `total_weekly_sessions` | Number of workouts in last 7 days (fatigue proxy) |
| `deload_recency` | Sessions since last deload (volume drop >20%) |
| `body_weight_kg` | User's current body weight |
| `body_weight_delta_4w` | Weight change over 4 weeks (bulk/cut signal) |
| `training_focus_encoded` | One-hot: strength / hypertrophy / null |

### Target Variable

Primary: `next_session_weight_kg` (the working weight the user actually used next time)

Secondary: `next_session_reps` (the reps achieved at that weight)

Combined metric for evaluation: predicted estimated 1RM vs actual estimated 1RM.

### Model Candidates

| Model | Rationale | Min Data |
|-------|-----------|----------|
| Ridge Regression | Baseline, interpretable, works on tiny data | 20 sessions/exercise |
| XGBoost | Handles non-linearities, feature importance for free | 50 sessions/exercise |
| Simple LSTM (single-layer, 8-unit) | Captures sequential patterns if enough history | 100+ sessions/exercise |

Start with XGBoost. Compare all three once data permits.

### Evaluation Protocol

- Hold out most recent 20% of sessions per exercise (temporal split, no leakage)
- Metrics: MAE on predicted weight, MAE on predicted 1RM, directional accuracy (did we predict up/down/same correctly?)
- Baseline comparison: current rule-based system (+2.5kg always) as a naive predictor
- Report: per-exercise breakdown + aggregate

### Deployment

- Inference runs at workout-start time when user opens the logging form
- Per-exercise prediction shown in `ExerciseSuggestion` component (replaces `generateSuggestion()`)
- Model stored as serialized artifact (ONNX for XGBoost, or TF Lite for LSTM)
- Retrain weekly on latest data (cron job)
- Fallback: if model confidence < threshold or insufficient data, fall back to AI-prompt approach (v0)

### Data Collection Requirements

Before this can be built:
- Minimum ~50 logged sessions with consistent exercise naming
- Body weight tracking integrated (currently optional)
- Ideally: sleep/recovery signals (future integration with Apple Health or Oura)

---

## Part 2: v0 Implementation (Now — AI-Prompt Placeholder)

### Goal

Replace the deterministic rule-based progression (`+2.5kg strength / rep pyramid hypertrophy / deload at 6 stalls`) with an LLM-powered prediction. Feed the user's exercise history + fitness goal into a prompt and return a predicted next-session prescription (weight × reps × sets).

This prediction appears as a **text hint** below the exercise name (same UX pattern as today) — but with richer, context-aware content instead of a static "+2.5kg" rule.

### What Changes

| Current | v0 |
|---------|-----|
| `generateSuggestion()` returns a text hint ("Try 82.5kg") | AI returns structured prediction with reasoning |
| Hint shown as text below exercise name | Same position — richer, context-aware hint text |
| Rule-based: always +2.5kg or +1 rep | Context-aware: considers volume trends, stall duration, goal, recent performance trajectory |
| Instant (pure computation) | Async (LLM call, ~1-2s) |

### Architecture

```
User opens WorkoutForm
  → For each exercise with name.length >= 3:
    → Client calls GET /api/workouts/predict?exercise_name={name}
    → Server fetches:
        - Last 8 sessions of this exercise (sets/reps/weight + dates)
        - ProgressSnapshot (1RM, stall counter, volume_7d)
        - User's fitness_goal + training_focus + weight_kg
    → Server builds prompt with this context
    → LLM returns JSON: {sets: [{reps: number, weight_kg: number}], reasoning: string}
    → Client receives prediction
    → Set inputs show predicted values as placeholders (gray text)
    → User can accept (just submit) or override (type their own numbers)
```

### API Endpoint

```
GET /api/workouts/predict?exercise_name=Bench+Press
```

Response:
```json
{
  "prediction": {
    "sets": [
      {"reps": 8, "weight_kg": 82.5},
      {"reps": 8, "weight_kg": 82.5},
      {"reps": 7, "weight_kg": 82.5},
      {"reps": 6, "weight_kg": 82.5}
    ],
    "reasoning": "You've hit 80kg×8 for 3 consecutive sessions with stable volume. Ready for +2.5kg with a slight rep drop on later sets."
  },
  "confidence": "high" | "medium" | "low",
  "fallback_used": false
}
```

### Prompt Design

```
You are a strength coach predicting the next training session for one exercise.

Exercise: {exercise_name}
User's goal: {fitness_goal}
Training focus: {training_focus}
Body weight: {weight_kg}kg

Recent history (most recent first):
{history}

Current stats:
- Estimated 1RM: {estimated_1rm}kg
- Best set: {best_set_weight}kg × {best_set_reps}
- Sessions since improvement: {sessions_since_improvement}
- 7-day volume: {total_volume_7d}kg

Predict the EXACT sets, reps, and weight for the next session.
Consider:
- Progressive overload appropriate to the goal
- Fatigue accumulation (volume trends, session frequency)
- Stall patterns (when to back off vs push through)
- Rep ranges appropriate to the training focus (strength: 3-6, hypertrophy: 8-12)

Return ONLY valid JSON:
{
  "sets": [{"reps": <number>, "weight_kg": <number>}],
  "reasoning": "<one sentence explaining your prediction>"
}
```

The `{history}` block is formatted as:
```
2024-03-10: 4×8 @ 80kg (est 1RM: 101.3kg)
2024-03-07: 4×8 @ 80kg (est 1RM: 101.3kg)
2024-03-03: 4×7 @ 80kg (est 1RM: 98.7kg)
...
```

### UI Changes

**ExerciseSuggestion component** — updated:
- Fetches from `/api/workouts/predict`. (This replaced an earlier
  `/api/workouts/progress` route, which no longer exists — nothing should call
  it.)
- Displays the AI's prediction as a text hint (same visual style as today):
  - Line 1: "Last: 4×8 @ 80kg (Mar 10)" (unchanged)
  - Line 2: "↑ Try 4×8 @ 82.5kg" (predicted sets summarized)
  - Line 3 (small, hint color): the `reasoning` field ("Ready for +2.5kg — stable volume across 3 sessions")
- Confidence indicator: green bg for high, yellow for medium, no hint shown for low
- Loading state: show existing "Last session" line immediately, shimmer on prediction line

**WorkoutForm component** — no changes needed (hint stays as a read-only display below the exercise name)

### Fallback Behavior

- If AI call fails or times out (>3s): fall back to current `generateSuggestion()` logic, show as text hint (current behavior)
- If exercise is new (no history): return `{prediction: null, confidence: "low", fallback_used: true}`, no hint shown
- If user has `pre_workout_suggestions` disabled in coaching prefs: skip entirely

### Performance Considerations

- Debounce: 800ms after exercise name stabilizes (same as current, slightly longer)
- Cache: store predictions in session memory (React state) — don't re-fetch if user navigates back to same exercise
- Parallel: fetch predictions for all exercises simultaneously when form loads from template
- Cancel: abort in-flight requests if exercise name changes

### What Gets Removed

- `generateSuggestion()` function — no longer called from the prediction path (keep for fallback)
- The static progression rules (+2.5kg, +1 rep, deload at 6) stop being the primary suggestion
- The current simple one-line hint is replaced by a richer multi-line hint (predicted sets + reasoning)

### Migration Path to Full ML Model (Part 1)

When sufficient data exists:
1. The `/api/workouts/predict` endpoint becomes the integration point
2. Swap the LLM call for model inference — same response shape
3. Keep LLM as fallback for exercises with <50 sessions of history
4. Add model confidence score; below threshold → fall back to LLM
5. The UI doesn't change at all — it just consumes the same prediction JSON

### Metrics to Track (for future backtest)

After each workout is logged, compare:
- Predicted weight vs actual weight (per set)
- Predicted reps vs actual reps (per set)
- Store as a new field on `ExerciseLog`: `predicted_sets` (JSON, nullable)

> **Not implemented.** There is no `predicted_sets` column on `ExerciseLog` and
> nothing writes one, so no backtest dataset is being collected yet. Adding the
> column and persisting the prediction alongside the logged sets is still a
> prerequisite for everything in this section.

This creates the training dataset for the future ML model. Every prediction the AI makes becomes a labeled example once the user logs their actual numbers.
