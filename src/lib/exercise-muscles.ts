import exercises from '../../prisma/seed-data/exercises.json'

export const EXERCISE_MUSCLES: Record<string, { primary: string[]; secondary: string[] }> = Object.fromEntries(
  exercises.map(e => [e.name.toLowerCase(), { primary: e.primary_muscles, secondary: e.secondary_muscles }]),
)
