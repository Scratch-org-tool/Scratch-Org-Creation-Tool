ALTER TABLE "AutomationRun"
  ADD COLUMN IF NOT EXISTS "launchMode" TEXT NOT NULL DEFAULT 'create_new',
  ADD COLUMN IF NOT EXISTS "targetOrgConnectionId" TEXT;

-- Populate the relational target from legacy checkpoints before reads and
-- uniqueness enforcement switch to the dedicated column. Only UUID-shaped
-- references to a real connection are eligible for the foreign key.
UPDATE "AutomationRun" AS run
SET "targetOrgConnectionId" = run."checkpoint" ->> 'targetOrgConnectionId'
FROM "OrgConnection" AS org
WHERE run."targetOrgConnectionId" IS NULL
  AND jsonb_typeof(run."checkpoint" -> 'targetOrgConnectionId') = 'string'
  AND (run."checkpoint" ->> 'targetOrgConnectionId')
    ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  AND org."id" = run."checkpoint" ->> 'targetOrgConnectionId';

CREATE INDEX IF NOT EXISTS "AutomationRun_targetOrgConnectionId_status_idx"
  ON "AutomationRun"("targetOrgConnectionId", "status");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'AutomationRun_targetOrgConnectionId_fkey'
  ) THEN
    ALTER TABLE "AutomationRun"
      ADD CONSTRAINT "AutomationRun_targetOrgConnectionId_fkey"
      FOREIGN KEY ("targetOrgConnectionId")
      REFERENCES "OrgConnection"("id")
      ON DELETE SET NULL
      ON UPDATE CASCADE;
  END IF;
END $$;

-- Legacy checkpoints were not protected against concurrent target use. Keep
-- the newest active run and terminate older duplicates so index creation is
-- deterministic instead of failing the deployment.
WITH ranked_active_targets AS (
  SELECT
    "id",
    row_number() OVER (
      PARTITION BY "targetOrgConnectionId"
      ORDER BY "createdAt" DESC, "id" DESC
    ) AS target_rank
  FROM "AutomationRun"
  WHERE "targetOrgConnectionId" IS NOT NULL
    AND "intent" = 'scratch_org_pipeline'
    AND "status" IN (
      'pending'::"JobStatus",
      'queued'::"JobStatus",
      'planning'::"JobStatus",
      'running'::"JobStatus",
      'paused'::"JobStatus"
    )
),
superseded_runs AS (
  UPDATE "AutomationRun" AS run
  SET
    "status" = 'failed'::"JobStatus",
    "failedStep" = COALESCE(run."failedStep", 'migration_target_uniqueness'),
    "lastError" = COALESCE(
      run."lastError",
      'Superseded by a newer active pipeline for the same scratch target'
    )
  FROM ranked_active_targets AS ranked
  WHERE run."id" = ranked."id"
    AND ranked.target_rank > 1
  RETURNING run."id"
)
UPDATE "Job" AS job
SET
  "status" = 'cancelled'::"JobStatus",
  "error" = COALESCE(
    job."error",
    'Parent pipeline was superseded by a newer active target run'
  ),
  "finishedAt" = COALESCE(job."finishedAt", CURRENT_TIMESTAMP)
FROM superseded_runs
WHERE job."parentRunId" = superseded_runs."id"
  AND job."status" IN (
    'pending'::"JobStatus",
    'queued'::"JobStatus",
    'planning'::"JobStatus",
    'running'::"JobStatus",
    'paused'::"JobStatus"
  );

-- A scratch target can have only one active pipeline. Terminal runs remain
-- unrestricted so the same org can be configured again later.
DROP INDEX IF EXISTS "AutomationRun_active_scratch_target_key";
CREATE UNIQUE INDEX "AutomationRun_active_scratch_target_key"
  ON "AutomationRun"("targetOrgConnectionId")
  WHERE "targetOrgConnectionId" IS NOT NULL
    AND "intent" = 'scratch_org_pipeline'
    AND "status" IN (
      'pending'::"JobStatus",
      'queued'::"JobStatus",
      'planning'::"JobStatus",
      'running'::"JobStatus",
      'paused'::"JobStatus"
    );
