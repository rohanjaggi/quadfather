import { Prisma, PrismaClient } from '@prisma/client'
import exercisesJson from './seed-data/exercises.json'

const prisma = new PrismaClient()

/** How many write operations to send per `$transaction` batch. */
const CHUNK_SIZE = 100

type SeedExercise = {
  name: string
  category: string
  primary_muscles: string[]
  secondary_muscles: string[]
  equipment?: string | null
}

/**
 * `Exercise.name` is not unique in the schema (only `@@index([name])`), so the
 * catalogue is reconciled by name in application code: read the existing rows
 * once, then update the ones that drifted and create the ones that are missing.
 * Re-running is a no-op once the DB matches the JSON.
 */
function sameJson(dbValue: Prisma.JsonValue, seedValue: string[]): boolean {
  return JSON.stringify(dbValue) === JSON.stringify(seedValue)
}

/** Drop case-insensitive duplicate names, keeping the first occurrence. */
function dedupe(entries: SeedExercise[]): SeedExercise[] {
  const seen = new Map<string, SeedExercise>()
  const duplicates: string[] = []

  for (const entry of entries) {
    const key = entry.name.toLowerCase().replace(/\s+/g, ' ').trim()
    if (seen.has(key)) {
      duplicates.push(entry.name)
      continue
    }
    seen.set(key, entry)
  }

  if (duplicates.length > 0) {
    console.warn(
      `WARNING: exercises.json contains ${duplicates.length} case-insensitive duplicate name(s), ` +
        `ignoring: ${duplicates.join(', ')}`
    )
  }

  return [...seen.values()]
}

async function main() {
  const catalogue = dedupe(exercisesJson as SeedExercise[])
  console.log(`Seeding ${catalogue.length} exercises...`)

  const existing = await prisma.exercise.findMany({ orderBy: { id: 'asc' } })

  // Exact-name lookup. If the DB somehow holds several rows with the same name,
  // the lowest id wins and the rest are reported below rather than touched.
  const byName = new Map<string, (typeof existing)[number]>()
  const dbDuplicates: string[] = []
  for (const row of existing) {
    if (byName.has(row.name)) {
      dbDuplicates.push(`${row.name} (id ${row.id})`)
      continue
    }
    byName.set(row.name, row)
  }

  const toCreate: SeedExercise[] = []
  const toUpdate: { id: number; entry: SeedExercise }[] = []

  for (const entry of catalogue) {
    const row = byName.get(entry.name)
    if (!row) {
      toCreate.push(entry)
      continue
    }

    const unchanged =
      row.category === entry.category &&
      (row.equipment ?? null) === (entry.equipment ?? null) &&
      sameJson(row.primary_muscles, entry.primary_muscles) &&
      sameJson(row.secondary_muscles, entry.secondary_muscles)

    if (!unchanged) toUpdate.push({ id: row.id, entry })
  }

  const operations: Prisma.PrismaPromise<unknown>[] = [
    ...toUpdate.map(({ id, entry }) =>
      prisma.exercise.update({
        where: { id },
        data: {
          category: entry.category,
          primary_muscles: entry.primary_muscles,
          secondary_muscles: entry.secondary_muscles,
          equipment: entry.equipment ?? null,
        },
      })
    ),
    ...toCreate.map((entry) =>
      prisma.exercise.create({
        data: {
          name: entry.name,
          category: entry.category,
          primary_muscles: entry.primary_muscles,
          secondary_muscles: entry.secondary_muscles,
          equipment: entry.equipment ?? null,
        },
      })
    ),
  ]

  for (let i = 0; i < operations.length; i += CHUNK_SIZE) {
    await prisma.$transaction(operations.slice(i, i + CHUNK_SIZE))
    console.log(
      `  applied ${Math.min(i + CHUNK_SIZE, operations.length)}/${operations.length} changes`
    )
  }

  // Rows that dropped out of the catalogue are kept: ExerciseLog.exercise_id and
  // ProgressSnapshot.exercise_id may still reference them. Report only.
  const seedNames = new Set(catalogue.map((entry) => entry.name))
  const orphans = existing.filter((row) => !seedNames.has(row.name))

  console.log(
    `Done. created=${toCreate.length} updated=${toUpdate.length} ` +
      `unchanged=${catalogue.length - toCreate.length - toUpdate.length}`
  )

  if (orphans.length > 0) {
    console.log(
      `${orphans.length} catalogue row(s) are no longer in exercises.json (kept, may be referenced by logs):`
    )
    for (const row of orphans) console.log(`  - ${row.name} (id ${row.id})`)
  }

  if (dbDuplicates.length > 0) {
    console.warn(
      `${dbDuplicates.length} duplicate exercise name(s) in the DB were left untouched: ${dbDuplicates.join(', ')}`
    )
  }
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
