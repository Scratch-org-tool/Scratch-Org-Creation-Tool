CREATE TABLE "OAuthState" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "appUserId" TEXT NOT NULL,
    "encryptedPayload" TEXT NOT NULL,
    "returnPath" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OAuthState_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GitHubAttachment" (
    "id" TEXT NOT NULL,
    "workItemConnectionId" TEXT NOT NULL,
    "externalProjectId" TEXT NOT NULL,
    "externalItemId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "encryptedBlob" BYTEA NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GitHubAttachment_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "GitHubAttachment_workItemConnectionId_fkey"
      FOREIGN KEY ("workItemConnectionId") REFERENCES "WorkItemConnection"("id")
      ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "OAuthState_tokenHash_key" ON "OAuthState"("tokenHash");
CREATE INDEX "OAuthState_provider_purpose_expiresAt_idx" ON "OAuthState"("provider", "purpose", "expiresAt");
CREATE INDEX "OAuthState_appUserId_consumedAt_idx" ON "OAuthState"("appUserId", "consumedAt");
CREATE INDEX "GitHubAttachment_workItemConnectionId_externalItemId_createdAt_idx"
  ON "GitHubAttachment"("workItemConnectionId", "externalItemId", "createdAt");
CREATE INDEX "GitHubAttachment_createdBy_idx" ON "GitHubAttachment"("createdBy");
