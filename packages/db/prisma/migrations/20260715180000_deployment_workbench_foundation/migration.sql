-- Additive, planning-only Deployment Workbench persistence. Existing
-- Deployment rows and execution paths are intentionally untouched.
CREATE TABLE "DeploymentQualityRun" (
    "id" TEXT NOT NULL,
    "deploymentId" TEXT,
    "name" TEXT,
    "description" TEXT,
    "source" JSONB NOT NULL,
    "targetOrgId" TEXT NOT NULL,
    "targetProfile" TEXT NOT NULL,
    "strategy" TEXT NOT NULL,
    "components" JSONB NOT NULL,
    "manifestXml" TEXT,
    "apiVersion" TEXT,
    "destructiveSelections" JSONB NOT NULL,
    "dependencyPolicy" JSONB NOT NULL,
    "chainedData" JSONB,
    "policySnapshot" JSONB NOT NULL,
    "stagePlan" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'planned',
    "currentStage" TEXT,
    "summary" JSONB,
    "artifacts" JSONB,
    "validationId" TEXT,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectedBy" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdBy" TEXT NOT NULL DEFAULT 'system',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeploymentQualityRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DeploymentQualityStage" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "summary" JSONB,
    "artifacts" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeploymentQualityStage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DeploymentQualityIssue" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "stageId" TEXT,
    "engine" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "component" TEXT,
    "file" TEXT,
    "line" INTEGER,
    "column" INTEGER,
    "fingerprint" TEXT,
    "helpUrl" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeploymentQualityIssue_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DeploymentQualityTestResult" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "stageId" TEXT,
    "className" TEXT NOT NULL,
    "methodName" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "durationMs" INTEGER,
    "message" TEXT,
    "stackTrace" TEXT,
    "diagnostics" JSONB,
    "coverage" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeploymentQualityTestResult_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DeploymentQualityAudit" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeploymentQualityAudit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DeploymentQualityRun_createdBy_createdAt_idx"
    ON "DeploymentQualityRun"("createdBy", "createdAt");
CREATE INDEX "DeploymentQualityRun_targetOrgId_status_idx"
    ON "DeploymentQualityRun"("targetOrgId", "status");
CREATE INDEX "DeploymentQualityRun_deploymentId_idx"
    ON "DeploymentQualityRun"("deploymentId");
CREATE INDEX "DeploymentQualityRun_validationId_idx"
    ON "DeploymentQualityRun"("validationId");

CREATE UNIQUE INDEX "DeploymentQualityStage_runId_key_key"
    ON "DeploymentQualityStage"("runId", "key");
CREATE UNIQUE INDEX "DeploymentQualityStage_runId_ordinal_key"
    ON "DeploymentQualityStage"("runId", "ordinal");
CREATE INDEX "DeploymentQualityStage_runId_status_idx"
    ON "DeploymentQualityStage"("runId", "status");

CREATE INDEX "DeploymentQualityIssue_runId_severity_idx"
    ON "DeploymentQualityIssue"("runId", "severity");
CREATE INDEX "DeploymentQualityIssue_stageId_idx"
    ON "DeploymentQualityIssue"("stageId");
CREATE INDEX "DeploymentQualityIssue_engine_ruleId_idx"
    ON "DeploymentQualityIssue"("engine", "ruleId");

CREATE INDEX "DeploymentQualityTestResult_runId_status_idx"
    ON "DeploymentQualityTestResult"("runId", "status");
CREATE INDEX "DeploymentQualityTestResult_stageId_idx"
    ON "DeploymentQualityTestResult"("stageId");
CREATE INDEX "DeploymentQualityTestResult_className_idx"
    ON "DeploymentQualityTestResult"("className");

CREATE INDEX "DeploymentQualityAudit_runId_createdAt_idx"
    ON "DeploymentQualityAudit"("runId", "createdAt");
CREATE INDEX "DeploymentQualityAudit_actorId_createdAt_idx"
    ON "DeploymentQualityAudit"("actorId", "createdAt");

ALTER TABLE "DeploymentQualityRun"
    ADD CONSTRAINT "DeploymentQualityRun_deploymentId_fkey"
    FOREIGN KEY ("deploymentId") REFERENCES "Deployment"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DeploymentQualityStage"
    ADD CONSTRAINT "DeploymentQualityStage_runId_fkey"
    FOREIGN KEY ("runId") REFERENCES "DeploymentQualityRun"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DeploymentQualityIssue"
    ADD CONSTRAINT "DeploymentQualityIssue_runId_fkey"
    FOREIGN KEY ("runId") REFERENCES "DeploymentQualityRun"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeploymentQualityIssue"
    ADD CONSTRAINT "DeploymentQualityIssue_stageId_fkey"
    FOREIGN KEY ("stageId") REFERENCES "DeploymentQualityStage"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DeploymentQualityTestResult"
    ADD CONSTRAINT "DeploymentQualityTestResult_runId_fkey"
    FOREIGN KEY ("runId") REFERENCES "DeploymentQualityRun"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeploymentQualityTestResult"
    ADD CONSTRAINT "DeploymentQualityTestResult_stageId_fkey"
    FOREIGN KEY ("stageId") REFERENCES "DeploymentQualityStage"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DeploymentQualityAudit"
    ADD CONSTRAINT "DeploymentQualityAudit_runId_fkey"
    FOREIGN KEY ("runId") REFERENCES "DeploymentQualityRun"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
