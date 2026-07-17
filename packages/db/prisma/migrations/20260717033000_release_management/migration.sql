-- Release management: versioned releases grouping deployments and work items,
-- with an approval trail and release notes.

CREATE TABLE "Release" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "targetOrgId" TEXT,
    "releaseNotes" TEXT,
    "notesGeneratedAt" TIMESTAMP(3),
    "scheduledAt" TIMESTAMP(3),
    "releasedAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL DEFAULT 'system',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Release_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Release_name_version_key" ON "Release"("name", "version");
CREATE INDEX "Release_status_idx" ON "Release"("status");
CREATE INDEX "Release_createdBy_idx" ON "Release"("createdBy");

ALTER TABLE "Release"
    ADD CONSTRAINT "Release_targetOrgId_fkey"
    FOREIGN KEY ("targetOrgId") REFERENCES "OrgConnection"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "ReleaseItem" (
    "id" TEXT NOT NULL,
    "releaseId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "deploymentId" TEXT,
    "workItemProvider" TEXT,
    "workItemProjectId" TEXT,
    "workItemExternalId" TEXT,
    "title" TEXT,
    "metadata" JSONB,
    "addedBy" TEXT NOT NULL DEFAULT 'system',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReleaseItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ReleaseItem_releaseId_idx" ON "ReleaseItem"("releaseId");
CREATE INDEX "ReleaseItem_deploymentId_idx" ON "ReleaseItem"("deploymentId");

ALTER TABLE "ReleaseItem"
    ADD CONSTRAINT "ReleaseItem_releaseId_fkey"
    FOREIGN KEY ("releaseId") REFERENCES "Release"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ReleaseApproval" (
    "id" TEXT NOT NULL,
    "releaseId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReleaseApproval_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReleaseApproval_releaseId_actorId_key"
    ON "ReleaseApproval"("releaseId", "actorId");

ALTER TABLE "ReleaseApproval"
    ADD CONSTRAINT "ReleaseApproval_releaseId_fkey"
    FOREIGN KEY ("releaseId") REFERENCES "Release"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
