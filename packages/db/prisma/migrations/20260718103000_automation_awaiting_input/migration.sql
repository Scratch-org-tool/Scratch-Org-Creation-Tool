ALTER TYPE "JobStatus" ADD VALUE IF NOT EXISTS 'awaiting_input';

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
      'paused'::"JobStatus",
      'awaiting_input'::"JobStatus"
    );
