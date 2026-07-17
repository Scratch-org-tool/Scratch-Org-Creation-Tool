-- Outbound Slack / Microsoft Teams notification webhooks. URLs are encrypted
-- at rest (AES-256-GCM via the shared crypto util); empty categories = all.

CREATE TABLE "NotificationChannelWebhook" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "encryptedUrl" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "categories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdBy" TEXT NOT NULL DEFAULT 'system',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastSuccessAt" TIMESTAMP(3),
    "lastErrorAt" TIMESTAMP(3),
    "lastError" TEXT,

    CONSTRAINT "NotificationChannelWebhook_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "NotificationChannelWebhook_enabled_idx"
    ON "NotificationChannelWebhook"("enabled");
