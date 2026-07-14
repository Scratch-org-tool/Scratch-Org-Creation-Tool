#!/usr/bin/env node
/**
 * Smoke test script - validates core shared package exports
 */
const { QUEUE_NAMES, SCRATCH_ORG_WORKFLOW_STEPS, authorizeOrgSchema } = require('@sfcc/shared');

let passed = 0;
let failed = 0;

function assert(condition, msg) {
  if (condition) { passed++; console.log(`  ✓ ${msg}`); }
  else { failed++; console.error(`  ✗ ${msg}`); }
}

console.log('Running smoke tests...\n');

assert(QUEUE_NAMES.SCRATCH_ORG_CREATE === 'scratch-org-create', 'queue names defined');
assert(QUEUE_NAMES.AI_ANALYSIS === 'ai-analysis', 'ai queue defined');
assert(SCRATCH_ORG_WORKFLOW_STEPS.includes('Create Scratch Org'), 'workflow steps include create');
assert(SCRATCH_ORG_WORKFLOW_STEPS.includes('Complete'), 'workflow steps include complete');

const parsed = authorizeOrgSchema.parse({
  alias: 'DevHub',
  instanceUrl: 'https://login.salesforce.com',
  isDevHub: true,
});
assert(parsed.alias === 'DevHub', 'authorize org schema validates');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
