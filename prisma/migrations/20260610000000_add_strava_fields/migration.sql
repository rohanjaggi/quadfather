-- AlterTable
ALTER TABLE "users" ADD COLUMN "strava_athlete_id" BIGINT;
ALTER TABLE "users" ADD COLUMN "strava_access_token" TEXT;
ALTER TABLE "users" ADD COLUMN "strava_refresh_token" TEXT;
ALTER TABLE "users" ADD COLUMN "strava_token_expires" INTEGER;
ALTER TABLE "users" ADD COLUMN "strava_scope" VARCHAR(100);
ALTER TABLE "users" ADD COLUMN "strava_last_synced_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "run_logs" ADD COLUMN "strava_activity_id" BIGINT;

-- CreateIndex
CREATE UNIQUE INDEX "run_logs_strava_activity_id_key" ON "run_logs"("strava_activity_id");
