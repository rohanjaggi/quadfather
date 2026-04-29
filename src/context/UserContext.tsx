'use client'

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react'
import * as api from '@/lib/api'
import type { User, DailySummary, FoodLog, FoodLogCreate, WaterLog, WaterLogCreate, GoalsUpdate, PersonalUpdate, SavedFood, SavedFoodCreate } from '@/types/api'
import type { RunLog, RunLogCreate } from '@/types/running'

interface UserContextType {
  user: User | null
  summary: DailySummary | null
  foodLogs: FoodLog[]
  waterLogs: WaterLog[]
  savedFoods: SavedFood[]
  loading: boolean
  error: string | null
  logFood: (data: FoodLogCreate) => Promise<void>
  deleteFood: (id: number) => Promise<void>
  logWater: (data: WaterLogCreate) => Promise<void>
  deleteWater: (id: number) => Promise<void>
  updateGoals: (data: GoalsUpdate) => Promise<void>
  updatePersonal: (data: PersonalUpdate) => Promise<void>
  saveFood: (data: SavedFoodCreate) => Promise<SavedFood>
  deleteSavedFood: (id: number) => Promise<void>
  runLogs: RunLog[]
  logRun: (data: RunLogCreate) => Promise<void>
  deleteRun: (id: number) => Promise<void>
  toggleRunAllowance: (id: number, added: boolean) => Promise<void>
  syncStrava: () => Promise<{ synced: number }>
  refresh: () => Promise<void>
}

const UserContext = createContext<UserContextType | null>(null)

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [summary, setSummary] = useState<DailySummary | null>(null)
  const [foodLogs, setFoodLogs] = useState<FoodLog[]>([])
  const [waterLogs, setWaterLogs] = useState<WaterLog[]>([])
  const [savedFoods, setSavedFoods] = useState<SavedFood[]>([])
  const [runLogs, setRunLogs] = useState<RunLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const [summaryData, foodData, waterData, savedData, runData] = await Promise.all([
        api.getDailySummary(),
        api.getFoodLogs(),
        api.getWaterLogs(),
        api.getSavedFoods(),
        api.getRunLogs(),
      ])
      setSummary(summaryData)
      setFoodLogs(foodData)
      setWaterLogs(waterData)
      setSavedFoods(savedData)
      setRunLogs(runData)
    } catch (err) {
      console.error('Failed to refresh data:', err)
    }
  }, [])

  useEffect(() => {
    async function init() {
      try {
        setLoading(true)
        const userData = await api.registerUser()
        setUser(userData)
        await refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load')
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [refresh])

  const logFood = useCallback(async (data: FoodLogCreate) => {
    await api.logFood(data)
    await refresh()
  }, [refresh])

  const deleteFood = useCallback(async (id: number) => {
    await api.deleteFood(id)
    await refresh()
  }, [refresh])

  const logWater = useCallback(async (data: WaterLogCreate) => {
    await api.logWater(data)
    await refresh()
  }, [refresh])

  const deleteWater = useCallback(async (id: number) => {
    await api.deleteWater(id)
    await refresh()
  }, [refresh])

  const updateGoals = useCallback(async (data: GoalsUpdate) => {
    await api.updateGoals(data)
    const userData = await api.registerUser()
    setUser(userData)
    await refresh()
  }, [refresh])

  const updatePersonal = useCallback(async (data: PersonalUpdate) => {
    await api.updatePersonal(data)
    const userData = await api.registerUser()
    setUser(userData)
  }, [])

  const saveFood = useCallback(async (data: SavedFoodCreate): Promise<SavedFood> => {
    const saved = await api.saveFood(data)
    setSavedFoods(prev => [...prev, saved].sort((a, b) => a.name.localeCompare(b.name)))
    return saved
  }, [])

  const deleteSavedFood = useCallback(async (id: number) => {
    await api.deleteSavedFood(id)
    setSavedFoods(prev => prev.filter(f => f.id !== id))
  }, [])

  const logRunAction = useCallback(async (data: RunLogCreate) => {
    await api.logRun(data)
    await refresh()
  }, [refresh])

  const deleteRunAction = useCallback(async (id: number) => {
    await api.deleteRun(id)
    await refresh()
  }, [refresh])

  const toggleRunAllowanceAction = useCallback(async (id: number, added: boolean) => {
    await api.toggleRunAllowance(id, added)
    await refresh()
  }, [refresh])

  const syncStrava = useCallback(async () => {
    const result = await api.syncStravaRuns()
    await refresh()
    return result
  }, [refresh])

  return (
    <UserContext.Provider value={{
      user, summary, foodLogs, waterLogs, savedFoods, runLogs, loading, error,
      logFood, deleteFood, logWater, deleteWater, updateGoals, updatePersonal,
      saveFood, deleteSavedFood, logRun: logRunAction, deleteRun: deleteRunAction,
      toggleRunAllowance: toggleRunAllowanceAction, syncStrava, refresh,
    }}>
      {children}
    </UserContext.Provider>
  )
}

export function useUser() {
  const ctx = useContext(UserContext)
  if (!ctx) throw new Error('useUser must be used within UserProvider')
  return ctx
}
