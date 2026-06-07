-- CreateTable
CREATE TABLE "workout_templates" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "exercises" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workout_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workout_logs" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "template_id" INTEGER,
    "name" VARCHAR(200) NOT NULL,
    "duration_minutes" INTEGER,
    "calories_burned" DOUBLE PRECISION,
    "notes" TEXT,
    "source" VARCHAR(20) NOT NULL DEFAULT 'manual',
    "workout_date" TIMESTAMP(3) NOT NULL,
    "logged_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workout_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exercise_logs" (
    "id" SERIAL NOT NULL,
    "workout_log_id" INTEGER NOT NULL,
    "exercise_name" VARCHAR(100) NOT NULL,
    "sets" JSONB NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "exercise_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "step_logs" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "steps" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "source" VARCHAR(20) NOT NULL DEFAULT 'shortcut',
    "logged_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "step_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coach_state" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "last_nudge_topic" VARCHAR(50),
    "last_nudge_at" TIMESTAMP(3),
    "nudge_history" JSONB,

    CONSTRAINT "coach_state_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "workout_templates_user_id_idx" ON "workout_templates"("user_id");

-- CreateIndex
CREATE INDEX "workout_logs_user_id_workout_date_idx" ON "workout_logs"("user_id", "workout_date");

-- CreateIndex
CREATE INDEX "workout_logs_user_id_logged_at_idx" ON "workout_logs"("user_id", "logged_at");

-- CreateIndex
CREATE INDEX "exercise_logs_workout_log_id_idx" ON "exercise_logs"("workout_log_id");

-- CreateIndex
CREATE UNIQUE INDEX "step_logs_user_id_date_key" ON "step_logs"("user_id", "date");

-- CreateIndex
CREATE INDEX "step_logs_user_id_idx" ON "step_logs"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "coach_state_user_id_key" ON "coach_state"("user_id");

-- AddForeignKey
ALTER TABLE "workout_templates" ADD CONSTRAINT "workout_templates_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_logs" ADD CONSTRAINT "workout_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_logs" ADD CONSTRAINT "workout_logs_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "workout_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise_logs" ADD CONSTRAINT "exercise_logs_workout_log_id_fkey" FOREIGN KEY ("workout_log_id") REFERENCES "workout_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "step_logs" ADD CONSTRAINT "step_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coach_state" ADD CONSTRAINT "coach_state_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
