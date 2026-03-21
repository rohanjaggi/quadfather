import WebApp from '@twa-dev/sdk'
import type { User, DailySummary, FoodLog, FoodLogCreate, WaterLog, WaterLogCreate, GoalsUpdate, MealAnalysis, SavedFood, SavedFoodCreate, AnalyticsResponse } from '@/types/api'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const initData = typeof window !== 'undefined' ? WebApp.initData : ''
  const res = await fetch(`${API_BASE}${path}`, {
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

export const registerUser = () => apiFetch<User>('/users/', { method: 'POST' })
export const getDailySummary = () => apiFetch<DailySummary>('/users/me')
export const getFoodLogs = () => apiFetch<FoodLog[]>('/foods/')
export const logFood = (data: FoodLogCreate) => apiFetch<FoodLog>('/foods/', { method: 'POST', body: JSON.stringify(data) })
export const deleteFood = (id: number) => apiFetch<void>(`/foods/${id}`, { method: 'DELETE' })
export const getWaterLogs = () => apiFetch<WaterLog[]>('/water/')
export const logWater = (data: WaterLogCreate) => apiFetch<WaterLog>('/water/', { method: 'POST', body: JSON.stringify(data) })
export const deleteWater = (id: number) => apiFetch<void>(`/water/${id}`, { method: 'DELETE' })
export const updateGoals = (data: GoalsUpdate) => apiFetch<User>('/users/me/goals', { method: 'PUT', body: JSON.stringify(data) })

export const getSavedFoods = () => apiFetch<SavedFood[]>('/foods/saved')
export const saveFood = (data: SavedFoodCreate) => apiFetch<SavedFood>('/foods/saved', { method: 'POST', body: JSON.stringify(data) })
export const deleteSavedFood = (id: number) => apiFetch<void>(`/foods/saved/${id}`, { method: 'DELETE' })
export const getAnalytics = (days: number) => apiFetch<AnalyticsResponse>(`/analytics/daily?days=${days}`)

export async function analyseMeal(imageFile: File, description: string): Promise<MealAnalysis> {
  const initData = typeof window !== 'undefined' ? WebApp.initData : ''
  const form = new FormData()
  form.append('image', imageFile)
  form.append('description', description)
  const res = await fetch(`${API_BASE}/foods/analyse`, {
    method: 'POST',
    headers: { 'X-Telegram-Init-Data': initData },
    body: form,
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
