# AI Progressive Overload Prediction (v0) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the rule-based progression suggestions with LLM-powered predictions that consider full exercise history and user goals, displayed as text hints in the workout logging form.

**Architecture:** New `/api/workouts/predict` endpoint fetches last 8 sessions of an exercise + ProgressSnapshot + user profile, builds a prompt, calls the existing AI infrastructure (`callText`), returns structured prediction JSON. The `ExerciseSuggestion` component switches to this endpoint and renders a richer multi-line hint (predicted prescription + reasoning). Falls back to existing `generateSuggestion()` on failure.

**Tech Stack:** Next.js API route, existing `callText` AI abstraction, Prisma queries, React client component.

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `src/app/api/workouts/predict/route.ts` | API endpoint: fetch history, build prompt, call LLM, return prediction |
| Create | `src/lib/predict.ts` | Prompt template + response parser + history formatter |
| Modify | `src/lib/api.ts` | Add `getExercisePrediction()` client function |
| Modify | `src/types/exercises.ts` | Add `PredictionData` type |
| Modify | `src/components/workouts/ExerciseSuggestion.tsx` | Call predict endpoint, render richer hint |

---

### Task 1: Add `PredictionData` Type

**Files:**
- Modify: `src/types/exercises.ts`

- [ ] **Step 1: Add the PredictionData interface**

Add after the existing `ProgressData` interface:

```typescript
export interface PredictionData {
  prediction: {
    sets: { reps: number; weight_kg: number }[]
    reasoning: string
  } | null
  confidence: 'high' | 'medium' | 'low'
  fallback_used: boolean
  last_session: {
    date: string
    sets: { reps: number; weight_kg: number | null }[]
  } | null
}
```

- [ ] **Step 2: Commit**

```bash
git add src/types/exercises.ts
git commit -m "feat: add PredictionData type for AI overload prediction"
```

---

### Task 2: Create Prediction Prompt and Parser

**Files:**
- Create: `src/lib/predict.ts`

- [ ] **Step 1: Create the prediction module**

```typescript
import { prisma } from '@/lib/prisma'
import { calculateEstimated1RM } from '@/lib/progress'
import type { AIProvider } from '@/lib/models'

interface SetData {
  reps: number
  weight_kg: number | null
}

interface PredictionResult {
  sets: { reps: number; weight_kg: number }[]
  reasoning: string
}

const PREDICT_PROMPT = `You are a strength coach predicting the next training session for one exercise.

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
- Rep ranges appropriate to the training focus (strength: 3-6, hypertrophy: 8-12, default: 6-10)

Return ONLY valid JSON:
{
  "sets": [{"reps": <number>, "weight_kg": <number>}],
  "reasoning": "<one sentence explaining your prediction>"
}`

export function formatHistory(
  logs: { workout_date: Date; sets: SetData[] }[],
): string {
  return logs
    .map(log => {
      const weightedSets = log.sets.filter(s => (s.weight_kg ?? 0) > 0)
      if (weightedSets.length === 0) return null

      const reps = weightedSets[0].reps
      const weight = weightedSets[0].weight_kg!
      const allSame = weightedSets.every(s => s.reps === reps && s.weight_kg === weight)

      let setsStr: string
      if (allSame) {
        setsStr = `${weightedSets.length}×${reps} @ ${weight}kg`
      } else {
        setsStr = weightedSets.map(s => `${s.reps}@${s.weight_kg}kg`).join(', ')
      }

      const best1RM = Math.max(...weightedSets.map(s => calculateEstimated1RM(s.weight_kg!, s.reps)))
      const dateStr = log.workout_date.toISOString().split('T')[0]
      return `${dateStr}: ${setsStr} (est 1RM: ${best1RM}kg)`
    })
    .filter(Boolean)
    .join('\n')
}

export function buildPredictPrompt(params: {
  exerciseName: string
  fitnessGoal: string | null
  trainingFocus: string | null
  weightKg: number | null
  history: string
  estimated1rm: number
  bestSetWeight: number
  bestSetReps: number
  sessionsSinceImprovement: number
  totalVolume7d: number
}): string {
  return PREDICT_PROMPT
    .replace('{exercise_name}', params.exerciseName)
    .replace('{fitness_goal}', params.fitnessGoal || 'general fitness')
    .replace('{training_focus}', params.trainingFocus || 'balanced')
    .replace('{weight_kg}', String(params.weightKg ?? 'unknown'))
    .replace('{history}', params.history || 'No previous sessions recorded.')
    .replace('{estimated_1rm}', String(params.estimated1rm))
    .replace('{best_set_weight}', String(params.bestSetWeight))
    .replace('{best_set_reps}', String(params.bestSetReps))
    .replace('{sessions_since_improvement}', String(params.sessionsSinceImprovement))
    .replace('{total_volume_7d}', String(params.totalVolume7d))
}

export function parsePredictionResponse(raw: string): PredictionResult {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/, '')
    .replace(/\s*```$/, '')

  if (!cleaned) throw new Error('AI returned an empty response')

  const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('Failed to parse AI prediction response')

  const data = JSON.parse(jsonMatch[0])

  if (!Array.isArray(data.sets) || data.sets.length === 0) {
    throw new Error('AI prediction missing sets array')
  }

  return {
    sets: data.sets.map((s: { reps: number; weight_kg: number }) => ({
      reps: Math.round(Number(s.reps)),
      weight_kg: Math.round(Number(s.weight_kg) * 10) / 10,
    })),
    reasoning: String(data.reasoning ?? ''),
  }
}

