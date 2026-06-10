import WebApp from '@twa-dev/sdk'
import type { User, DailySummary, FoodLog, FoodLogCreate, WaterLog, WaterLogCreate, GoalsUpdate, PersonalUpdate, MealAnalysis, MealSuggestion, SavedFood, SavedFoodCreate, AnalyticsResponse } from '@/types/api'

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const initData = typeof window !== 'undefined' ? WebApp.initData : ''
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Telegram-Init-Data': initData,
      ...options.headers,
    },
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
export const updateGoals = (data: GoalsUpdate) => apiFetch<User>('/users/me/goals', { method: 'PUT', body: JSON.stringify(data) })
export const updatePersonal = (data: PersonalUpdate) => apiFetch<User>('/users/me/goals', { method: 'PUT', body: JSON.stringify(data) })

export const getSavedFoods = () => apiFetch<SavedFood[]>('/foods/saved')
export const saveFood = (data: SavedFoodCreate) => apiFetch<SavedFood>('/foods/saved', { method: 'POST', body: JSON.stringify(data) })
export const updateSavedFood = (id: number, data: Partial<SavedFoodCreate>) => apiFetch<SavedFood>(`/foods/saved/${id}`, { method: 'PATCH', body: JSON.stringify(data) })
export const deleteSavedFood = (id: number) => apiFetch<void>(`/foods/saved/${id}`, { method: 'DELETE' })
export const getAnalytics = (days: number) => apiFetch<AnalyticsResponse>(`/analytics/daily?days=${days}`)
export const getAnalyticsInsights = (days: number) => apiFetch<{ insight: string }>(`/analytics/insights?days=${days}`)
export const parseFood = (text: string) => apiFetch<MealAnalysis>('/foods/parse', { method: 'POST', body: JSON.stringify({ text }) })
export const getMealSuggestions = () => apiFetch<MealSuggestion[]>('/foods/suggest')

export const setApiKey = (data: { provider: string; api_key: string; model?: string }) =>
  apiFetch<{ provider: string; model: string | null; has_api_key: boolean }>('/users/me/key', { method: 'POST', body: JSON.stringify(data) })
export const deleteApiKey = () =>
  apiFetch<{ has_api_key: boolean }>('/users/me/key', { method: 'DELETE' })

export async function analyseMeal(imageFile: File, description: string): Promise<MealAnalysis> {
  const initData = typeof window !== 'undefined' ? WebApp.initData : ''
  const form = new FormData()
  form.append('image', imageFile)
  form.append('description', description)
  const res = await fetch('/api/foods/analyse', {
    method: 'POST',
    headers: { 'X-Telegram-Init-Data': initData },
    body: form,
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

import type { RunLog, RunLogCreate, RunAnalysis, RunningAnalyticsResponse } from '@/types/running'

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

export async function analyseRunScreenshot(imageFile: File): Promise<RunAnalysis> {
  const initData = typeof window !== 'undefined' ? WebApp.initData : ''
  const form = new FormData()
  form.append('image', imageFile)
  const res = await fetch('/api/runs/analyse', {
    method: 'POST',
    headers: { 'X-Telegram-Init-Data': initData },
    body: form,
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

import type {
  WorkoutTemplate, WorkoutTemplateCreate, WorkoutLog, WorkoutLogCreate,
  WorkoutParseResult, StepLog, StepLogCreate, WorkoutSuggestion,
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
export const updateTemplate = (id: number, data: Partial<WorkoutTemplateCreate>) =>
  apiFetch<WorkoutTemplate>(`/workouts/templates/${id}`, { method: 'PUT', body: JSON.stringify(data) })
export const deleteTemplate = (id: number) =>
  apiFetch<void>(`/workouts/templates/${id}`, { method: 'DELETE' })

// Steps
export const logSteps = (data: StepLogCreate) =>
  apiFetch<StepLog>('/steps', { method: 'POST', body: JSON.stringify(data) })
export const getSteps = (days?: number) =>
  apiFetch<StepLog[]>(`/steps${days ? `?days=${days}` : ''}`)

// Coach
export const getWorkoutSuggestion = () =>
  apiFetch<WorkoutSuggestion>('/coach/suggestion')

// Access Token
export const getAccessTokenStatus = () =>
  apiFetch<{ has_token: boolean; hint: string | null }>('/users/me/token')
export const generateAccessToken = () =>
  apiFetch<{ token: string }>('/users/me/token', { method: 'POST' })
export const deleteAccessToken = () =>
  apiFetch<void>('/users/me/token', { method: 'DELETE' })

import type { Exercise, ProgressData, WorkoutAnalysis } from '@/types/exercises'

export const searchExercises = (q: string, category?: string) =>
  apiFetch<Exercise[]>(`/exercises?q=${encodeURIComponent(q)}${category ? `&category=${category}` : ''}`)

export const getExerciseProgress = (exerciseName: string) =>
  apiFetch<ProgressData>(`/workouts/progress?exercise_name=${encodeURIComponent(exerciseName)}`)

export const analyseWorkout = (id: number) =>
  apiFetch<WorkoutAnalysis>(`/workouts/${id}/analyse`, { method: 'POST' })

export interface WorkoutPR {
  exercise_name: string
  type: 'weight'
  value: string
  volume: number
  date: string
}

export const getWorkoutPRs = (days: number) =>
  apiFetch<{ prs: WorkoutPR[] }>(`/workouts/prs?days=${days}`)

export const getAllWorkoutPRs = () =>
  apiFetch<{ prs: WorkoutPR[] }>('/workouts/prs?all=1')

export const getWorkoutRecap = (days: number) =>
  apiFetch<{ recap: string }>(`/workouts/recap?days=${days}`)
