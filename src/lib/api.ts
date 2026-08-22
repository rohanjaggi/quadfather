import type { User, DailySummary, FoodLog, FoodLogCreate, WaterLog, WaterLogCreate, GoalsUpdate, GoalsUpdateResult, PersonalUpdate, MealAnalysis, MealSuggestion, SavedFood, SavedFoodCreate, AnalyticsResponse } from '@/types/api'

/**
 * The signed `initData` blob every request authenticates with, read straight
 * off the global Telegram injects into the webview.
 *
 * Deliberately NOT `import WebApp from '@twa-dev/sdk'`: that module runs
 * `var telegramWindow = window` at import time, so importing it here throws
 * `ReferenceError: window is not defined` the moment anything on the server
 * touches this module — and it also made the `typeof window` guard below dead
 * code, since the import blew up before the guard could run. `WebApp.initData`
 * is exactly this string, so behaviour is unchanged.
 *
 * Read per call rather than once at module scope: the global is only populated
 * once Telegram's script has run, which is not guaranteed at import time.
 */
function getInitData(): string {
  return typeof window !== 'undefined' ? (window.Telegram?.WebApp?.initData ?? '') : ''
}

/**
 * A hung TCP connection used to leave every `saving`/`pending` button disabled
 * forever with no way to recover inside the Telegram webview, so every request
 * is capped. 20s comfortably clears the platform's own function ceiling, which
 * is what actually bounds the slow (AI) routes.
 */
const REQUEST_TIMEOUT_MS = 20_000

/**
 * `AbortSignal.timeout` is iOS 16+ / Chrome 103+. A Mini App opened in an older
 * webview would otherwise get a synchronous `TypeError` on *every* request —
 * a dead app — so an unsupported engine falls back to the previous
 * no-timeout behaviour rather than taking the whole client down.
 */
function timeoutSignal(): AbortSignal | undefined {
  return typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
    ? AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    : undefined
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Telegram-Init-Data': getInitData(),
      ...options.headers,
    },
    signal: timeoutSignal(),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`API ${res.status}: ${body}`)
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

export const registerUser = () => apiFetch<User>('/users', { method: 'POST' })
export const getDailySummary = () => apiFetch<DailySummary>('/users/me')
export const getFoodLogs = (date?: string) =>
  apiFetch<FoodLog[]>(`/foods${date ? `?date=${date}` : ''}`)
export const logFood = (data: FoodLogCreate) => apiFetch<FoodLog>('/foods', { method: 'POST', body: JSON.stringify(data) })
export const deleteFood = (id: number) => apiFetch<void>(`/foods/${id}`, { method: 'DELETE' })
export const getWaterLogs = () => apiFetch<WaterLog[]>('/water')
export const logWater = (data: WaterLogCreate) => apiFetch<WaterLog>('/water', { method: 'POST', body: JSON.stringify(data) })
export const deleteWater = (id: number) => apiFetch<void>(`/water/${id}`, { method: 'DELETE' })
// All three below are the same `PUT /users/me/goals` route and so must share
// one return type — they used to claim three different ones, none of which
// matched the body the route actually sends (it is not a `User`). No caller
// reads the result; they all re-fetch the user instead.
export const updateGoals = (data: GoalsUpdate) => apiFetch<GoalsUpdateResult>('/users/me/goals', { method: 'PUT', body: JSON.stringify(data) })
export const updatePersonal = (data: PersonalUpdate) => apiFetch<GoalsUpdateResult>('/users/me/goals', { method: 'PUT', body: JSON.stringify(data) })

export const updateCoachingPrefs = (data: {
  ai_features_enabled?: boolean
  ai_coaching_prefs?: Record<string, boolean>
}) => apiFetch<GoalsUpdateResult>('/users/me/goals', { method: 'PUT', body: JSON.stringify(data) })

export const getSavedFoods = () => apiFetch<SavedFood[]>('/foods/saved')
export const saveFood = (data: SavedFoodCreate) => apiFetch<SavedFood>('/foods/saved', { method: 'POST', body: JSON.stringify(data) })
export const updateSavedFood = (id: number, data: Partial<SavedFoodCreate>) => apiFetch<SavedFood>(`/foods/saved/${id}`, { method: 'PATCH', body: JSON.stringify(data) })
export const deleteSavedFood = (id: number) => apiFetch<void>(`/foods/saved/${id}`, { method: 'DELETE' })
export const getAnalytics = (days: number) => apiFetch<AnalyticsResponse>(`/analytics/daily?days=${days}`)
// `insight` is null when there is nothing logged in the window — the callers
// render an empty state for that, so the type has to admit it.
export const getAnalyticsInsights = (days: number) => apiFetch<{ insight: string | null }>(`/analytics/insights?days=${days}`)
export const parseFood = (text: string) => apiFetch<MealAnalysis>('/foods/parse', { method: 'POST', body: JSON.stringify({ text }) })
export const getMealSuggestions = () => apiFetch<MealSuggestion[]>('/foods/suggest')

export const setApiKey = (data: { provider: string; api_key: string; model?: string }) =>
  apiFetch<{ provider: string; model: string | null; has_api_key: boolean }>('/users/me/key', { method: 'POST', body: JSON.stringify(data) })
export const deleteApiKey = () =>
  apiFetch<{ has_api_key: boolean }>('/users/me/key', { method: 'DELETE' })

