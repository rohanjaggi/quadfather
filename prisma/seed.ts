import { PrismaClient } from '@prisma/client'
import exercises from './seed-data/exercises.json'

const prisma = new PrismaClient()

async function main() {
  console.log(`Seeding ${exercises.length} exercises...`)

  const existing = await prisma.exercise.count()
  if (existing > 0) {
    console.log(`Already seeded (${existing} exercises exist). Skipping.`)
    return
  }

  await prisma.exercise.createMany({
    data: exercises.map((ex: { name: string; category: string; primary_muscles: string[]; secondary_muscles: string[]; equipment?: string }) => ({
      name: ex.name,
      category: ex.category,
      primary_muscles: ex.primary_muscles,
      secondary_muscles: ex.secondary_muscles,
      equipment: ex.equipment ?? null,
    })),
  })

  console.log(`Seeded ${exercises.length} exercises.`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
