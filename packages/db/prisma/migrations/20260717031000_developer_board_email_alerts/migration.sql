-- Developer Board email alerts: per-user opt-in flag plus a dedupe ledger so
-- webhook-driven work-item notifications never fire twice for one revision.

ALTER TABLE "AppUser"
    ADD COLUMN "emailNotifications" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "WorkItemChangeNotification" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'azure_boards',
    "externalProjectId" TEXT NOT NULL,
    "externalItemId" TEXT NOT NULL,
    "lastRevision" INTEGER,
    "lastChangedDate" TIMESTAMP(3),
    "lastNotifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastEmailAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkItemChangeNotification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkItemChangeNotification_item_key"
    ON "WorkItemChangeNotification"("provider", "externalProjectId", "externalItemId");

CREATE INDEX "WorkItemChangeNotification_lastNotifiedAt_idx"
    ON "WorkItemChangeNotification"("lastNotifiedAt");
