-- OAuth callback browser binding and cryptographic payload erasure.
ALTER TABLE "OAuthState"
  ADD COLUMN IF NOT EXISTS "browserBindingHash" TEXT;
ALTER TABLE "OAuthState"
  ALTER COLUMN "encryptedPayload" DROP NOT NULL;
-- Pre-deployment states have no browser binding and must not remain redeemable.
UPDATE "OAuthState"
SET "consumedAt" = COALESCE("consumedAt", CURRENT_TIMESTAMP),
    "encryptedPayload" = NULL
WHERE "browserBindingHash" IS NULL;

-- Bounded durable attachment retention.
ALTER TABLE "GitHubAttachment"
  ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3);
UPDATE "GitHubAttachment"
SET "expiresAt" = "createdAt" + INTERVAL '90 days'
WHERE "expiresAt" IS NULL;
ALTER TABLE "GitHubAttachment"
  ALTER COLUMN "expiresAt" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "GitHubAttachment_expiresAt_idx"
  ON "GitHubAttachment"("expiresAt");

-- Remove invalid/duplicate legacy bindings before enforcing a canonical non-null key.
DELETE FROM "ProjectBinding"
WHERE "scmConnectionId" IS NULL AND "workItemConnectionId" IS NULL;

WITH ranked AS (
  SELECT "id",
    row_number() OVER (
      PARTITION BY "scmConnectionId", "workItemConnectionId", "externalProjectId", "repositoryId"
      ORDER BY "createdAt", "id"
    ) AS ordinal
  FROM "ProjectBinding"
)
DELETE FROM "ProjectBinding" target
USING ranked
WHERE target."id" = ranked."id" AND ranked.ordinal > 1;

ALTER TABLE "ProjectBinding"
  ADD COLUMN IF NOT EXISTS "bindingKey" TEXT;
UPDATE "ProjectBinding"
SET "bindingKey" =
  length(COALESCE("scmConnectionId", ''))::text || ':' || COALESCE("scmConnectionId", '') || '|' ||
  length(COALESCE("workItemConnectionId", ''))::text || ':' || COALESCE("workItemConnectionId", '') || '|' ||
  length("externalProjectId")::text || ':' || "externalProjectId" || '|' ||
  length(COALESCE("repositoryId", ''))::text || ':' || COALESCE("repositoryId", '')
WHERE "bindingKey" IS NULL;
ALTER TABLE "ProjectBinding"
  ALTER COLUMN "bindingKey" SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "ProjectBinding_bindingKey_key"
  ON "ProjectBinding"("bindingKey");
DROP INDEX IF EXISTS "ProjectBinding_scmConnectionId_workItemConnectionId_externalProjectId_repositoryId_key";
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ProjectBinding_connection_required_check'
  ) THEN
    ALTER TABLE "ProjectBinding"
      ADD CONSTRAINT "ProjectBinding_connection_required_check"
      CHECK ("scmConnectionId" IS NOT NULL OR "workItemConnectionId" IS NOT NULL);
  END IF;
END $$;

-- Preserve each external identity while clearing ambiguous duplicate app-user ownership.
WITH ranked AS (
  SELECT "id",
    row_number() OVER (
      PARTITION BY "workItemConnectionId", "appUserId"
      ORDER BY "updatedAt" DESC, "id"
    ) AS ordinal
  FROM "ExternalIdentityBinding"
  WHERE "appUserId" IS NOT NULL
)
UPDATE "ExternalIdentityBinding" target
SET "appUserId" = NULL
FROM ranked
WHERE target."id" = ranked."id" AND ranked.ordinal > 1;
CREATE UNIQUE INDEX IF NOT EXISTS "ExternalIdentityBinding_connection_app_user_key"
  ON "ExternalIdentityBinding"("workItemConnectionId", "appUserId")
  WHERE "appUserId" IS NOT NULL;

-- Scope provider delivery IDs to the concrete connection.
ALTER TABLE "WebhookDelivery"
  ADD COLUMN IF NOT EXISTS "connectionScope" TEXT;
UPDATE "WebhookDelivery"
SET "connectionScope" = CASE
  WHEN "scmConnectionId" IS NOT NULL THEN 'scm:' || "scmConnectionId"
  WHEN "workItemConnectionId" IS NOT NULL THEN 'work:' || "workItemConnectionId"
  ELSE 'unscoped:' || "id"
END
WHERE "connectionScope" IS NULL;
ALTER TABLE "WebhookDelivery"
  ALTER COLUMN "connectionScope" SET NOT NULL;
DROP INDEX IF EXISTS "WebhookDelivery_provider_externalDeliveryId_key";
CREATE UNIQUE INDEX IF NOT EXISTS "WebhookDelivery_provider_connectionScope_externalDeliveryId_key"
  ON "WebhookDelivery"("provider", "connectionScope", "externalDeliveryId");
