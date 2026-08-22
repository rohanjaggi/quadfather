export interface RunLog {
  id: number
  distance_meters: number
  duration_seconds: number
  calories_burned: number
  pace_per_km?: number
  average_heartrate?: number
  elevation_gain?: number
  name?: string
  /**
   * `'manual'`, `'ai_parsed'` and `'strava'` are what the app writes today
   * (`'strava'` rows must not be badged "Manual"), but `POST /runs` stores any
   * string the caller sends, so importers like the iOS Shortcut can widen this
   * set without a schema change. Same reasoning as `WorkoutLog.source`:
   * compare against the known values, never assume it is only those.
   */
  source: string
  added_to_allowance: boolean
  /** Serialised BigInt (the JSON number would lose precision beyond 2^53). */
  strava_activity_id: string | null
  run_date: string
  logged_at: string
}

export interface RunLogCreate {
  distance_meters: number
  duration_seconds: number
  calories_burned: number
  pace_per_km?: number
  average_heartrate?: number
  elevation_gain?: number
  name?: string
  source?: string
  run_date?: string
}

export interface RunAnalysis {
  distance_meters: number
  duration_seconds: number
  calories_burned: number
  pace_per_km?: number
  average_heartrate?: number
  confidence: 'high' | 'medium' | 'low'
  notes: string
}

export interface RunningAnalyticsDayData {
  date: string
  total_distance: number
  total_duration: number
  total_calories: number
  run_count: number
  average_pace?: number
}

export interface RunningAnalyticsResponse {
  days: RunningAnalyticsDayData[]
  totals: {
    distance: number
    duration: number
    calories: number
    /** Sum of dampened burn over runs with `added_to_allowance` — what the budget actually credits. */
    credited_calories?: number
    run_count: number
  }
}

export interface RunPR {
  label: string
  value: string
  detail: string
  date: string
}

export interface RunPRsResponse {
  prs: RunPR[]
}
