-- User-defined SOQL query templates for data seeding — the generic
-- alternative to the built-in CONA templates.

CREATE TABLE "DataQueryTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "objectName" TEXT NOT NULL,
    "soqlTemplate" TEXT NOT NULL,
    "variables" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "shared" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT NOT NULL DEFAULT 'system',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DataQueryTemplate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DataQueryTemplate_createdBy_name_key"
    ON "DataQueryTemplate"("createdBy", "name");
CREATE INDEX "DataQueryTemplate_shared_idx" ON "DataQueryTemplate"("shared");