export async function fetchExerciseHistory(
  userId: number,
  exerciseName: string,
  limit: number = 8,
): Promise<{ workout_date: Date; sets: SetData[] }[]> {
  const logs = await prisma.exerciseLog.findMany({
    where: {
      exercise_name: exerciseName,
      workout: { user_id: userId },
    },
    orderBy: { workout: { workout_date: 'desc' } },
    take: limit,
    include: { workout: { select: { workout_date: true } } },
  })

  return logs.map(log => ({
    workout_date: log.workout.workout_date,
    sets: log.sets as unknown as SetData[],
  }))
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/predict.ts
git commit -m "feat: add prediction prompt builder and response parser"
```

---

### Task 3: Create `/api/workouts/predict` Endpoint

**Files:**
- Create: `src/app/api/workouts/predict/route.ts`

- [ ] **Step 1: Create the API route**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser, getUserAICredentials } from '@/lib/auth'
import { getModelForProvider } from '@/lib/models'
import { generateSuggestion } from '@/lib/progress'
import { fetchExerciseHistory, formatHistory, buildPredictPrompt, parsePredictionResponse } from '@/lib/predict'
import { prisma } from '@/lib/prisma'
import type { PredictionData } from '@/types/exercises'

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    const exerciseName = request.nextUrl.searchParams.get('exercise_name')

    if (!exerciseName) {
      return NextResponse.json({ detail: 'exercise_name is required' }, { status: 422 })
    }

    const snapshot = await prisma.progressSnapshot.findUnique({
      where: {
        user_id_exercise_name: {
          user_id: user.id,
          exercise_name: exerciseName,
        },
      },
    })

    const history = await fetchExerciseHistory(user.id, exerciseName)

    if (!snapshot || history.length === 0) {
      return NextResponse.json({
        prediction: null,
        confidence: 'low',
        fallback_used: true,
        last_session: null,
      } satisfies PredictionData)
    }

    const lastSession = history[0]
    const lastSessionData = {
      date: lastSession.workout_date.toISOString().split('T')[0],
      sets: lastSession.sets,
    }

    let prediction: PredictionData
    try {
      const { provider, apiKey, model } = getUserAICredentials(user)
      const { callTextDirect } = await import('@/lib/ai')
      const resolvedModel = getModelForProvider(provider, model)

      const prompt = buildPredictPrompt({
        exerciseName,
        fitnessGoal: user.fitness_goal ?? null,
        trainingFocus: user.training_focus ?? null,
        weightKg: user.weight_kg ? Number(user.weight_kg) : null,
        history: formatHistory(history),
        estimated1rm: snapshot.estimated_1rm,
        bestSetWeight: snapshot.best_set_weight,
        bestSetReps: snapshot.best_set_reps,
        sessionsSinceImprovement: snapshot.sessions_since_improvement,
        totalVolume7d: snapshot.total_volume_7d,
      })

      const raw = await callTextDirect(provider, apiKey, resolvedModel, prompt)
      const result = parsePredictionResponse(raw)

      const confidence = history.length >= 5 ? 'high' : history.length >= 3 ? 'medium' : 'low'

      prediction = {
        prediction: result,
        confidence,
        fallback_used: false,
        last_session: lastSessionData,
      }
    } catch {
      const fallbackSuggestion = generateSuggestion(
        user.training_focus ?? null,
        snapshot.best_set_weight,
        snapshot.best_set_reps,
        snapshot.sessions_since_improvement,
        lastSession.sets,
      )

      prediction = {
        prediction: {
          sets: [{ reps: snapshot.best_set_reps, weight_kg: snapshot.best_set_weight }],
          reasoning: fallbackSuggestion.reason,
        },
        confidence: 'low',
        fallback_used: true,
        last_session: lastSessionData,
      }
    }

    return NextResponse.json(prediction)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Internal error'
    if (message.includes('initData') || message.includes('hash')) {
      return NextResponse.json({ detail: message }, { status: 401 })
    }
    return NextResponse.json({ detail: message }, { status: 500 })
  }
}
```

- [ ] **Step 2: Export `callTextDirect` from `src/lib/ai.ts`**

The existing `callText` function is not exported. Add this export at the end of the file (after the existing private `callText`):

```typescript
export { callText as callTextDirect }
```

This is a one-line addition at the bottom of `src/lib/ai.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/workouts/predict/route.ts src/lib/ai.ts
git commit -m "feat: add /api/workouts/predict endpoint with LLM fallback"
```

---

### Task 4: Add Client API Function

**Files:**
- Modify: `src/lib/api.ts`

- [ ] **Step 1: Add the import for `PredictionData`**

Update the existing import from `@/types/exercises` to include `PredictionData`:

```typescript
import type { Exercise, ProgressData, WorkoutAnalysis, PredictionData } from '@/types/exercises'
```

- [ ] **Step 2: Add the `getExercisePrediction` function**

Add after the existing `getExerciseProgress` function (around line 143):

```typescript
export const getExercisePrediction = (exerciseName: string) =>
  apiFetch<PredictionData>(`/workouts/predict?exercise_name=${encodeURIComponent(exerciseName)}`)
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/api.ts
git commit -m "feat: add getExercisePrediction client API function"
```

---

### Task 5: Update `ExerciseSuggestion` Component

**Files:**
- Modify: `src/components/workouts/ExerciseSuggestion.tsx`

- [ ] **Step 1: Rewrite the component to use the prediction endpoint**

Replace the entire file contents:

```typescript
'use client'

import { useState, useEffect } from 'react'
import { getExercisePrediction } from '@/lib/api'
import type { PredictionData } from '@/types/exercises'

interface ExerciseSuggestionProps {
  exerciseName: string
  enabled?: boolean
}

function formatPredictedSets(sets: { reps: number; weight_kg: number }[]): string {
  if (sets.length === 0) return ''
  const first = sets[0]
  const allSame = sets.every(s => s.reps === first.reps && s.weight_kg === first.weight_kg)
  if (allSame) {
    return `${sets.length}×${first.reps} @ ${first.weight_kg}kg`
  }
  return sets.map(s => `${s.reps}@${s.weight_kg}kg`).join(', ')
}

export default function ExerciseSuggestion({ exerciseName, enabled = true }: ExerciseSuggestionProps) {
  const [data, setData] = useState<PredictionData | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!enabled || !exerciseName || exerciseName.length < 3) {
      setData(null)
      return
    }

    let cancelled = false
    setLoading(true)
    const timeout = setTimeout(() => {
      getExercisePrediction(exerciseName)
        .then(d => { if (!cancelled) setData(d) })
        .catch(() => { if (!cancelled) setData(null) })
        .finally(() => { if (!cancelled) setLoading(false) })
    }, 800)

    return () => { cancelled = true; clearTimeout(timeout) }
  }, [exerciseName, enabled])

  if (!enabled) return null
  if (loading) {
    return (
      <div style={{
        padding: '8px 12px', borderRadius: '10px',
        backgroundColor: 'rgba(48, 209, 88, 0.05)',
        marginTop: '6px',
      }}>
        <p style={{ fontFamily: 'var(--font-display)', fontSize: '11px', color: 'var(--tg-theme-hint-color)' }}>
          Loading prediction…
        </p>
      </div>
    )
  }
  if (!data || !data.prediction) return null

  const bgColor = data.confidence === 'high'
    ? 'rgba(48, 209, 88, 0.08)'
    : data.confidence === 'medium'
      ? 'rgba(255, 214, 10, 0.08)'
      : 'rgba(142, 142, 147, 0.08)'

  return (
    <div style={{
      padding: '8px 12px', borderRadius: '10px',
      backgroundColor: bgColor,
      marginTop: '6px',
    }}>
      {data.last_session && (
        <p style={{ fontFamily: 'var(--font-display)', fontSize: '11px', color: 'var(--tg-theme-hint-color)', marginBottom: '3px' }}>
          Last: {data.last_session.sets.length}×{data.last_session.sets[0]?.reps}
          {data.last_session.sets[0]?.weight_kg ? ` @ ${data.last_session.sets[0].weight_kg}kg` : ''}
          {' '}({data.last_session.date})
        </p>
      )}
      <p style={{ fontFamily: 'var(--font-display)', fontSize: '11px', fontWeight: 500, color: 'var(--tg-theme-text-color)' }}>
        ↑ Try {formatPredictedSets(data.prediction.sets)}
      </p>
      {data.prediction.reasoning && (
        <p style={{ fontFamily: 'var(--font-display)', fontSize: '10px', color: 'var(--tg-theme-hint-color)', marginTop: '2px' }}>
          {data.prediction.reasoning}
        </p>
      )}
      {data.fallback_used && (
        <p style={{ fontFamily: 'var(--font-display)', fontSize: '9px', color: 'var(--tg-theme-hint-color)', marginTop: '2px', opacity: 0.7 }}>
          (rule-based fallback)
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/workouts/ExerciseSuggestion.tsx
git commit -m "feat: update ExerciseSuggestion to use AI prediction endpoint"
```

---

### Task 6: Verify Build and Test

**Files:** None (validation only)

- [ ] **Step 1: Run type check**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 2: Run dev server and test manually**

```bash
npm run dev
```

Open the workout logging form, type an exercise name with existing history (e.g. "Bench Press"), and verify:
1. Loading state appears briefly
2. Prediction hint appears with "Last: ..." line, "↑ Try ..." line, and reasoning
3. If AI fails (no API key configured), verify fallback shows with "(rule-based fallback)" label

- [ ] **Step 3: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address issues from manual testing"
```
