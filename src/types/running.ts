export interface RunLog {
  id: number
  distance_meters: number
  duration_seconds: number
  calories_burned: number
  pace_per_km?: number
  average_heartrate?: number
  elevation_gain?: number
  name?: string
  source: 'manual' | 'ai_parsed'
  added_to_allowance: boolean
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
