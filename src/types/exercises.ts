export interface Exercise {
  id: number
  name: string
  category: string
  primary_muscles: string[]
  secondary_muscles: string[]
  equipment: string | null
}

export interface ProgressData {
  last_session: {
    date: string
    sets: { reps: number; weight_kg: number | null }[]
  } | null
  suggestion: {
    type: 'increase_weight' | 'increase_reps' | 'increase_sets' | 'deload' | 'maintain'
    value: string
    reason: string
  } | null
  status: 'progressing' | 'stalled' | 'new'
  stall_weeks: number
  is_pr_territory: boolean
}

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

export interface WorkoutAnalysis {
  muscle_groups_hit: string[]
  prs: { exercise: string; type: 'weight' | 'reps'; value: string }[]
  volume_comparison: string
  takeaway: string
}
