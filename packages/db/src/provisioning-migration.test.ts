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
