import { prisma } from '@/lib/prisma'
import { calculateEstimated1RM } from '@/lib/progress'

interface SetData {
  reps: number
  weight_kg: number | null
}

export interface PredictionResult {
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
