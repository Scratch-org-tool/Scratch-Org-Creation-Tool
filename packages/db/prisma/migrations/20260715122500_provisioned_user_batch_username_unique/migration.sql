-- Keep the most useful row if a pre-constraint batch contains duplicate users.
WITH ranked AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "batchId", "username"
      ORDER BY
        CASE "status"::text
          WHEN 'completed' THEN 0
          WHEN 'running' THEN 1
          WHEN 'queued' THEN 2
          WHEN 'pending' THEN 3
          WHEN 'partial' THEN 4
          WHEN 'failed' THEN 5
          ELSE 6
        END,
        ("sfUserId" IS NOT NULL) DESC,
        "createdAt" ASC,
        "id" ASC
    ) AS row_number
  FROM "ProvisionedUser"
)
DELETE FROM "ProvisionedUser"
WHERE "id" IN (
  SELECT "id"
  FROM ranked
  WHERE row_number > 1
);

UPDATE "ProvisioningBatch" AS batch
SET
  "totalRows" = counts.total_rows,
  "successCount" = counts.success_count,
  "failCount" = counts.fail_count
FROM (
  SELECT
    "batchId",
    COUNT(*)::integer AS total_rows,
    COUNT(*) FILTER (WHERE "status"::text = 'completed')::integer AS success_count,
    COUNT(*) FILTER (WHERE "status"::text = 'failed')::integer AS fail_count
  FROM "ProvisionedUser"
  GROUP BY "batchId"
) AS counts
WHERE batch."id" = counts."batchId";

CREATE UNIQUE INDEX IF NOT EXISTS "ProvisionedUser_batchId_username_key"
  ON "ProvisionedUser"("batchId", "username");
