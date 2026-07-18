-- Scratch org renewal automation. A renewal rule tracks one scratch org and,
-- N days before that org expires, replays the original creation pipeline with
-- a fresh alias so a fully configured replacement is ready before expiry.
-- After a successful renewal the rule rolls forward to the replacement org.

CREATE TABLE "ScratchOrgRenewal" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "scratchOrgAlias" TEXT NOT NULL,
    "configSnapshot" JSONB NOT NULL,
    "sourceAutomationRunId" TEXT,
    "daysBeforeExpiry" INTEGER NOT NULL DEFAULT 2,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "nextRunAt" TIMESTAMP(3),
    "trackedExpirationDate" TIMESTAMP(3),
    "activeAutomationRunId" TEXT,
    "activeRunAlias" TEXT,
    "lastRunAt" TIMESTAMP(3),
    "lastRunStatus" TEXT,
    "lastError" TEXT,
    "createdBy" TEXT NOT NULL DEFAULT 'system',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScratchOrgRenewal_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ScratchOrgRenewal_scratchOrgAlias_key"
    ON "ScratchOrgRenewal"("scratchOrgAlias");
CREATE INDEX "ScratchOrgRenewal_createdBy_idx" ON "ScratchOrgRenewal"("createdBy");
CREATE INDEX "ScratchOrgRenewal_enabled_nextRunAt_idx"
    ON "ScratchOrgRenewal"("enabled", "nextRunAt");
CREATE INDEX "ScratchOrgRenewal_activeAutomationRunId_idx"
    ON "ScratchOrgRenewal"("activeAutomationRunId");

-- ScratchOrgRenewalRun: run history for scheduled and manual renewals.
CREATE TABLE "ScratchOrgRenewalRun" (
    "id" TEXT NOT NULL,
    "renewalId" TEXT NOT NULL,
    "trigger" TEXT NOT NULL DEFAULT 'schedule',
    "status" TEXT NOT NULL DEFAULT 'started',
    "sourceAlias" TEXT,
    "newAlias" TEXT,
    "automationRunId" TEXT,
    "error" TEXT,
    "createdBy" TEXT NOT NULL DEFAULT 'system',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "ScratchOrgRenewalRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ScratchOrgRenewalRun_renewalId_startedAt_idx"
    ON "ScratchOrgRenewalRun"("renewalId", "startedAt");

ALTER TABLE "ScratchOrgRenewalRun"
    ADD CONSTRAINT "ScratchOrgRenewalRun_renewalId_fkey"
    FOREIGN KEY ("renewalId") REFERENCES "ScratchOrgRenewal"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
