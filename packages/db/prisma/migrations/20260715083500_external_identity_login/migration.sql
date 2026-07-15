ALTER TABLE "ExternalIdentityBinding" ADD COLUMN "externalLogin" TEXT;

UPDATE "WorkItemConnection"
SET "capabilities" = COALESCE("capabilities", '{}'::jsonb) ||
  CASE "provider"
    WHEN 'azure_boards' THEN '{"create":true,"update":true,"comments":true,"attachmentUploads":true,"issueTypes":true,"users":false,"labels":false,"subIssues":false}'::jsonb
    WHEN 'github_issues' THEN '{"create":true,"update":true,"comments":true,"attachmentUploads":true,"issueTypes":true,"users":true,"labels":true,"subIssues":true}'::jsonb
    WHEN 'jira' THEN '{"create":true,"update":true,"comments":true,"attachmentUploads":true,"issueTypes":true,"users":true,"labels":false,"subIssues":false}'::jsonb
  END;
