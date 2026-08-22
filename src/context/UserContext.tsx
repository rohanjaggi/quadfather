'use client'

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react'
import * as api from '@/lib/api'
import { errorMessage } from '@/lib/errors'
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
  /**
   * Set when the last `refresh()` had at least one endpoint fail. The other
   * endpoints still applied, so this is a "some of this may be stale" banner,
   * not a fatal state — `error` remains the boot-gate's all-or-nothing one.
   */
  refreshError: string | null
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
  refreshUser: () => Promise<void>
  retry: () => Promise<void>
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
  const [refreshError, setRefreshError] = useState<string | null>(null)

  /**
   * Re-fetches every list. Deliberately `allSettled`, not `Promise.all`: these
   * are eight independent endpoints, and under `all` a single transient 500
   * threw away the seven good responses too — one bad list blanked the whole
   * dashboard, and a food that had genuinely been logged never appeared.
   *
   * Each fulfilled result is applied on its own, a rejected one simply leaves
   * that slice at its previous value (never blanked), and `refreshError`
   * records that something is stale. Resolves rather than throwing, so the
   * existing callers — all of which just `await refresh()` after a mutation —
   * keep working unchanged.
   */
  const refresh = useCallback(async () => {
    const [summaryRes, foodRes, waterRes, savedRes, runRes, stepRes, weekStepRes, workoutRes] = await Promise.allSettled([
      api.getDailySummary(),
      api.getFoodLogs(),
      api.getWaterLogs(),
      api.getSavedFoods(),
      api.getRunLogs(new Date().toLocaleDateString('en-CA')),
      api.getSteps(1),
      api.getSteps(7),
      api.getWorkouts(7),
    ])

    if (summaryRes.status === 'fulfilled') setSummary(summaryRes.value)
    if (foodRes.status === 'fulfilled') setFoodLogs(foodRes.value)
    if (waterRes.status === 'fulfilled') setWaterLogs(waterRes.value)
    if (savedRes.status === 'fulfilled') setSavedFoods(savedRes.value)
    if (runRes.status === 'fulfilled') setRunLogs(runRes.value)
    if (stepRes.status === 'fulfilled') setTodaySteps(stepRes.value.length > 0 ? stepRes.value[0].steps : 0)
    if (weekStepRes.status === 'fulfilled') setWeeklySteps(weekStepRes.value)
    if (workoutRes.status === 'fulfilled') setWeeklyWorkouts(workoutRes.value)

    const settled: PromiseSettledResult<unknown>[] = [
      summaryRes, foodRes, waterRes, savedRes, runRes, stepRes, weekStepRes, workoutRes,
    ]
    const rejected = settled.filter((r): r is PromiseRejectedResult => r.status === 'rejected')
    if (rejected.length > 0) {
      console.error('Failed to refresh some data:', rejected.map(r => r.reason))
      setRefreshError(errorMessage(rejected[0].reason, 'Some data could not be refreshed'))
    } else {
      setRefreshError(null)
    }
  }, [])

  // Re-fetches the user object only (same call used at boot). Never clears an
  // existing user on failure, and deliberately leaves the boot-gate `error`
  // alone — no UI surfaces it once a user exists. It rethrows instead, so a
  // caller that just saved something can't report success against stale data.
  const refreshUser = useCallback(async () => {
    try {
      const userData = await api.registerUser()
      setUser(userData)
    } catch (err) {
      console.error('Failed to refresh user:', err)
      throw err
    }
  }, [])

  // Full boot: user + all lists. Also used by the auth gate's Retry button.
  const bootstrap = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const userData = await api.registerUser()
      setUser(userData)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [refresh])

  useEffect(() => {
    bootstrap()
  }, [bootstrap])

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
    await refreshUser()
    await refresh()
  }, [refresh, refreshUser])

  const updatePersonal = useCallback(async (data: PersonalUpdate) => {
    await api.updatePersonal(data)
    await refreshUser()
  }, [refreshUser])

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
      user, summary, foodLogs, waterLogs, savedFoods, runLogs, todaySteps, weeklySteps, weeklyWorkouts, loading, error, refreshError,
      logFood, deleteFood, logWater, deleteWater, updateGoals, updatePersonal,
      saveFood, updateSavedFood, deleteSavedFood, logRun: logRunAction, deleteRun: deleteRunAction,
      toggleRunAllowance: toggleRunAllowanceAction, refresh, refreshUser, retry: bootstrap,
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
