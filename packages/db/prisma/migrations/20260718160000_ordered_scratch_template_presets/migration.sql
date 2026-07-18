-- Replace the race-prone unnamed system rows with keyed, ordered presets.
-- User-owned templates and historical pipeline snapshots are unaffected.

ALTER TABLE "ScratchPipelineTemplate"
    ADD COLUMN "systemKey" TEXT,
    ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- The previous module bootstrap could insert the same CONA default once per
-- API worker. Those rows were immutable, so remove them before the new keyed
-- presets are bootstrapped.
DELETE FROM "ScratchPipelineTemplate"
WHERE "isSystem" = true;

CREATE UNIQUE INDEX "ScratchPipelineTemplate_systemKey_key"
    ON "ScratchPipelineTemplate"("systemKey");

ALTER TABLE "ScratchPipelineTemplate"
    ADD CONSTRAINT "ScratchPipelineTemplate_system_key_check"
    CHECK (
        ("isSystem" = true AND "systemKey" IS NOT NULL)
        OR ("isSystem" = false AND "systemKey" IS NULL)
    );

