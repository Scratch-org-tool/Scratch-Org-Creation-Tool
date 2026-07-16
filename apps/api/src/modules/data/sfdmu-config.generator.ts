import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import type { QuerySetJson, SfdmuExportJson } from '@sfcc/shared';
import {
  extractFieldsFromSoql,
  normalizeSfdmuExport,
  resolveDataWriteOperation,
  type DataWriteOperation,
} from '@sfcc/shared';

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
  const projectRoot = process.env.SF_PROJECT_ROOT ?? process.cwd();
  const path = join(projectRoot, 'config/custom-settings-export.json');
  const raw = JSON.parse(readFileSync(path, 'utf-8')) as SfdmuExportJson;
  return normalizeSfdmuExport(raw);
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
