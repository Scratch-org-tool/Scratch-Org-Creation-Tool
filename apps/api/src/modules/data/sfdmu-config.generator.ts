import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join, resolve } from 'path';
import type { QuerySetJson, SfdmuExportJson } from '@sfcc/shared';
import {
  extractFieldsFromSoql,
  normalizeSfdmuExport,
  resolveDataWriteOperation,
  type DataWriteOperation,
} from '@sfcc/shared';
import { resolveSfProjectRoot } from '../../common/sf-project-root.util';

function resolveSfdmuRunsRoot(): string {
  const configured = process.env.SFDMU_RUNS_DIR?.trim();
  if (configured) return configured;
  return join(tmpdir(), 'sfcc-sfdmu-runs');
}

function resolveSfdmuRunDir(runId: string): string {
  const runDir = join(resolveSfdmuRunsRoot(), runId);
  mkdirSync(runDir, { recursive: true });
  return runDir;
}

export function shouldKeepSfdmuRunArtifacts(): boolean {
  const flag = process.env.SFDMU_KEEP_RUN_ARTIFACTS?.trim().toLowerCase();
  return flag === '1' || flag === 'true' || flag === 'yes';
}

/** Remove SFDMU CSV/config working files after deploy (skipped when SFDMU_KEEP_RUN_ARTIFACTS=true). */
export function cleanupSfdmuRunDir(configPath: string): void {
  if (shouldKeepSfdmuRunArtifacts()) return;
  try {
    rmSync(configPath, { recursive: true, force: true });
  } catch {
    // best-effort cleanup
  }
}

export interface SfdmuGenerateInput {
  runId: string;
  sourceOrgAlias: string;
  targetOrgAlias: string;
  querySet: QuerySetJson;
  recordTypeMappings?: Record<string, string>;
  sfdmuConfigUploadPath?: string;
}

export interface SfdmuGenerateResult {
  configPath: string;
  exportJsonPath: string;
  queriesJsonPath: string;
}

export function generateSfdmuConfig(input: SfdmuGenerateInput): SfdmuGenerateResult {
  const runDir = resolveSfdmuRunDir(input.runId);

  // Keep one SFDMU object entry per query. Grouping by object silently merged
  // filters and external IDs and made multi-query replication non-deterministic.
  const objects = input.querySet.queries.map((queryEntry) => {
    const fieldList = extractFieldsFromSoql(queryEntry.soql);
    const runtime = resolveDataWriteOperation(
      queryEntry.operation,
      queryEntry.externalIdField,
    );
    const valueMapping =
      fieldList.some((f) => f.includes('RecordTypeId')) && input.recordTypeMappings
        ? {
            RecordTypeId: Object.entries(input.recordTypeMappings).map(([source, target]) => ({
              source,
              target,
            })),
          }
        : undefined;

    return {
      name: queryEntry.object,
      query: queryEntry.soql.trim().replace(/;+\s*$/, ''),
      operation: runtime.operation === 'upsert' ? 'Upsert' : 'Insert',
      ...(runtime.externalIdField ? { externalId: runtime.externalIdField } : {}),
      ...(valueMapping ? { valueMapping } : {}),
    };
  });

  const exportJson = {
    objects,
    orgs: [
      { name: 'Source', instanceUrl: 'source', accessToken: input.sourceOrgAlias },
      { name: 'Target', instanceUrl: 'target', accessToken: input.targetOrgAlias },
    ],
    sourceUsername: input.sourceOrgAlias,
    targetUsername: input.targetOrgAlias,
  };

  const exportJsonPath = join(runDir, 'export.json');
  const queriesJsonPath = join(runDir, 'queries.json');
  writeFileSync(exportJsonPath, JSON.stringify(exportJson, null, 2));
  writeFileSync(queriesJsonPath, JSON.stringify(input.querySet, null, 2));

  if (input.sfdmuConfigUploadPath) {
    writeFileSync(join(runDir, 'uploaded-export.json'), input.sfdmuConfigUploadPath);
  }

  return { configPath: runDir, exportJsonPath, queriesJsonPath };
}

export interface SfdmuExportWriteInput {
  runId: string;
  sourceOrgAlias: string;
  targetOrgAlias: string;
  exportConfig: SfdmuExportJson;
}

