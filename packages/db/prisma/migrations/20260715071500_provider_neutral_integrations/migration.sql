-- Additive provider-neutral foundation. AzureDevOpsConnection remains authoritative
-- for existing routes while the two backfilled rows reference it for compatibility.
CREATE TYPE "ScmProvider" AS ENUM ('azure_devops', 'github', 'bitbucket');
CREATE TYPE "WorkItemProvider" AS ENUM ('azure_boards', 'github_issues', 'jira');
CREATE TYPE "IntegrationConnectionStatus" AS ENUM ('connected', 'degraded', 'disconnected', 'error');

CREATE TABLE "ScmConnection" (
    "id" TEXT NOT NULL,
    "provider" "ScmProvider" NOT NULL,
    "externalAccountId" TEXT,
    "displayName" TEXT NOT NULL,
    "namespace" TEXT,
    "baseUrl" TEXT,
    "encryptedCredentials" TEXT NOT NULL,
    "status" "IntegrationConnectionStatus" NOT NULL DEFAULT 'connected',
    "capabilities" JSONB,
    "metadata" JSONB,
    "connectedBy" TEXT,
    "legacyAzureDevOpsConnectionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastVerifiedAt" TIMESTAMP(3),
    CONSTRAINT "ScmConnection_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ScmConnection_legacyAzureDevOpsConnectionId_fkey"
      FOREIGN KEY ("legacyAzureDevOpsConnectionId") REFERENCES "AzureDevOpsConnection"("id")
      ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "WorkItemConnection" (
    "id" TEXT NOT NULL,
    "provider" "WorkItemProvider" NOT NULL,
    "externalAccountId" TEXT,
    "displayName" TEXT NOT NULL,
    "namespace" TEXT,
    "baseUrl" TEXT,
    "encryptedCredentials" TEXT NOT NULL,
    "status" "IntegrationConnectionStatus" NOT NULL DEFAULT 'connected',
    "capabilities" JSONB,
    "metadata" JSONB,
    "connectedBy" TEXT,
    "legacyAzureDevOpsConnectionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastVerifiedAt" TIMESTAMP(3),
    CONSTRAINT "WorkItemConnection_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "WorkItemConnection_legacyAzureDevOpsConnectionId_fkey"
      FOREIGN KEY ("legacyAzureDevOpsConnectionId") REFERENCES "AzureDevOpsConnection"("id")
      ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "ProjectBinding" (
    "id" TEXT NOT NULL,
    "scmConnectionId" TEXT,
    "workItemConnectionId" TEXT,
    "externalProjectId" TEXT NOT NULL,
    "projectKey" TEXT,
    "repositoryId" TEXT,
    "repositoryName" TEXT,
    "createdBy" TEXT NOT NULL DEFAULT 'system',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProjectBinding_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ProjectBinding_scmConnectionId_fkey" FOREIGN KEY ("scmConnectionId")
      REFERENCES "ScmConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProjectBinding_workItemConnectionId_fkey" FOREIGN KEY ("workItemConnectionId")
      REFERENCES "WorkItemConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "ExternalIdentityBinding" (
    "id" TEXT NOT NULL,
    "workItemConnectionId" TEXT NOT NULL,
    "appUserId" TEXT,
    "externalUserId" TEXT NOT NULL,
    "externalEmail" TEXT,
    "displayName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ExternalIdentityBinding_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ExternalIdentityBinding_workItemConnectionId_fkey"
      FOREIGN KEY ("workItemConnectionId") REFERENCES "WorkItemConnection"("id")
      ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "WorkItemSnapshot" (
    "id" TEXT NOT NULL,
    "workItemConnectionId" TEXT NOT NULL,
    "externalProjectId" TEXT NOT NULL,
    "externalItemId" TEXT NOT NULL,
    "version" TEXT,
    "state" TEXT,
    "payload" JSONB NOT NULL,
    "providerUpdatedAt" TIMESTAMP(3),
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WorkItemSnapshot_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "WorkItemSnapshot_workItemConnectionId_fkey"
      FOREIGN KEY ("workItemConnectionId") REFERENCES "WorkItemConnection"("id")
      ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "WebhookDelivery" (
    "id" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "externalDeliveryId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'received',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "scmConnectionId" TEXT,
    "workItemConnectionId" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WebhookDelivery_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "WebhookDelivery_scmConnectionId_fkey" FOREIGN KEY ("scmConnectionId")
      REFERENCES "ScmConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "WebhookDelivery_workItemConnectionId_fkey" FOREIGN KEY ("workItemConnectionId")
      REFERENCES "WorkItemConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ScmConnection_legacyAzureDevOpsConnectionId_key" ON "ScmConnection"("legacyAzureDevOpsConnectionId");
CREATE UNIQUE INDEX "ScmConnection_provider_externalAccountId_key" ON "ScmConnection"("provider", "externalAccountId");
CREATE INDEX "ScmConnection_provider_status_idx" ON "ScmConnection"("provider", "status");
CREATE INDEX "ScmConnection_connectedBy_idx" ON "ScmConnection"("connectedBy");
CREATE UNIQUE INDEX "WorkItemConnection_legacyAzureDevOpsConnectionId_key" ON "WorkItemConnection"("legacyAzureDevOpsConnectionId");
CREATE UNIQUE INDEX "WorkItemConnection_provider_externalAccountId_key" ON "WorkItemConnection"("provider", "externalAccountId");
CREATE INDEX "WorkItemConnection_provider_status_idx" ON "WorkItemConnection"("provider", "status");
CREATE INDEX "WorkItemConnection_connectedBy_idx" ON "WorkItemConnection"("connectedBy");
CREATE UNIQUE INDEX "ProjectBinding_scmConnectionId_workItemConnectionId_externalProjectId_repositoryId_key"
  ON "ProjectBinding"("scmConnectionId", "workItemConnectionId", "externalProjectId", "repositoryId");
CREATE INDEX "ProjectBinding_createdBy_idx" ON "ProjectBinding"("createdBy");
CREATE UNIQUE INDEX "ExternalIdentityBinding_workItemConnectionId_externalUserId_key"
  ON "ExternalIdentityBinding"("workItemConnectionId", "externalUserId");
CREATE INDEX "ExternalIdentityBinding_appUserId_idx" ON "ExternalIdentityBinding"("appUserId");
CREATE INDEX "ExternalIdentityBinding_externalEmail_idx" ON "ExternalIdentityBinding"("externalEmail");
CREATE UNIQUE INDEX "WorkItemSnapshot_workItemConnectionId_externalProjectId_externalItemId_key"
  ON "WorkItemSnapshot"("workItemConnectionId", "externalProjectId", "externalItemId");
CREATE INDEX "WorkItemSnapshot_state_idx" ON "WorkItemSnapshot"("state");
CREATE INDEX "WorkItemSnapshot_providerUpdatedAt_idx" ON "WorkItemSnapshot"("providerUpdatedAt");
CREATE UNIQUE INDEX "WebhookDelivery_idempotencyKey_key" ON "WebhookDelivery"("idempotencyKey");
CREATE UNIQUE INDEX "WebhookDelivery_provider_externalDeliveryId_key" ON "WebhookDelivery"("provider", "externalDeliveryId");
CREATE INDEX "WebhookDelivery_status_receivedAt_idx" ON "WebhookDelivery"("status", "receivedAt");

-- The PAT is already encrypted by AzureIntegrationService. Copying the ciphertext
-- avoids decrypting or rotating secrets during migration and leaves the legacy row intact.
INSERT INTO "ScmConnection" (
  "id", "provider", "externalAccountId", "displayName", "namespace", "baseUrl",
  "encryptedCredentials", "status", "capabilities", "metadata", "connectedBy",
  "legacyAzureDevOpsConnectionId", "createdAt", "updatedAt"
)
SELECT
  "id" || '-scm', 'azure_devops'::"ScmProvider", "orgSlug", "orgSlug", "orgSlug",
  'https://dev.azure.com/' || "orgSlug", "pat",
  CASE WHEN "status" = 'active' THEN 'connected'::"IntegrationConnectionStatus"
       ELSE 'disconnected'::"IntegrationConnectionStatus" END,
  '{"repositories":true,"branches":true,"checkout":true,"pipelines":true,"pullRequests":false,"webhooks":false}'::jsonb,
  jsonb_build_object('defaultProject', "project", 'credentialFormat', 'legacy_encrypted_pat'),
  "connectedBy", "id", "createdAt", "updatedAt"
FROM "AzureDevOpsConnection"
ON CONFLICT ("legacyAzureDevOpsConnectionId") DO NOTHING;

INSERT INTO "WorkItemConnection" (
  "id", "provider", "externalAccountId", "displayName", "namespace", "baseUrl",
  "encryptedCredentials", "status", "capabilities", "metadata", "connectedBy",
  "legacyAzureDevOpsConnectionId", "createdAt", "updatedAt"
)
SELECT
  "id" || '-work-items', 'azure_boards'::"WorkItemProvider", "orgSlug", "orgSlug", "orgSlug",
  'https://dev.azure.com/' || "orgSlug", "pat",
  CASE WHEN "status" = 'active' THEN 'connected'::"IntegrationConnectionStatus"
       ELSE 'disconnected'::"IntegrationConnectionStatus" END,
  '{"read":true,"write":true,"webhooks":false,"attachments":true,"history":true,"stateTransitions":true}'::jsonb,
  jsonb_build_object('defaultProject', "project", 'credentialFormat', 'legacy_encrypted_pat'),
  "connectedBy", "id", "createdAt", "updatedAt"
FROM "AzureDevOpsConnection"
ON CONFLICT ("legacyAzureDevOpsConnectionId") DO NOTHING;
