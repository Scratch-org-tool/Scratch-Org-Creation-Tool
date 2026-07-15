-- Non-sensitive authentication audit trail. Request identifiers are hashed by
-- the application before insert; this table must never receive raw secrets.
CREATE TABLE "AuthAuditEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "eventType" TEXT NOT NULL,
    "metadata" JSONB,
    "ipHash" TEXT,
    "userAgentHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthAuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AuthAuditEvent_userId_createdAt_idx"
    ON "AuthAuditEvent"("userId", "createdAt");
CREATE INDEX "AuthAuditEvent_eventType_createdAt_idx"
    ON "AuthAuditEvent"("eventType", "createdAt");
CREATE INDEX "AuthAuditEvent_createdAt_idx"
    ON "AuthAuditEvent"("createdAt");