export function writeSfdmuExportFromUpload(input: SfdmuExportWriteInput): SfdmuGenerateResult {
  const runDir = resolveSfdmuRunDir(input.runId);

  const normalized = normalizeSfdmuExport(input.exportConfig);
  const objects = normalized.objects.map((obj) => ({
    name: obj.name,
    query: obj.query,
    operation: obj.operation,
    ...(obj.externalId ? { externalId: obj.externalId } : {}),
    ...(obj.valueMapping ? { valueMapping: obj.valueMapping } : {}),
  }));

  const exportJson = {
    objects,
    orgs: [
      { name: 'Source', instanceUrl: 'source', accessToken: input.sourceOrgAlias },
      { name: 'Target', instanceUrl: 'target', accessToken: input.targetOrgAlias },
    ],
    sourceUsername: input.sourceOrgAlias,
    targetUsername: input.targetOrgAlias,
  };

  const exportJsonPath = join(runDir, 'export.json');
  writeFileSync(exportJsonPath, JSON.stringify(exportJson, null, 2));
  writeFileSync(join(runDir, 'uploaded-export.json'), JSON.stringify(input.exportConfig, null, 2));

  return { configPath: runDir, exportJsonPath, queriesJsonPath: join(runDir, 'queries.json') };
}

export function loadBundledCustomSettingsExport(): SfdmuExportJson {
  return loadBundledSfdmuExport('custom-settings');
}

export function loadBundledMasterExport(): SfdmuExportJson {
  return loadBundledSfdmuExport('master');
}

function resolveBundledExportPath(fileName: string): string {
  const candidates = new Set<string>();
  const configured = process.env.SF_PROJECT_ROOT?.trim();
  if (configured) {
    candidates.add(join(resolve(configured), fileName));
  }
  candidates.add(join(resolveSfProjectRoot(process.cwd(), undefined), fileName));

  let walk = resolve(process.cwd());
  for (let depth = 0; depth < 6; depth += 1) {
    candidates.add(join(walk, fileName));
    const parent = dirname(walk);
    if (parent === walk) break;
    walk = parent;
  }

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }

  return [...candidates][0]!;
}

export function loadBundledSfdmuExport(bundle: 'custom-settings' | 'master'): SfdmuExportJson {
  const fileName = bundle === 'master'
    ? 'config/scratchorg-dl-export.json'
    : 'config/custom-settings-export.json';
  const path = resolveBundledExportPath(fileName);
  try {
    const content = readFileSync(path, 'utf-8').replace(/^\uFEFF/, '');
    const raw = JSON.parse(content) as SfdmuExportJson;
    return normalizeSfdmuExport(raw);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Failed to load ${bundle} SFDMU export from ${path}: ${detail}`,
    );
  }
}

export function resolveCustomSettingsExportConfig(
  mode: 'bundled' | 'master' | 'custom' | undefined,
  exportConfig?: SfdmuExportJson,
): SfdmuExportJson {
  if (mode === 'custom' && exportConfig) {
    return exportConfig;
  }
  if (mode === 'master') {
    return loadBundledMasterExport();
  }
  return loadBundledCustomSettingsExport();
}

export interface SfdmuFromSoqlInput {
  runId: string;
  sourceOrgAlias: string;
  targetOrgAlias: string;
  objectName: string;
  soql: string;
  operation?: DataWriteOperation;
  externalId?: string;
  recordTypeMappings?: Record<string, string>;
}

/** Single-object SFDMU config preserving user SOQL (incl. WHERE) */
export function generateSfdmuConfigFromSoql(input: SfdmuFromSoqlInput): SfdmuGenerateResult {
  const runDir = resolveSfdmuRunDir(input.runId);

  const fields = extractFieldsFromSoql(input.soql);
  const fieldList = fields.length > 0 ? fields : ['Name'];
  const query = input.soql.trim().replace(/;+\s*$/, '');
  const runtime = resolveDataWriteOperation(input.operation, input.externalId);

  const valueMapping =
    fieldList.some((f) => f.includes('RecordTypeId')) && input.recordTypeMappings
      ? {
          RecordTypeId: Object.entries(input.recordTypeMappings).map(([source, target]) => ({
            source,
            target,
          })),
        }
      : undefined;

  const exportJson = {
    objects: [
      {
        name: input.objectName,
        query,
        operation: runtime.operation === 'upsert' ? 'Upsert' : 'Insert',
        ...(runtime.externalIdField ? { externalId: runtime.externalIdField } : {}),
        ...(valueMapping ? { valueMapping } : {}),
      },
    ],
    orgs: [
      { name: 'Source', instanceUrl: 'source', accessToken: input.sourceOrgAlias },
      { name: 'Target', instanceUrl: 'target', accessToken: input.targetOrgAlias },
    ],
    sourceUsername: input.sourceOrgAlias,
    targetUsername: input.targetOrgAlias,
  };

  const exportJsonPath = join(runDir, 'export.json');
  writeFileSync(exportJsonPath, JSON.stringify(exportJson, null, 2));
  writeFileSync(join(runDir, 'soql.json'), JSON.stringify({ soql: query, objectName: input.objectName }, null, 2));

  return { configPath: runDir, exportJsonPath, queriesJsonPath: join(runDir, 'soql.json') };
}
