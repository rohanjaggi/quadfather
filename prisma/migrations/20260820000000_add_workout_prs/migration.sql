-- workout_logs.prs stores the PR list computed when the workout is logged.
-- IF NOT EXISTS keeps this a no-op on databases where the column was already
-- applied via `db push` (same reasoning as 20260820000001_add_access_token).

-- AlterTable
ALTER TABLE "workout_logs" ADD COLUMN IF NOT EXISTS "prs" JSONB;
