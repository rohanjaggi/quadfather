-- Index coverage for the hot query paths (review 2026-08-19 §A3 "Cost / performance").
--
-- Index names match what `prisma migrate diff` generates for the schema, so a
-- future `migrate diff` sees no drift. IF NOT EXISTS / IF EXISTS keep this a
-- no-op on databases where the indexes were already applied via `db push`.

-- exercise_logs.exercise_name is the join key for every progress / PR /
-- prediction query (progress.ts, predict.ts, workouts/prs, workouts/[id]).
-- The table has no user_id — the user filter lives on the parent workout_logs
-- row — so a single-column index on the name is the best available here; it
-- turns a full scan across every user's sets into a name lookup.
-- CreateIndex
CREATE INDEX IF NOT EXISTS "exercise_logs_exercise_name_idx" ON "exercise_logs"("exercise_name");

-- FK column, previously unindexed (cascade/SetNull work + Exercise joins).
-- CreateIndex
CREATE INDEX IF NOT EXISTS "exercise_logs_exercise_id_idx" ON "exercise_logs"("exercise_id");

-- FK column, previously unindexed. Also makes template deletion (SetNull) cheap.
-- CreateIndex
CREATE INDEX IF NOT EXISTS "workout_logs_template_id_idx" ON "workout_logs"("template_id");

-- Every food/water read is "this user, this day range" — the existing
-- single-column user_id indexes force a filter over the user's whole history.
-- CreateIndex
CREATE INDEX IF NOT EXISTS "food_logs_user_id_logged_at_idx" ON "food_logs"("user_id", "logged_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "water_logs_user_id_logged_at_idx" ON "water_logs"("user_id", "logged_at");

-- Redundant: step_logs already has UNIQUE (user_id, date), whose btree serves
-- every user_id-prefixed lookup. Pure write/space overhead.
-- DropIndex
DROP INDEX IF EXISTS "step_logs_user_id_idx";
