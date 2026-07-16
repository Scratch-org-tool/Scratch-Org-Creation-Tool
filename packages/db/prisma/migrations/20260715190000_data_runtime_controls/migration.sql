ALTER TABLE "DataMovement"
  ADD COLUMN "operation" TEXT NOT NULL DEFAULT 'insert',
  ADD COLUMN "externalIdField" TEXT,
  ADD COLUMN "idempotent" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "rollbackArtifact" JSONB,
  ADD COLUMN "rollbackReport" JSONB;

ALTER TABLE "DataDeployBatch"
  ADD COLUMN "objectKey" TEXT,
  ADD COLUMN "dependsOn" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "operation" TEXT NOT NULL DEFAULT 'insert',
  ADD COLUMN "externalIdField" TEXT,
  ADD COLUMN "idempotent" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "maxParallelChunks" INTEGER NOT NULL DEFAULT 4,
  ADD COLUMN "quotaRemaining" INTEGER,
  ADD COLUMN "quotaConfidence" TEXT NOT NULL DEFAULT 'unknown',
  ADD COLUMN "boundaryArtifact" JSONB,
  ADD COLUMN "rollbackPolicy" TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN "rollbackArtifact" JSONB,
  ADD COLUMN "rollbackReport" JSONB,
  ADD COLUMN "rollbackStatus" TEXT;

ALTER TABLE "DataDeployChunk"
  ADD COLUMN "errorDetails" JSONB;

CREATE INDEX "DataDeployBatch_groupId_objectKey_idx"
  ON "DataDeployBatch"("groupId", "objectKey");
