-- Sandbox refresh management: lifecycle rows per org connection with cadence
-- reminders and post-refresh automation config.

CREATE TABLE "SandboxRefresh" (
    "id" TEXT NOT NULL,
    "orgConnectionId" TEXT NOT NULL,
    "sandboxName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'requested',
    "notes" TEXT,
    "cadenceDays" INTEGER,
    "nextRefreshDueAt" TIMESTAMP(3),
    "postRefreshConfig" JSONB,
    "automationRunId" TEXT,
    "requestedBy" TEXT NOT NULL DEFAULT 'system',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SandboxRefresh_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SandboxRefresh_orgConnectionId_requestedAt_idx"
    ON "SandboxRefresh"("orgConnectionId", "requestedAt");
CREATE INDEX "SandboxRefresh_status_idx" ON "SandboxRefresh"("status");
