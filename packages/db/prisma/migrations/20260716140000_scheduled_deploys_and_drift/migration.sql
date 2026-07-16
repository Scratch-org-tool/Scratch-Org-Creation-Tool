-- Scheduled/automated deployments and org drift monitoring.
-- DeploymentPlan gains a structured schedule + claim columns; DriftMonitor and
-- DriftSnapshot back the drift monitoring feature. All schedule times are UTC.

-- DeploymentPlan: automation schedule + atomic-claim bookkeeping.
ALTER TABLE "DeploymentPlan"
    ADD COLUMN "schedule" JSONB,
    ADD COLUMN "scheduleEnabled" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "nextRunAt" TIMESTAMP(3),
    ADD COLUMN "lastScheduledRunAt" TIMESTAMP(3);

CREATE INDEX "DeploymentPlan_scheduleEnabled_nextRunAt_idx"
    ON "DeploymentPlan"("scheduleEnabled", "nextRunAt");

-- DeploymentPlanRun: run history for manual and scheduled executions.
CREATE TABLE "DeploymentPlanRun" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "trigger" TEXT NOT NULL DEFAULT 'manual',
    "status" TEXT NOT NULL DEFAULT 'started',
    "planType" TEXT,
    "jobId" TEXT,
    "automationRunId" TEXT,
    "error" TEXT,
    "createdBy" TEXT NOT NULL DEFAULT 'system',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "DeploymentPlanRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DeploymentPlanRun_planId_startedAt_idx"
    ON "DeploymentPlanRun"("planId", "startedAt");

ALTER TABLE "DeploymentPlanRun"
    ADD CONSTRAINT "DeploymentPlanRun_planId_fkey"
    FOREIGN KEY ("planId") REFERENCES "DeploymentPlan"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- DriftMonitor: recurring source-vs-target comparison configuration.
CREATE TABLE "DriftMonitor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sourceOrgId" TEXT NOT NULL,
    "targetOrgId" TEXT NOT NULL,
    "metadataTypes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "schedule" JSONB,
    "scheduleEnabled" BOOLEAN NOT NULL DEFAULT false,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "notifyOnDrift" BOOLEAN NOT NULL DEFAULT true,
    "nextRunAt" TIMESTAMP(3),
    "lastCheckedAt" TIMESTAMP(3),
    "lastStatus" TEXT,
    "lastDriftCount" INTEGER,
    "createdBy" TEXT NOT NULL DEFAULT 'system',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DriftMonitor_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DriftMonitor_createdBy_idx" ON "DriftMonitor"("createdBy");
CREATE INDEX "DriftMonitor_scheduleEnabled_nextRunAt_idx"
    ON "DriftMonitor"("scheduleEnabled", "nextRunAt");

-- DriftSnapshot: one drift check result; only differing components are stored.
CREATE TABLE "DriftSnapshot" (
    "id" TEXT NOT NULL,
    "monitorId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'clean',
    "trigger" TEXT NOT NULL DEFAULT 'schedule',
    "totalDifferences" INTEGER NOT NULL DEFAULT 0,
    "added" INTEGER NOT NULL DEFAULT 0,
    "changed" INTEGER NOT NULL DEFAULT 0,
    "removed" INTEGER NOT NULL DEFAULT 0,
    "byType" JSONB,
    "items" JSONB,
    "newlyDrifted" JSONB,
    "error" TEXT,
    "createdBy" TEXT NOT NULL DEFAULT 'system',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DriftSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DriftSnapshot_monitorId_createdAt_idx"
    ON "DriftSnapshot"("monitorId", "createdAt");

ALTER TABLE "DriftSnapshot"
    ADD CONSTRAINT "DriftSnapshot_monitorId_fkey"
    FOREIGN KEY ("monitorId") REFERENCES "DriftMonitor"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
