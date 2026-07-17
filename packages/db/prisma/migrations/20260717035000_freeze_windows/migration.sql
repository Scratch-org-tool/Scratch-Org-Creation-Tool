-- Deployment freeze windows: block metadata deployments to covered orgs while
-- a window is active. Empty orgConnectionIds = freeze every org.

CREATE TABLE "FreezeWindow" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "reason" TEXT,
    "orgConnectionIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT NOT NULL DEFAULT 'system',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FreezeWindow_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FreezeWindow_enabled_startAt_endAt_idx"
    ON "FreezeWindow"("enabled", "startAt", "endAt");
