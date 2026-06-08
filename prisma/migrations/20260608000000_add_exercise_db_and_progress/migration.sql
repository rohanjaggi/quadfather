-- CreateTable
CREATE TABLE "exercises" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "category" VARCHAR(50) NOT NULL,
    "primary_muscles" JSONB NOT NULL,
    "secondary_muscles" JSONB NOT NULL,
    "equipment" VARCHAR(50),

    CONSTRAINT "exercises_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "progress_snapshots" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "exercise_id" INTEGER,
    "exercise_name" VARCHAR(100) NOT NULL,
    "estimated_1rm" DOUBLE PRECISION NOT NULL,
    "best_set_weight" DOUBLE PRECISION NOT NULL,
    "best_set_reps" INTEGER NOT NULL,
    "total_volume_7d" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "last_improved_at" TIMESTAMP(3),
    "sessions_since_improvement" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "progress_snapshots_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "users" ADD COLUMN "training_focus" VARCHAR(20);

-- AlterTable
ALTER TABLE "workout_logs" ADD COLUMN "analysis" JSONB;

-- AlterTable
ALTER TABLE "exercise_logs" ADD COLUMN "exercise_id" INTEGER;

-- CreateIndex
CREATE INDEX "exercises_name_idx" ON "exercises"("name");

-- CreateIndex
CREATE INDEX "exercises_category_idx" ON "exercises"("category");

-- CreateIndex
CREATE UNIQUE INDEX "progress_snapshots_user_id_exercise_name_key" ON "progress_snapshots"("user_id", "exercise_name");

-- CreateIndex
CREATE INDEX "progress_snapshots_user_id_idx" ON "progress_snapshots"("user_id");

-- AddForeignKey
ALTER TABLE "exercise_logs" ADD CONSTRAINT "exercise_logs_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "exercises"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progress_snapshots" ADD CONSTRAINT "progress_snapshots_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progress_snapshots" ADD CONSTRAINT "progress_snapshots_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "exercises"("id") ON DELETE SET NULL ON UPDATE CASCADE;
