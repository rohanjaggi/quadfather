'use client'

import { createContext, useContext, useEffect, useRef, useState, useCallback, ReactNode } from 'react'
import * as api from '@/lib/api'
import { errorMessage } from '@/lib/errors'
import { toast } from '@/components/ui/Toast'
import { deferWithUndo } from '@/components/ui/undo'
import { dayKey } from '@/lib/day'
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
  /** Resolves with the created log so the caller can offer Undo (`deleteFood(id, { undoable: false })`). */
  logFood: (data: FoodLogCreate) => Promise<FoodLog>
  /**
   * Undoable by default: the entry leaves the UI (and today's totals) at once,
   * a toast offers Undo for 5s, and only then is the server delete sent.
   * `undoable: false` deletes immediately (used to undo a fresh log).
   * `onUndo` lets a page with its own local list put the row back.
   */
  deleteFood: (id: number, opts?: DeleteOpts) => Promise<void>
  logWater: (data: WaterLogCreate) => Promise<WaterLog>
  deleteWater: (id: number, opts?: DeleteOpts) => Promise<void>
  updateGoals: (data: GoalsUpdate) => Promise<void>
  updatePersonal: (data: PersonalUpdate) => Promise<void>
  saveFood: (data: SavedFoodCreate) => Promise<SavedFood>
  updateSavedFood: (id: number, data: Partial<SavedFoodCreate>) => Promise<void>
  deleteSavedFood: (id: number, opts?: DeleteOpts) => Promise<void>
  runLogs: RunLog[]
  todaySteps: number
  weeklySteps: StepLog[]
  weeklyWorkouts: WorkoutLog[]
  logRun: (data: RunLogCreate) => Promise<RunLog>
  deleteRun: (id: number, opts?: DeleteOpts) => Promise<void>
  toggleRunAllowance: (id: number, added: boolean) => Promise<void>
  refresh: () => Promise<void>
  refreshUser: () => Promise<void>
  retry: () => Promise<void>
}

export interface DeleteOpts {
  undoable?: boolean
  onUndo?: () => void
  /** Runs if the server delete fails, so a page-owned list can put the row back. */
  onFail?: () => void
}

/** Today's totals with one food log added (sign 1) or taken away (sign -1). */
function shiftFood(s: DailySummary | null, log: FoodLog, sign: 1 | -1): DailySummary | null {
  if (!s) return s
  const m = s.macros
  const add = (t: { total: number; goal: number; remaining: number }, v: number) =>
    ({ ...t, total: t.total + sign * v, remaining: t.remaining - sign * v })
  return {
    ...s,
    meals_logged: Math.max(0, s.meals_logged + sign),
    macros: {
      calories: add(m.calories, log.calories),
      protein: add(m.protein, log.protein),
      carbohydrates: add(m.carbohydrates, log.carbohydrates),
      fats: add(m.fats, log.fats),
      fiber: add(m.fiber, log.fiber),
    },
  }
}

function shiftWater(s: DailySummary | null, log: WaterLog, sign: 1 | -1): DailySummary | null {
  if (!s) return s
  const total = s.water.total + sign * log.amount_liters
  return { ...s, water: { ...s.water, total, remaining: s.water.goal - total } }
}

const byNewest = <T extends { logged_at: string }>(a: T, b: T) => b.logged_at.localeCompare(a.logged_at)

