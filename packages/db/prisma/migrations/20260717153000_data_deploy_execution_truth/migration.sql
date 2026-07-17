ALTER TABLE "DataDeployBatch"
  ADD COLUMN "requestedRecords" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "plannerJobId" TEXT;

UPDATE "DataDeployBatch"
SET "requestedRecords" = "totalRecords"
WHERE "requestedRecords" = 0;

ALTER TABLE "DataDeployChunk"
  ADD COLUMN "processedRecords" INTEGER,
  ADD COLUMN "failedRecords" INTEGER;
