-- progress_snapshots.best_weight_improved_at — the date the *weight* record
-- (best_weight / best_weight_reps) last moved.
--
-- `last_improved_at` moves whenever any of {e1RM, weight, reps} improves, but
-- `/api/workouts/prs` renders every row as a weight PR valued
-- `best_weight × best_weight_reps` and dated `last_improved_at`. So a session
-- that only improved the estimated 1RM (90kg × 12 beating a 102.5kg × 6 e1RM)
-- made the PR list claim a "102.5kg weight PR" happened on the 90kg day — and
-- pulled a stale weight record back into the 7-day window. This column is the
-- weight record's own clock; `last_improved_at` stays the e1RM/stall clock that
-- `sessions_since_improvement` is derived from.
--
-- Re-runnable (IF NOT EXISTS + a guarded backfill) like the migrations before
-- it, for databases already brought forward with `db push`.

-- AlterTable
ALTER TABLE "progress_snapshots" ADD COLUMN IF NOT EXISTS "best_weight_improved_at" TIMESTAMP(3);

-- Backfill: best-effort seed from `last_improved_at` so existing rows keep
-- showing a date in the PR list instead of going blank until the next weight
-- PR. It can be wrong by exactly the bug above (an e1RM-only improvement),
-- which is the best that is recoverable without replaying every ExerciseLog;
-- deleting a workout re-derives the true value via
-- `recomputeSnapshotsForExercises`. Gated on IS NULL so a re-run cannot
-- overwrite a genuine date written since.
UPDATE "progress_snapshots"
   SET "best_weight_improved_at" = "last_improved_at"
 WHERE "best_weight_improved_at" IS NULL;
