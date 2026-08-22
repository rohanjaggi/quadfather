-- Two model ids in src/lib/models.ts were renamed to their current public ids:
--   claude-sonnet-4-6-20260320        -> claude-sonnet-4-6
--   anthropic/claude-haiku-4-5-20251001 -> anthropic/claude-haiku-4.5
-- users.ai_model stores whatever id was picked at the time, so rows still
-- holding an old id would send a now-unknown model to the provider and fail.
-- This backfills them onto the current ids.

UPDATE "users" SET "ai_model" = 'claude-sonnet-4-6' WHERE "ai_model" = 'claude-sonnet-4-6-20260320';
UPDATE "users" SET "ai_model" = 'anthropic/claude-haiku-4.5' WHERE "ai_model" = 'anthropic/claude-haiku-4-5-20251001';
