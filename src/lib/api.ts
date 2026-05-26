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
export const getFoodLogs = () => apiFetch<FoodLog[]>('/foods')
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