const UserContext = createContext<UserContextType | null>(null)

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [summary, setSummary] = useState<DailySummary | null>(null)
  const [foodLogs, setFoodLogs] = useState<FoodLog[]>([])
  const [waterLogs, setWaterLogs] = useState<WaterLog[]>([])
  const [savedFoods, setSavedFoods] = useState<SavedFood[]>([])
  const [runLogs, setRunLogs] = useState<RunLog[]>([])
  const [weeklySteps, setWeeklySteps] = useState<StepLog[]>([])
  const [weeklyWorkouts, setWeeklyWorkouts] = useState<WorkoutLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshError, setRefreshError] = useState<string | null>(null)

  /**
   * Re-fetches every day-scoped list. Deliberately `allSettled`, not
   * `Promise.all`: these are six independent endpoints, and under `all` a
   * single transient 500 threw away the good responses too — one bad list
   * blanked the whole dashboard, and a food that had genuinely been logged
   * never appeared.
   *
   * Each fulfilled result is applied on its own, a rejected one simply leaves
   * that slice at its previous value (never blanked), and `refreshError`
   * records that something is stale. Resolves rather than throwing, so the
   * existing callers — all of which just `await refresh()` after a mutation —
   * keep working unchanged.
   */
  // Deletes still inside their Undo window. Any refresh in that window would
  // bring them back from the server, so it hides them from the lists and takes
  // them out of today's totals until the server delete lands (or Undo).
  const pendingFood = useRef(new Map<number, FoodLog>())
  const pendingWater = useRef(new Map<number, WaterLog>())
  const pendingRuns = useRef(new Set<number>())

  const refresh = useCallback(async () => {
    const [summaryRes, foodRes, waterRes, runRes, weekStepRes, workoutRes] = await Promise.allSettled([
      api.getDailySummary(),
      api.getFoodLogs(),
      api.getWaterLogs(),
      api.getRunLogs(),
      api.getSteps(7),
      api.getWorkouts(7),
    ])

    if (summaryRes.status === 'fulfilled') {
      // Subtract a pending delete unless the server list shows it already gone.
      const serverFood = foodRes.status === 'fulfilled' ? foodRes.value : null
      const serverWater = waterRes.status === 'fulfilled' ? waterRes.value : null
      let s: DailySummary | null = summaryRes.value
      for (const [id, log] of pendingFood.current) {
        if (!serverFood || serverFood.some(f => f.id === id)) s = shiftFood(s, log, -1)
      }
      for (const [id, log] of pendingWater.current) {
        if (!serverWater || serverWater.some(w => w.id === id)) s = shiftWater(s, log, -1)
      }
      setSummary(s)
    }
    if (foodRes.status === 'fulfilled') setFoodLogs(foodRes.value.filter(f => !pendingFood.current.has(f.id)))
    if (waterRes.status === 'fulfilled') setWaterLogs(waterRes.value.filter(w => !pendingWater.current.has(w.id)))
    if (runRes.status === 'fulfilled') setRunLogs(runRes.value.filter(r => !pendingRuns.current.has(r.id)))
    if (weekStepRes.status === 'fulfilled') setWeeklySteps(weekStepRes.value)
    if (workoutRes.status === 'fulfilled') setWeeklyWorkouts(workoutRes.value)

    const settled: PromiseSettledResult<unknown>[] = [
      summaryRes, foodRes, waterRes, runRes, weekStepRes, workoutRes,
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
  // Saved foods load here only: their mutations below update local state.
  const bootstrap = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const userData = await api.registerUser()
      setUser(userData)
      const [savedRes] = await Promise.allSettled([api.getSavedFoods(), refresh()])
      if (savedRes.status === 'fulfilled') setSavedFoods(savedRes.value)
      else {
        console.error('Failed to load saved foods:', savedRes.reason)
        setRefreshError(errorMessage(savedRes.reason, 'Some data could not be refreshed'))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [refresh])

  useEffect(() => {
    bootstrap()
  }, [bootstrap])

  // Current lists for the undo paths, read without re-creating callbacks.
  const foodRef = useRef(foodLogs); foodRef.current = foodLogs
  const waterRef = useRef(waterLogs); waterRef.current = waterLogs
  const runRef = useRef(runLogs); runRef.current = runLogs
  const savedRef = useRef(savedFoods); savedRef.current = savedFoods

  /**
   * Server delete, then a refresh. `settle` clears the pending mark first, so on
   * failure the refresh brings the row back (and the toast says so).
   */
  const commitDelete = useCallback((run: () => Promise<unknown>, what: string, settle: () => void, onFail?: () => void) => {
    run()
      .catch(err => { onFail?.(); toast(errorMessage(err, `Couldn't delete that ${what}. It's back in your list.`)) })
      .finally(() => { settle(); refresh() })
  }, [refresh])

  const logFood = useCallback(async (data: FoodLogCreate) => {
    const log = await api.logFood(data)
    await refresh()
    return log
  }, [refresh])

  const deleteFood = useCallback(async (id: number, opts?: DeleteOpts) => {
    if (opts?.undoable === false) { await api.deleteFood(id); await refresh(); return }
    const log = foodRef.current.find(f => f.id === id)
    if (log) {
      pendingFood.current.set(id, log)
      setFoodLogs(prev => prev.filter(f => f.id !== id))
      setSummary(s => shiftFood(s, log, -1))
    }
    deferWithUndo({
      message: log ? `Deleted ${log.food_name}` : 'Meal deleted',
      commit: () => commitDelete(() => api.deleteFood(id), 'meal', () => pendingFood.current.delete(id), opts?.onFail),
      undo: () => {
        pendingFood.current.delete(id)
        if (log) {
          setFoodLogs(prev => (prev.some(f => f.id === id) ? prev : [...prev, log].sort(byNewest)))
          setSummary(s => shiftFood(s, log, 1))
        }
        opts?.onUndo?.()
      },
    })
  }, [refresh, commitDelete])

  const logWater = useCallback(async (data: WaterLogCreate) => {
    const log = await api.logWater(data)
    await refresh()
    return log
  }, [refresh])

  const deleteWater = useCallback(async (id: number, opts?: DeleteOpts) => {
    if (opts?.undoable === false) { await api.deleteWater(id); await refresh(); return }
    const log = waterRef.current.find(w => w.id === id)
    if (log) {
      pendingWater.current.set(id, log)
      setWaterLogs(prev => prev.filter(w => w.id !== id))
      setSummary(s => shiftWater(s, log, -1))
    }
    deferWithUndo({
      message: log ? `Deleted ${log.amount_liters.toFixed(1)} L water` : 'Water deleted',
      commit: () => commitDelete(() => api.deleteWater(id), 'water entry', () => pendingWater.current.delete(id), opts?.onFail),
      undo: () => {
        pendingWater.current.delete(id)
        if (log) {
          setWaterLogs(prev => (prev.some(w => w.id === id) ? prev : [...prev, log].sort(byNewest)))
          setSummary(s => shiftWater(s, log, 1))
        }
        opts?.onUndo?.()
      },
    })
  }, [refresh, commitDelete])

  const updateGoals = useCallback(async (data: GoalsUpdate) => {
    await api.updateGoals(data)
    await refreshUser()
    await refresh()
  }, [refresh, refreshUser])

  const updatePersonal = useCallback(async (data: PersonalUpdate) => {
    await api.updatePersonal(data)
    await refreshUser()
    await refresh()
  }, [refresh, refreshUser])

  const saveFood = useCallback(async (data: SavedFoodCreate): Promise<SavedFood> => {
    const saved = await api.saveFood(data)
    setSavedFoods(prev => [...prev, saved].sort((a, b) => a.name.localeCompare(b.name)))
    return saved
  }, [])

  const updateSavedFood = useCallback(async (id: number, data: Partial<SavedFoodCreate>) => {
    const updated = await api.updateSavedFood(id, data)
    setSavedFoods(prev => prev.map(f => f.id === id ? updated : f).sort((a, b) => a.name.localeCompare(b.name)))
  }, [])

  const deleteSavedFood = useCallback(async (id: number, opts?: DeleteOpts) => {
    if (opts?.undoable === false) {
      await api.deleteSavedFood(id)
      setSavedFoods(prev => prev.filter(f => f.id !== id))
      return
    }
    const food = savedRef.current.find(f => f.id === id)
    setSavedFoods(prev => prev.filter(f => f.id !== id))
    deferWithUndo({
      message: food ? `Removed ${food.name} from saved foods` : 'Saved food removed',
      commit: () => {
        api.deleteSavedFood(id).catch(err => {
          toast(errorMessage(err, "Couldn't remove that saved food. It's back in your list."))
          if (food) setSavedFoods(prev => [...prev, food].sort((a, b) => a.name.localeCompare(b.name)))
        })
      },
      undo: () => {
        if (food) setSavedFoods(prev => [...prev, food].sort((a, b) => a.name.localeCompare(b.name)))
        opts?.onUndo?.()
      },
    })
  }, [])

  const logRunAction = useCallback(async (data: RunLogCreate) => {
    const run = await api.logRun(data)
    await refresh()
    return run
  }, [refresh])

  const deleteRunAction = useCallback(async (id: number, opts?: DeleteOpts) => {
    if (opts?.undoable === false) { await api.deleteRun(id); await refresh(); return }
    const run = runRef.current.find(r => r.id === id)
    pendingRuns.current.add(id)
    if (run) setRunLogs(prev => prev.filter(r => r.id !== id))
    deferWithUndo({
      message: 'Run deleted',
      commit: () => commitDelete(() => api.deleteRun(id), 'run', () => pendingRuns.current.delete(id), opts?.onFail),
      undo: () => {
        pendingRuns.current.delete(id)
        if (run) setRunLogs(prev => (prev.some(r => r.id === id) ? prev : [run, ...prev]))
        opts?.onUndo?.()
      },
    })
  }, [refresh, commitDelete])

  const toggleRunAllowanceAction = useCallback(async (id: number, added: boolean) => {
    await api.toggleRunAllowance(id, added)
    await refresh()
  }, [refresh])

  const todaySteps = weeklySteps.find(s => s.date.slice(0, 10) === dayKey())?.steps ?? 0

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
