export interface ExerciseSet {
  reps: number
  weight_kg: number | null
}

export interface TemplateExercise {
  name: string
  defaultSets: number
  defaultReps: number
  defaultWeightKg: number | null
}

export interface WorkoutTemplate {
  id: number
  name: string
  exercises: TemplateExercise[]
  created_at: string
  updated_at: string
}

export interface WorkoutTemplateCreate {
  name: string
  exercises: TemplateExercise[]
}

export interface ExerciseLogEntry {
  exercise_name: string
  exercise_id?: number | null
  sets: ExerciseSet[]
  order: number
}

export interface WorkoutLog {
  id: number
  template_id: number | null
  name: string
  duration_minutes: number | null
  calories_burned: number | null
  notes: string | null
  source: 'manual' | 'ai_parse'
  exercises: ExerciseLogEntry[]
  workout_date: string
  logged_at: string
  analysis?: {
    muscle_groups_hit: string[]
    prs: { exercise: string; type: 'weight' | 'reps'; value: string }[]
    volume_comparison: string
    takeaway: string
  } | null
}

export interface WorkoutLogCreate {
  template_id?: number
  name: string
  duration_minutes?: number
  notes?: string
  source?: string
  exercises: ExerciseLogEntry[]
  workout_date?: string
}

export interface WorkoutParseResult {
  name: string
  exercises: ExerciseLogEntry[]
  confidence: 'high' | 'medium' | 'low'
  notes: string
}

export interface StepLog {
  id: number
  steps: number
  date: string
  source: string
  logged_at: string
}

export interface StepLogCreate {
  steps: number
  date?: string
}

export interface WorkoutSuggestion {
  suggestion: string
  template_id?: number
}
