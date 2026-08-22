-- Three related schema additions (review 2026-08-19 §A3/§A4):
--   1. strava_ignored_activities — tombstones so a deleted Strava run is not
--      re-imported by the next sync.
--   2. progress_snapshots.best_weight / best_weight_reps — the genuinely
--      heaviest set, so the PR list can stop labelling the best-e1RM set's
--      weight a "weight PR" (77.5×10 beats 80×8 on e1RM but is lighter).
--   3. users.updated_at.
--
-- Written to be re-runnable for databases that were already brought forward
-- with `db push`: IF NOT EXISTS on every DDL statement, a pg_constraint guard
-- on the foreign key, and each data backfill gated so a second run cannot
-- overwrite values written since the first (see the two DO blocks below).

-- CreateTable
CREATE TABLE IF NOT EXISTS "strava_ignored_activities" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "strava_activity_id" BIGINT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "strava_ignored_activities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "strava_ignored_activities_user_id_strava_activity_id_key" ON "strava_ignored_activities"("user_id", "strava_activity_id");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    -- `conname` alone is not unique across the database — constraint names are
    -- only unique per table — so scope the lookup to this table.
    SELECT 1 FROM pg_constraint
     WHERE conname = 'strava_ignored_activities_user_id_fkey'
       AND conrelid = 'strava_ignored_activities'::regclass
  ) THEN
    ALTER TABLE "strava_ignored_activities"
      ADD CONSTRAINT "strava_ignored_activities_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

-- AlterTable
ALTER TABLE "progress_snapshots" ADD COLUMN IF NOT EXISTS "best_weight" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "progress_snapshots" ADD COLUMN IF NOT EXISTS "best_weight_reps" INTEGER NOT NULL DEFAULT 0;

-- Backfill: seed the new weight record from the existing best-e1RM set. It can
-- under-state the true record (that's the bug), but it never over-states it, so
-- the next session at the real record weight registers a PR instead of the
-- column staying at 0 and every future set looking like a PR.
UPDATE "progress_snapshots"
   SET "best_weight" = "best_set_weight",
       "best_weight_reps" = "best_set_reps"
 WHERE "best_weight" = 0;

-- AlterTable
-- `updated_at` is NOT NULL DEFAULT now(), so every pre-existing row is stamped
-- with the moment of the migration. Backfill from `created_at` instead — but
-- only on the run that actually adds the column, or a re-run (or a database
-- already brought forward with `db push`) would rewind every genuine
-- modification timestamp back to the row's creation date.
DO $$
DECLARE
  had_updated_at boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'users'
       AND column_name = 'updated_at'
  ) INTO had_updated_at;

  ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

  IF NOT had_updated_at THEN
    UPDATE "users" SET "updated_at" = COALESCE("created_at", CURRENT_TIMESTAMP);
  END IF;
END
$$;

-- run_logs.added_to_allowance defaulted to false while nothing ever wrote it,
-- so the flag was inert and every run was credited. Now that the budget
-- calculation actually reads it, false-by-default would silently drop all run
-- credit to zero — flip the default and backfill so existing rows keep the
-- behaviour users already see.
--
-- The backfill is a one-shot, gated on the column's *previous* default (hence
-- the read before the SET DEFAULT — order matters here). Once the default is
-- true, `PATCH /api/runs/[id]` is the only thing writing false, and those are
-- deliberate user opt-outs: an unconditional `UPDATE … SET true` on a re-run,
-- or against a database that reached this schema via `db push`, would silently
-- re-credit every run the user had excluded.
-- AlterTable
DO $$
DECLARE
  default_was_false boolean;
BEGIN
  SELECT column_default LIKE 'false%'
    INTO default_was_false
    FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name = 'run_logs'
     AND column_name = 'added_to_allowance';

  ALTER TABLE "run_logs" ALTER COLUMN "added_to_allowance" SET DEFAULT true;

  IF COALESCE(default_was_false, false) THEN
    UPDATE "run_logs" SET "added_to_allowance" = true;
  END IF;
END
$$;