export async function analyseMeal(imageFile: File, description: string): Promise<MealAnalysis> {
  const form = new FormData()
  form.append('image', imageFile)
  form.append('description', description)
  const res = await fetch('/api/foods/analyse', {
    method: 'POST',
    headers: { 'X-Telegram-Init-Data': getInitData() },
    body: form,
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

import type { RunLog, RunLogCreate, RunAnalysis, RunningAnalyticsResponse, RunPRsResponse } from '@/types/running'

export const getRunLogs = (date?: string) =>
  apiFetch<RunLog[]>(`/runs${date ? `?date=${date}` : ''}`)
export const logRun = (data: RunLogCreate) =>
  apiFetch<RunLog>('/runs', { method: 'POST', body: JSON.stringify(data) })
export const deleteRun = (id: number) =>
  apiFetch<void>(`/runs/${id}`, { method: 'DELETE' })
export const toggleRunAllowance = (id: number, added: boolean) =>
  apiFetch<RunLog>(`/runs/${id}`, { method: 'PATCH', body: JSON.stringify({ added_to_allowance: added }) })
export const getRunningAnalytics = (days: number) =>
  apiFetch<RunningAnalyticsResponse>(`/analytics/running?days=${days}`)
export const getRunPRs = () =>
  apiFetch<RunPRsResponse>('/runs/prs')
export const getRunHistory = (days: number) =>
  apiFetch<RunLog[]>(`/runs/history?days=${days}`)

export async function analyseRunScreenshot(imageFile: File): Promise<RunAnalysis> {
  const form = new FormData()
  form.append('image', imageFile)
  const res = await fetch('/api/runs/analyse', {
    method: 'POST',
    headers: { 'X-Telegram-Init-Data': getInitData() },
    body: form,
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

import type {
  WorkoutTemplate, WorkoutTemplateCreate, WorkoutLog, WorkoutLogCreate,
  WorkoutParseResult, StepLog,
} from '@/types/workouts'

// Workouts
export const getWorkouts = (days?: number) =>
  apiFetch<WorkoutLog[]>(`/workouts${days ? `?days=${days}` : ''}`)
export const getWorkoutsByDate = (date: string) =>
  apiFetch<WorkoutLog[]>(`/workouts?date=${date}`)
export const logWorkout = (data: WorkoutLogCreate) =>
  apiFetch<WorkoutLog>('/workouts', { method: 'POST', body: JSON.stringify(data) })
export const deleteWorkout = (id: number) =>
  apiFetch<void>(`/workouts/${id}`, { method: 'DELETE' })
export const parseWorkout = (text: string) =>
  apiFetch<WorkoutParseResult>('/workouts/parse', { method: 'POST', body: JSON.stringify({ text }) })

// Templates
export const getTemplates = () =>
  apiFetch<WorkoutTemplate[]>('/workouts/templates')
export const createTemplate = (data: WorkoutTemplateCreate) =>
  apiFetch<WorkoutTemplate>('/workouts/templates', { method: 'POST', body: JSON.stringify(data) })
export const deleteTemplate = (id: number) =>
  apiFetch<void>(`/workouts/templates/${id}`, { method: 'DELETE' })

// Steps — written by the iOS Shortcut against `POST /api/steps` with an access
// token, never by this client, so there is no `logSteps` wrapper here.
export const getSteps = (days?: number) =>
  apiFetch<StepLog[]>(`/steps${days ? `?days=${days}` : ''}`)

// Access Token
export const getAccessTokenStatus = () =>
  apiFetch<{ has_token: boolean; hint: string | null }>('/users/me/token')
export const generateAccessToken = () =>
  apiFetch<{ token: string }>('/users/me/token', { method: 'POST' })
export const deleteAccessToken = () =>
  apiFetch<void>('/users/me/token', { method: 'DELETE' })

import type { Exercise, PredictionData, WorkoutAnalysis } from '@/types/exercises'

export const searchExercises = (q: string, category?: string) =>
  apiFetch<Exercise[]>(`/exercises?q=${encodeURIComponent(q)}${category ? `&category=${category}` : ''}`)

export const getExercisePrediction = (exerciseName: string) =>
  apiFetch<PredictionData>(`/workouts/predict?exercise_name=${encodeURIComponent(exerciseName)}`)

export const analyseWorkout = (id: number) =>
  apiFetch<WorkoutAnalysis>(`/workouts/${id}/analyse`, { method: 'POST' })

export interface WorkoutPR {
  exercise_name: string
  type: 'weight'
  /** Pre-formatted, e.g. `100kg × 5` — the heaviest set, not the best-e1RM set. */
  value: string
  volume: number
  /** `null` when the snapshot has no recorded improvement date. */
  date: string | null
}

export const getWorkoutPRs = (days: number) =>
  apiFetch<{ prs: WorkoutPR[] }>(`/workouts/prs?days=${days}`)

export const getAllWorkoutPRs = () =>
  apiFetch<{ prs: WorkoutPR[] }>('/workouts/prs?all=1')

export const getWorkoutRecap = (days: number) =>
  apiFetch<{ recap: string }>(`/workouts/recap?days=${days}`)

// Strava
export const getStravaConnectUrl = () =>
  apiFetch<{ url: string }>('/strava/connect')
export const disconnectStrava = () =>
  apiFetch<{ disconnected: boolean }>('/strava/disconnect', { method: 'POST' })
export const syncStravaRuns = () =>
  apiFetch<{
    synced: number
    /** Activities skipped because the user had deleted them here before. */
    skipped_deleted: number
    total_fetched: number
    last_synced_at: string
  }>('/runs/sync', { method: 'POST' })
