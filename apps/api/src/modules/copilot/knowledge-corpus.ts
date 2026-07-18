import type { KnowledgeTier } from '@sfcc/shared';

export interface CorpusDoc {
  source: string;
  tier: KnowledgeTier;
  content: string;
}

export const KNOWLEDGE_CORPUS_SOURCE_TYPE = 'app_corpus';

/**
 * Curated application knowledge corpus.
 *
 * `app_guide` docs describe how to USE the application (safe for any user with
 * a copilot grant). `internal` docs describe the codebase and architecture and
 * are retrievable by admins only — enforcement happens in the tier-filtered
 * retrieval query, not the prompt.
 */
export const KNOWLEDGE_CORPUS: CorpusDoc[] = [
  // ---------------------------------------------------------------------
  // app_guide tier — usage help
  // ---------------------------------------------------------------------
  {
    source: 'guide/scratch-orgs',
    tier: 'app_guide',
    content: `# Creating a scratch org

Go to Environment Center in the left navigation, then click "Create Scratch Org".
The wizard walks you through:
1. Alias and duration — pick a unique alias and how many days the org should live (1-30).
2. Dev Hub — choose the connected Dev Hub the scratch org is created from.
3. Template — optionally pick a saved scratch org template (features, settings, packages).
4. Optional steps — deploy metadata, load custom settings, assign a permission set, create users.

Click "Create" and the job appears with live logs. You can skip individual steps while it runs, or cancel the whole job. Progress is streamed in real time; the finished org shows under Environment Center with its login URL.`,
  },
  {
    source: 'guide/org-connections',
    tier: 'app_guide',
    content: `# Connecting a Salesforce org

Open Environment Center and click "Connect Org". Choose the org type (production, sandbox, Dev Hub, scratch). A Salesforce login window opens — sign in and approve access. The org then appears in your org list and can be used as a source or target for data and metadata deployments.

If an org's session expires, commands against it fail with an authentication error — reconnect the org from Environment Center. Only the user who connected an org can use it; orgs are never shared between users.`,
  },
  {
    source: 'guide/data-deploy',
    tier: 'app_guide',
    content: `# Deploying data from org to org

Open Data Center and choose "Org to Org Deploy":
1. Pick source and target orgs (they must be different).
2. Pick the object to deploy, then choose records: browse and select specific records, apply field filters, or write a custom SOQL query.
3. Choose the strategy — Insert (new records) or Upsert (match on an external Id / Name field so re-runs don't duplicate records).
4. Optionally run a pre-flight check: it verifies the record count, the target org's Bulk API quota, and field compatibility before anything is queued.
5. Start the deploy. Large deploys are automatically split into chunks that run in parallel; you can watch per-chunk progress.

If some chunks fail you can retry only the failed chunks from the batch view — completed chunks are never re-run. Deploys can be cancelled while running. Record Type mappings between orgs are applied automatically when the query includes RecordTypeId.`,
  },
  {
    source: 'guide/metadata-deploy',
    tier: 'app_guide',
    content: `# Deploying metadata from org to org

Open Deployment Center:
1. Choose source and target orgs and start a comparison. The compare screen lists components that are new, changed, or deleted between the orgs, with per-item XML diffs.
2. Select the components to deploy. You can also paste a raw package.xml instead.
3. Choose a test level: NoTestRun, RunLocalTests, RunAllTestsInOrg, or RunSpecifiedTests (a test-class picker lets you choose which Apex tests run).
4. Optionally tick "Validate only" — this runs a check-only deploy. If validation succeeds you can then use Quick Deploy to apply the exact validated changes without re-running tests.
5. Optionally include destructive changes to delete components that exist only in the target.

Before a real deploy runs, the affected components are snapshotted from the target org. If the deploy causes problems, use Rollback on the deployment to redeploy that snapshot. Every deploy, validation, quick deploy, and rollback is recorded in the deployment audit history. You can also chain data deploys to run automatically after the metadata deploy completes.`,
  },
  {
    source: 'guide/monitoring',
    tier: 'app_guide',
    content: `# Monitoring jobs and deployments

The Monitoring page shows job statistics, success/failure trends, queue depth, and recent runs. Every job (scratch org creation, data deploy, metadata deploy, user provisioning) appears with live logs and its current step.

Failed jobs are kept in the dead-letter list on the Monitoring page — you can inspect the error and replay a failed job with its original settings. Jobs that belong to an automation run should be resumed from the run instead of replayed individually.

The Dashboard gives a summary view: total jobs, running jobs, completed vs failed, average duration, and recent deployments.`,
  },
  {
    source: 'guide/user-access',
    tier: 'app_guide',
    content: `# User access and roles

Administrators manage users from the User Access page. Each user has a role (Admin or User) and a set of granted modules. Regular users receive only the Dashboard by default. Release Calendar, Environment Center, Data Center, Deployment Center, Org Setup, Provisioning, Monitoring, AI Copilot, Developer Board, and Salesforce Academy must each be granted explicitly by an admin.

Inactive users are blocked from signing in entirely. The AI Copilot is admin-only by default; an admin can grant a user copilot access, which unlocks application usage help only (no internal or technical details).`,
  },
  {
    source: 'guide/copilot',
    tier: 'app_guide',
    content: `# Using the AI Copilot

The AI Copilot panel answers questions about how to use the application — for example "how do I create a scratch org", "how do I deploy Account records to my sandbox", or "why did my deployment fail". It can also help plan deployments and investigate job failures.

Ask questions in plain language. The copilot knows the application's screens and workflows and will point you to the exact place to click. It will not reveal internal implementation details unless you are an administrator.`,
  },
  // ---------------------------------------------------------------------
  // internal tier — codebase / architecture (admin only)
  // ---------------------------------------------------------------------
  {
    source: 'internal/architecture',
    tier: 'internal',
    content: `# Architecture overview

Turborepo monorepo:
- apps/web — Next.js 15 frontend (Tailwind). Auth via Firebase; talks to the API through /api rewrites or the gateway.
- apps/api — NestJS backend. Global prefix /api. Firebase ID-token auth (AuthGuard), module grants (ModuleGuard), admin role checks (RoleGuard).
- packages/db — Prisma schema + client (PostgreSQL). Key models: OrgConnection, Job, JobLog, AutomationRun, Deployment, DeploymentAudit, DataMovement, DataDeployBatch, DataDeployChunk, KnowledgeChunk, AppUser, DeploymentPlan.
- packages/shared — cross-cutting types, Zod schemas, SOQL/package.xml utilities, queue configs.
- packages/sf-cli — typed wrapper around the Salesforce CLI (sf) with streaming, timeouts, and cancellable deploys.
- scripts/gateway.mjs — reverse proxy with round-robin API pool, health checks, WebSocket upgrades.

Background work runs on BullMQ (Redis). Queues: scratch-org-create, metadata-deploy, sfdmu-run, data-deploy, cona-seed, account-partner-import, user-provision, org-setup, ai-analysis. Deploy-type queues use attempts:1 (no blind retries) and multi-hour lock durations. DB Job ids double as Bull job ids so cancellation can target the queue entry; JobProcessRegistryService broadcasts kill signals across API instances over Redis pub/sub.`,
  },
  {
    source: 'internal/data-deploy-internals',
    tier: 'internal',
    content: `# Data deploy internals

Large deploys are chunked with keyset pagination because Salesforce caps SOQL OFFSET at 2,000. Flow:
1. DataDeployOrchestratorService.createBatch writes a DataDeployBatch plus per-chunk DataDeployChunk/DataMovement rows in one Prisma transaction (status 'planning'), then enqueues a data_deploy_plan job.
2. The planner job exports the ordered Id set once (buildIdOnlySoql + bulk export), computes chunk boundaries (computeChunkBoundaries), rewrites each chunk's SOQL to 'Id > afterId AND Id <= endId' bounds, and enqueues each chunk as an independent queue job.
3. Insert-strategy chunks run in DataDeployWorker (sf bulk export/import, optional upsert via externalIdField); upsert/replicate chunks run through SFDMU (SfdmuWorker) with generated export.json configs.
4. Chunk completion/failure transitions are idempotent (updateMany guarded on non-terminal status) and refreshBatchProgress recomputes batch counters from chunk rows — statuses: running/completed/partial/failed/cancelled.
5. Retry endpoints re-enqueue failed chunks only. BulkThrottleService (Redis sorted set with heartbeats) caps concurrent bulk operations per org and reclaims slots from crashed workers.
Pre-flight validation (DataPreflightService) checks source COUNT(), target Bulk API quota (sf org list limits), and field compatibility before enqueueing.`,
  },
  {
    source: 'internal/metadata-deploy-internals',
    tier: 'internal',
    content: `# Metadata deploy internals

MetadataDeployQueueService.enqueue creates the Job row + Bull job and writes a DeploymentAudit row. MetadataDeployWorker handles:
- Workspace resolution (DeploySourceResolver): azure_manifest (clone from Azure DevOps), org_to_org_manifest (retrieve from source org into a temp SFDX workspace), or local_workspace (used by rollback).
- Pre-deploy snapshot: before a real deploy, the manifest's components are retrieved from the TARGET org into a snapshot dir (DEPLOY_SNAPSHOT_DIR) and Deployment.snapshotPath is set. Rollback enqueues a local_workspace deploy of that snapshot.
- Validate-only (--dry-run) persists the returned deploy id as Deployment.validationId; quick deploy runs 'sf project deploy quick --job-id <validationId>'.
- Destructive changes: destructiveSelections are rendered to destructiveChanges.xml and passed via --post-destructive-changes.
- RunSpecifiedTests passes --tests per class. Intelligent deploy (dependency-ordered batching) is used when enabled, except for validate-only/destructive runs.
- Chained data deploys: after a metadata deploy, MetadataDataChainService queues SFDMU jobs; the automation run completes only when every chained job is terminal (WorkerRegistry.completeChainedRunIfDone).
Compare (MetadataCompareService) lists components per type on both orgs, surfaces per-type listing errors in the summary, and upgrades same/changed classification from real XML diffs.`,
  },
  {
    source: 'internal/security-model',
    tier: 'internal',
    content: `# Security model

- AuthGuard verifies Firebase ID tokens, loads the AppUser profile, and rejects inactive users.
- ModuleGuard enforces per-module grants (copilot/deployment/monitoring etc. are locked for non-admins by default); RoleGuard enforces admin-only routes (knowledge ingest, corpus seeding).
- Admin elevation requires the ADMIN_EMAILS allowlist plus explicit confirmation — email substring matching was removed.
- Org connections, deployments, data movements, batches, and jobs are owner-scoped (createdBy checks) — non-admins only see their own resources. SSE events carry ownerId and are filtered per subscriber.
- Salesforce tokens are AES-256-GCM encrypted; production fails fast if ENCRYPTION_KEY is missing or the dev default. Swagger is disabled in production unless SWAGGER_ENABLED=true.
- Copilot: sessions are owner-checked; knowledge retrieval is tier-filtered in the database query (app_guide vs internal), so internal chunks never enter non-admin prompts.`,
  },
];
