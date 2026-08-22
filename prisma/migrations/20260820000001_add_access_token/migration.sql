-- users.access_token (Shortcut/step-sync bearer token) was added to schema.prisma
-- without a migration (applied to the live DB via `db push`). This migration makes
-- the migration history complete; IF NOT EXISTS keeps it a no-op on databases that
-- already have the column.

-- AlterTable
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "access_token" VARCHAR(64);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "users_access_token_key" ON "users"("access_token");
