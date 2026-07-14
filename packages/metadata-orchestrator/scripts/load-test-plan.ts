/**
 * Load-test helper: parse a synthetic 10k-member package.xml and build a deployment plan.
 * Run: npx tsx packages/metadata-orchestrator/scripts/load-test-plan.ts
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  MetadataRepository,
  packageParser,
  sourceScanner,
  dependencyDiscoveryEngine,
  DeploymentPlanner,
  BatchOptimizer,
  tunePlannerForManifestSize,
} from '../dist/index.js';

function generateLargeManifest(memberCount: number): string {
  const members = Array.from({ length: memberCount }, (_, i) => `    <members>Obj_${i}__c</members>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<Package xmlns="http://soap.sforce.com/2006/04/metadata">
  <types>
${members}
    <name>CustomObject</name>
  </types>
  <version>59.0</version>
</Package>`;
}

async function main() {
  const memberCount = Number(process.env.LOAD_TEST_MEMBERS ?? 10_000);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sfcc-load-test-'));
  const manifestPath = path.join(tmp, 'package.xml');
  fs.writeFileSync(manifestPath, generateLargeManifest(memberCount));

  const started = Date.now();
  const parsed = packageParser.parseFile(manifestPath);
  const parseMs = Date.now() - started;

  const repo = new MetadataRepository();
  const components = sourceScanner.expandWildcards(parsed.members, tmp);
  for (const comp of components) {
    repo.getOrCreate(comp.metadataType, comp.apiName, { filePath: comp.filePath });
  }

  const graphStarted = Date.now();
  const graphEngine = dependencyDiscoveryEngine.discover(repo, components, { projectRoot: tmp });
  const graphMs = Date.now() - graphStarted;

  const config = tunePlannerForManifestSize(repo.size());
  const planner = new DeploymentPlanner(config);
  const planStarted = Date.now();
  let plan = planner.buildPlan('load-test', repo, graphEngine);
  plan = new BatchOptimizer(config).optimize(plan);
  const planMs = Date.now() - planStarted;

  console.log(JSON.stringify({
    memberCount,
    parsedMembers: parsed.members.length,
    nodes: repo.size(),
    batches: plan.batches.length,
    avgBatchSize: Math.round(repo.size() / Math.max(1, plan.batches.length)),
    timingsMs: { parse: parseMs, graph: graphMs, plan: planMs, total: parseMs + graphMs + planMs },
    config,
  }, null, 2));

  fs.rmSync(tmp, { recursive: true, force: true });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
