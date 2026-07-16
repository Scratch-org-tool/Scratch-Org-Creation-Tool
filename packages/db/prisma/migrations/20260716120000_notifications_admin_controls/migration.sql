-- Admin-controlled notifications. The NotificationSetting "global" row is the
-- single switch that decides whether any notification is created or delivered;
-- notifications are off by default until an administrator enables them.

CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'system',
    "level" TEXT NOT NULL DEFAULT 'info',
    "title" TEXT NOT NULL,
    "body" TEXT,
    "link" TEXT,
    "jobId" TEXT,
    "metadata" JSONB,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Notification_userId_createdAt_idx"
    ON "Notification"("userId", "createdAt");
CREATE INDEX "Notification_userId_readAt_idx"
    ON "Notification"("userId", "readAt");

CREATE TABLE "NotificationSetting" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "channels" JSONB NOT NULL DEFAULT '{"inApp": true, "email": false}',
    "categories" JSONB NOT NULL DEFAULT '{"deployment": true, "data": true, "environment": true, "provisioning": true, "system": true}',
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationSetting_pkey" PRIMARY KEY ("id")
);
