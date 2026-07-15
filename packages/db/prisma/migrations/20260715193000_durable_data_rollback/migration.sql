ALTER TABLE "DataMovement"
  ADD COLUMN "rollbackStatus" TEXT;

CREATE TABLE "DataRollbackArtifact" (
    "id" TEXT NOT NULL,
    "movementId" TEXT NOT NULL,
    "ciphertext" BYTEA NOT NULL,
    "algorithm" TEXT NOT NULL DEFAULT 'aes-256-gcm+gzip',
    "iv" TEXT NOT NULL,
    "authTag" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "compressedBytes" INTEGER NOT NULL,
    "uncompressedBytes" INTEGER NOT NULL,
    "previousCount" INTEGER NOT NULL,
    "insertedCount" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DataRollbackArtifact_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DataRollbackArtifact_movementId_key"
  ON "DataRollbackArtifact"("movementId");
CREATE INDEX "DataRollbackArtifact_expiresAt_idx"
  ON "DataRollbackArtifact"("expiresAt");

ALTER TABLE "DataRollbackArtifact"
  ADD CONSTRAINT "DataRollbackArtifact_movementId_fkey"
  FOREIGN KEY ("movementId") REFERENCES "DataMovement"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
