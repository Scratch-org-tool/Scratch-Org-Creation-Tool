ALTER TABLE "AutomationRun"
  ADD COLUMN IF NOT EXISTS "launchMode" TEXT NOT NULL DEFAULT 'create_new',
  ADD COLUMN IF NOT EXISTS "targetOrgConnectionId" TEXT;

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

-- A scratch target can have only one active pipeline. Terminal runs remain
-- unrestricted so the same org can be configured again later.
CREATE UNIQUE INDEX IF NOT EXISTS "AutomationRun_active_scratch_target_key"
  ON "AutomationRun"("targetOrgConnectionId")
  WHERE "targetOrgConnectionId" IS NOT NULL
    AND "launchMode" = 'configure_existing'
    AND "status"::text IN ('pending', 'queued', 'planning', 'running', 'paused');
