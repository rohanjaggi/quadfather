import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeDailyBudget, sumMacros, type BudgetUser } from './budget'

const user = {
  id: 1,
  daily_calorie_goal: 2000,
  activity_level: 'moderately_active',
  weight_kg: 70,
} as BudgetUser

const food = (calories: number, protein = 0) => ({
  calories,
  protein,
  carbohydrates: 10,
  fats: 5,
  fiber: 2,
})

test('sums food totals and remaining', () => {
  const b = computeDailyBudget({
    user,
    foodLogs: [food(500, 30), food(300, 20)],
    runLogs: [],
    workoutLogs: [],
    steps: 0,
  })
  assert.equal(b.food.calories, 800)
  assert.equal(b.food.protein, 50)
  assert.equal(b.food.carbohydrates, 20)
  assert.equal(b.food.fats, 10)
  assert.equal(b.food.fiber, 4)
  assert.equal(b.food.meals_logged, 2)
  assert.equal(b.total_goal, 2000)
  assert.equal(b.remaining, 1200)
})

test('exercise burn is dampened by 50% and rounded', () => {
  const b = computeDailyBudget({
    user,
    foodLogs: [],
    runLogs: [{ calories_burned: 301 }],
    workoutLogs: [{ calories_burned: 200 }],
    steps: 0,
  })
  assert.equal(b.runs_raw, 301)
  assert.equal(b.runs_credit, Math.round(150.5))
  assert.equal(b.workouts_credit, 100)
  assert.equal(b.exercise_burn, b.runs_credit + 100)
  assert.equal(b.total_goal, 2000 + b.exercise_burn)
})

test('run with added_to_allowance=false is not credited; missing flag is', () => {
  const b = computeDailyBudget({
    user,
    foodLogs: [],
    runLogs: [
      { calories_burned: 400, added_to_allowance: false },
      { calories_burned: 200, added_to_allowance: true },
      { calories_burned: 100 },
    ],
    workoutLogs: [],
    steps: 0,
  })
  assert.equal(b.runs_raw, 300)
  assert.equal(b.runs_credit, 150)
})

test('steps above baseline add to the goal', () => {
  const b = computeDailyBudget({ user, foodLogs: [], runLogs: [], workoutLogs: [], steps: 10_000 })
  assert.equal(b.steps_credit, 120) // (10000-7000)*0.04
  assert.equal(b.total_goal, 2120)
  assert.equal(b.steps, 10_000)
})

test('sumMacros totals each macro and treats null as 0', () => {
  const row = (calories: number | null, protein: number | null, fiber: number | null) => ({
    calories, protein, carbohydrates: 10, fats: 1.5, fiber,
  })
  assert.deepEqual(sumMacros([row(100, 5, null), row(null, 2.5, 3)]), {
    calories: 100, protein: 7.5, carbohydrates: 20, fats: 3, fiber: 3,
  })
  assert.deepEqual(sumMacros([]), { calories: 0, protein: 0, carbohydrates: 0, fats: 0, fiber: 0 })
})
