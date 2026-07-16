CREATE TABLE "DeploymentArtifact" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "content" BYTEA NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retainUntil" TIMESTAMP(3),
    CONSTRAINT "DeploymentArtifact_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "DeploymentQualityRun" ADD COLUMN "executionLease" TEXT;

CREATE TABLE "DeploymentQualityApproval" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DeploymentQualityApproval_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DeploymentDestructiveReview" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "digest" TEXT NOT NULL,
    "approved" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DeploymentDestructiveReview_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DeploymentArtifact_kind_createdAt_idx"
    ON "DeploymentArtifact"("kind", "createdAt");
CREATE INDEX "DeploymentArtifact_retainUntil_idx"
    ON "DeploymentArtifact"("retainUntil");
CREATE UNIQUE INDEX "DeploymentQualityApproval_runId_actorId_key"
    ON "DeploymentQualityApproval"("runId", "actorId");
CREATE INDEX "DeploymentQualityApproval_runId_createdAt_idx"
    ON "DeploymentQualityApproval"("runId", "createdAt");
CREATE UNIQUE INDEX "DeploymentDestructiveReview_runId_actorId_digest_key"
    ON "DeploymentDestructiveReview"("runId", "actorId", "digest");
CREATE INDEX "DeploymentDestructiveReview_runId_digest_approved_idx"
    ON "DeploymentDestructiveReview"("runId", "digest", "approved");

ALTER TABLE "DeploymentQualityApproval"
    ADD CONSTRAINT "DeploymentQualityApproval_runId_fkey"
    FOREIGN KEY ("runId") REFERENCES "DeploymentQualityRun"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeploymentDestructiveReview"
    ADD CONSTRAINT "DeploymentDestructiveReview_runId_fkey"
    FOREIGN KEY ("runId") REFERENCES "DeploymentQualityRun"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
