import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';

function prismaFile(relativePath: string): string {
  const packageRoot = process.cwd().endsWith('/packages/db')
    ? process.cwd()
    : resolve(process.cwd(), 'packages/db');
  return readFileSync(
    resolve(packageRoot, 'prisma', relativePath),
    'utf8',
  );
}

describe('provisioned user batch username uniqueness', () => {
  it('declares the compound unique key in Prisma schema', () => {
    const schema = prismaFile('schema.prisma');
    assert.match(schema, /model ProvisionedUser[\s\S]*@@unique\(\[batchId, username\]\)/);
  });

  it('deduplicates existing rows before creating the matching unique index', () => {
    const migration = prismaFile(
      'migrations/20260715122500_provisioned_user_batch_username_unique/migration.sql',
    );
    const deletePosition = migration.indexOf('DELETE FROM "ProvisionedUser"');
    const indexPosition = migration.indexOf('CREATE UNIQUE INDEX');
    assert.ok(deletePosition >= 0);
    assert.ok(indexPosition > deletePosition);
    assert.match(migration, /PARTITION BY "batchId", "username"/);
    assert.match(migration, /"ProvisionedUser_batchId_username_key"/);
  });
});

describe('existing scratch-org pipeline migration', () => {
  const migrationPath =
    'migrations/20260715133000_existing_scratch_org_pipeline/migration.sql';

  it('uses immutable typed enum comparisons for the active-target partial index', () => {
    const migration = prismaFile(migrationPath);
    assert.doesNotMatch(migration, /"status"::text/);
    assert.match(migration, /'pending'::"JobStatus"/);
    assert.match(migration, /'paused'::"JobStatus"/);
    assert.match(migration, /"intent" = 'scratch_org_pipeline'/);
    assert.doesNotMatch(
      migration.slice(migration.indexOf('CREATE UNIQUE INDEX')),
      /"launchMode" = 'configure_existing'/,
    );
  });

  it('backfills valid relational targets before enforcing uniqueness', () => {
    const migration = prismaFile(migrationPath);
    const backfillPosition = migration.indexOf('UPDATE "AutomationRun" AS run');
    const uniquePosition = migration.indexOf(
      'CREATE UNIQUE INDEX "AutomationRun_active_scratch_target_key"',
    );
    assert.ok(backfillPosition >= 0);
    assert.ok(uniquePosition > backfillPosition);
    assert.match(
      migration,
      /jsonb_typeof\(run\."checkpoint" -> 'targetOrgConnectionId'\) = 'string'/,
    );
    assert.match(
      migration,
      /org\."id" = run\."checkpoint" ->> 'targetOrgConnectionId'/,
    );
    assert.match(migration, /\^\[0-9a-f\]\{8\}/);
  });

  it('terminates legacy duplicate active targets before creating the index', () => {
    const migration = prismaFile(migrationPath);
    const rankingPosition = migration.indexOf('WITH ranked_active_targets AS');
    const uniquePosition = migration.indexOf(
      'CREATE UNIQUE INDEX "AutomationRun_active_scratch_target_key"',
    );
    assert.ok(rankingPosition >= 0);
    assert.ok(uniquePosition > rankingPosition);
    assert.match(
      migration,
      /row_number\(\) OVER \(\s*PARTITION BY "targetOrgConnectionId"/,
    );
    assert.match(migration, /"status" = 'failed'::"JobStatus"/);
    assert.match(migration, /ranked\.target_rank > 1/);
  });

  it('cancels nonterminal child jobs for superseded duplicate runs', () => {
    const migration = prismaFile(migrationPath);
    assert.match(migration, /superseded_runs AS \(\s*UPDATE "AutomationRun"/);
    assert.match(migration, /UPDATE "Job" AS job/);
    assert.match(
      migration,
      /job\."parentRunId" = superseded_runs\."id"/,
    );
    assert.match(migration, /"status" = 'cancelled'::"JobStatus"/);
    assert.match(migration, /'running'::"JobStatus"/);
    assert.match(migration, /"finishedAt" = COALESCE/);
  });
});

describe('authentication audit migration', () => {
  const migrationPath =
    'migrations/20260715160000_auth_audit_events/migration.sql';

  it('creates a non-sensitive event record with actor and request hashes', () => {
    const schema = prismaFile('schema.prisma');
    const migration = prismaFile(migrationPath);

    assert.match(schema, /model AuthAuditEvent[\s\S]*userId\s+String\?/);
    assert.match(schema, /model AuthAuditEvent[\s\S]*eventType\s+String/);
    assert.match(schema, /model AuthAuditEvent[\s\S]*metadata\s+Json\?/);
    assert.match(migration, /"ipHash" TEXT/);
    assert.match(migration, /"userAgentHash" TEXT/);
    assert.match(migration, /"AuthAuditEvent_userId_createdAt_idx"/);
  });

  it('contains no credential, token, password, or raw network columns', () => {
    const migration = prismaFile(migrationPath);

    assert.doesNotMatch(
      migration,
      /"(?:password|currentPassword|newPassword|token|refreshToken|rawIp|ip|userAgent)"\s/i,
    );
  });
});
