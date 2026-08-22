-- Baseline migration (generated 2026-08-20 with `prisma migrate diff --from-empty` against the schema as of commit c2aadc1 minus the ai_model column, i.e. the DB state immediately before 20260527000000_add_ai_model).
--
-- On an existing database the preferred move is still to mark it applied
-- without running it: npx prisma migrate resolve --applied 0_init
--
-- Every statement below is nonetheless idempotent (IF NOT EXISTS on tables and
-- indexes, pg_constraint guards on the foreign keys), so it is now safe either
-- way: a `migrate deploy` that runs this before anyone got round to the
-- `resolve` succeeds against an already-populated database instead of failing
-- on "relation already exists" and leaving the migration chain wedged in a
-- failed state.

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE IF NOT EXISTS "users" (
    "id" SERIAL NOT NULL,
    "telegram_id" BIGINT NOT NULL,
    "username" VARCHAR(50),
    "daily_protein_goal" DOUBLE PRECISION NOT NULL DEFAULT 120.0,
    "daily_calorie_goal" DOUBLE PRECISION NOT NULL DEFAULT 2000.0,
    "daily_water_goal" DOUBLE PRECISION NOT NULL DEFAULT 3.0,
    "water_bottle_size" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "daily_carbs_goal" DOUBLE PRECISION NOT NULL DEFAULT 200.0,
    "daily_fats_goal" DOUBLE PRECISION NOT NULL DEFAULT 65.0,
    "daily_fiber_goal" DOUBLE PRECISION NOT NULL DEFAULT 30.0,
    "ai_provider" VARCHAR(20),
    "ai_api_key" TEXT,
    "sex" VARCHAR(10),
    "weight_kg" DOUBLE PRECISION,
    "height_cm" DOUBLE PRECISION,
    "age" INTEGER,
    "activity_level" VARCHAR(20),
    "fitness_goal" VARCHAR(20),
    "dietary_restrictions" TEXT,
    "ai_features_enabled" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "saved_foods" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "image_path" VARCHAR(255),
    "calories" DOUBLE PRECISION NOT NULL,
    "protein" DOUBLE PRECISION NOT NULL,
    "carbohydrates" DOUBLE PRECISION NOT NULL,
    "fats" DOUBLE PRECISION NOT NULL,
    "fiber" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "serving_label" VARCHAR(100),
    "source" VARCHAR(20) DEFAULT 'gemini',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_foods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "food_logs" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "saved_food_id" INTEGER,
    "food_name" VARCHAR(100),
    "raw_text_input" TEXT,
    "image_path" VARCHAR(255),
    "servings" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "calories" DOUBLE PRECISION,
    "protein" DOUBLE PRECISION,
    "carbohydrates" DOUBLE PRECISION,
    "fats" DOUBLE PRECISION,
    "fiber" DOUBLE PRECISION DEFAULT 0.0,
    "source" VARCHAR(20) DEFAULT 'gemini',
    "logged_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "food_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "water_logs" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "amount_liters" DOUBLE PRECISION NOT NULL,
    "bottles" DOUBLE PRECISION,
    "water_bottle_size" DOUBLE PRECISION,
    "logged_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "water_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "run_logs" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "distance_meters" DOUBLE PRECISION NOT NULL,
    "duration_seconds" INTEGER NOT NULL,
    "calories_burned" DOUBLE PRECISION NOT NULL,
    "pace_per_km" DOUBLE PRECISION,
    "average_heartrate" DOUBLE PRECISION,
    "elevation_gain" DOUBLE PRECISION,
    "name" VARCHAR(200),
    "source" VARCHAR(20) NOT NULL DEFAULT 'manual',
    "added_to_allowance" BOOLEAN NOT NULL DEFAULT false,
    "run_date" TIMESTAMP(3) NOT NULL,
    "logged_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "run_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "users_telegram_id_key" ON "users"("telegram_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "saved_foods_user_id_idx" ON "saved_foods"("user_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "saved_foods_name_idx" ON "saved_foods"("name");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "saved_foods_user_id_name_key" ON "saved_foods"("user_id", "name");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "food_logs_user_id_idx" ON "food_logs"("user_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "food_logs_saved_food_id_idx" ON "food_logs"("saved_food_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "water_logs_user_id_idx" ON "water_logs"("user_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "run_logs_user_id_run_date_idx" ON "run_logs"("user_id", "run_date");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "run_logs_user_id_logged_at_idx" ON "run_logs"("user_id", "logged_at");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'saved_foods_user_id_fkey'
       AND conrelid = 'saved_foods'::regclass
  ) THEN
    ALTER TABLE "saved_foods" ADD CONSTRAINT "saved_foods_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'food_logs_user_id_fkey'
       AND conrelid = 'food_logs'::regclass
  ) THEN
    ALTER TABLE "food_logs" ADD CONSTRAINT "food_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'food_logs_saved_food_id_fkey'
       AND conrelid = 'food_logs'::regclass
  ) THEN
    ALTER TABLE "food_logs" ADD CONSTRAINT "food_logs_saved_food_id_fkey" FOREIGN KEY ("saved_food_id") REFERENCES "saved_foods"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'water_logs_user_id_fkey'
       AND conrelid = 'water_logs'::regclass
  ) THEN
    ALTER TABLE "water_logs" ADD CONSTRAINT "water_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'run_logs_user_id_fkey'
       AND conrelid = 'run_logs'::regclass
  ) THEN
    ALTER TABLE "run_logs" ADD CONSTRAINT "run_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;
