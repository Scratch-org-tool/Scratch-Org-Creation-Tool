-- Apex quality dashboard: test run history plus org-wide coverage snapshots.

CREATE TABLE "ApexTestRun" (
    "id" TEXT NOT NULL,
    "orgConnectionId" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "testLevel" TEXT NOT NULL DEFAULT 'RunLocalTests',
    "status" "JobStatus" NOT NULL DEFAULT 'running',
    "outcome" TEXT,
    "testsRan" INTEGER,
    "passing" INTEGER,
    "failing" INTEGER,
    "skipped" INTEGER,
    "testRunCoverage" DOUBLE PRECISION,
    "orgWideCoverage" DOUBLE PRECISION,
    "summary" JSONB,
    "tests" JSONB,
    "error" TEXT,
    "requestedBy" TEXT NOT NULL DEFAULT 'system',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "ApexTestRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ApexTestRun_orgConnectionId_startedAt_idx"
    ON "ApexTestRun"("orgConnectionId", "startedAt");
CREATE INDEX "ApexTestRun_requestedBy_idx" ON "ApexTestRun"("requestedBy");

CREATE TABLE "OrgCoverageSnapshot" (
    "id" TEXT NOT NULL,
    "orgConnectionId" TEXT NOT NULL,
    "percentCovered" DOUBLE PRECISION NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrgCoverageSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OrgCoverageSnapshot_orgConnectionId_capturedAt_idx"
    ON "OrgCoverageSnapshot"("orgConnectionId", "capturedAt");
