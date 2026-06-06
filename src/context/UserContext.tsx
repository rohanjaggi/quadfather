'use client'

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react'
import * as api from '@/lib/api'
import type { User, DailySummary, FoodLog, FoodLogCreate, WaterLog, WaterLogCreate, GoalsUpdate, PersonalUpdate, SavedFood, SavedFoodCreate } from '@/types/api'
import type { RunLog, RunLogCreate } from '@/types/running'
import type { StepLog, WorkoutLog } from '@/types/workouts'

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
  updateSavedFood: (id: number, data: Partial<SavedFoodCreate>) => Promise<void>
  deleteSavedFood: (id: number) => Promise<void>
  runLogs: RunLog[]
  todaySteps: number
  weeklySteps: StepLog[]
  weeklyWorkouts: WorkoutLog[]
  logRun: (data: RunLogCreate) => Promise<void>
  deleteRun: (id: number) => Promise<void>
  toggleRunAllowance: (id: number, added: boolean) => Promise<void>
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
  const [todaySteps, setTodaySteps] = useState(0)
  const [weeklySteps, setWeeklySteps] = useState<StepLog[]>([])
  const [weeklyWorkouts, setWeeklyWorkouts] = useState<WorkoutLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const [summaryData, foodData, waterData, savedData, runData, stepData, weekStepData, workoutData] = await Promise.all([
        api.getDailySummary(),
        api.getFoodLogs(),
        api.getWaterLogs(),
        api.getSavedFoods(),
        api.getRunLogs(new Date().toLocaleDateString('en-CA')),
        api.getSteps(1),
        api.getSteps(7),
        api.getWorkouts(7),
      ])
      setSummary(summaryData)
      setFoodLogs(foodData)
      setWaterLogs(waterData)
      setSavedFoods(savedData)
      setRunLogs(runData)
      setTodaySteps(stepData.length > 0 ? stepData[0].steps : 0)
      setWeeklySteps(weekStepData)
      setWeeklyWorkouts(workoutData)
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

  const updateSavedFood = useCallback(async (id: number, data: Partial<SavedFoodCreate>) => {
    const updated = await api.updateSavedFood(id, data)
    setSavedFoods(prev => prev.map(f => f.id === id ? updated : f))
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

  return (
    <UserContext.Provider value={{
      user, summary, foodLogs, waterLogs, savedFoods, runLogs, todaySteps, weeklySteps, weeklyWorkouts, loading, error,
      logFood, deleteFood, logWater, deleteWater, updateGoals, updatePersonal,
      saveFood, updateSavedFood, deleteSavedFood, logRun: logRunAction, deleteRun: deleteRunAction,
      toggleRunAllowance: toggleRunAllowanceAction, refresh,
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
