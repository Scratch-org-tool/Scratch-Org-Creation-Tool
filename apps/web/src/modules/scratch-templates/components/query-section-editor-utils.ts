import type { AccountPartnerPlan, QueryCategory, QuerySectionQuery } from '@sfcc/shared';

function slug(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'query';
}

export function generatedStableQueryId(name: string, existingIds: readonly string[]): string {
  const base = slug(name);
  const ids = new Set(existingIds);
  if (!ids.has(base)) return base;
  let suffix = 2;
  while (ids.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}

export function inferQueryObject(soql: string): string | undefined {
  let depth = 0;
  let quote: string | null = null;
  for (let index = 0; index < soql.length; index += 1) {
    const character = soql[index];
    if (quote) {
      if (character === quote && soql[index - 1] !== '\\') quote = null;
      continue;
    }
    if (character === "'" || character === '"') {
      quote = character;
      continue;
    }
    if (character === '(') depth += 1;
    if (character === ')') depth = Math.max(0, depth - 1);
    if (depth === 0 && soql.slice(index).match(/^FROM\b/i)) {
      return soql.slice(index + 4).trim().match(/^([A-Za-z_][A-Za-z0-9_]*)/)?.[1];
    }
  }
  return undefined;
}

export function inferQueryCategory(objectName: string): QueryCategory {
  const value = objectName.toLowerCase();
  if (value === 'account') return 'account';
  if (value.includes('employeemaster')) return 'employee_master';
  if (value.includes('accountpartner')) return 'account_partner';
  if (value.includes('onboarding') && value.includes('config')) return 'onboarding_config';
  if (value.includes('product')) return 'product';
  if (value.includes('visit') && value.includes('plan')) return 'visit_plan';
  return 'arbitrary';
}

export function queryReferenceLabels(
  queryId: string,
  queries: readonly QuerySectionQuery[],
  partnerPlan?: AccountPartnerPlan,
): string[] {
  const labels = queries
    .filter((candidate) => candidate.dependsOn.includes(queryId))
    .map((candidate) => `dependency of ${candidate.name}`);
  if (!partnerPlan) return labels;
  const partnerReferences: Array<[keyof AccountPartnerPlan, string]> = [
    ['accountQueryId', 'Account Partner account query'],
    ['employeeMasterQueryId', 'Account Partner employee query'],
    ['accountPartnerQueryId', 'Account Partner mapping query'],
    ['roleQueryId', 'Account Partner role lookup'],
  ];
  return [
    ...labels,
    ...partnerReferences
      .filter(([field]) => partnerPlan[field] === queryId)
      .map(([, label]) => label),
  ];
}

export function canMoveQuery(
  queries: readonly QuerySectionQuery[],
  index: number,
  direction: -1 | 1,
): boolean {
  const target = index + direction;
  if (target < 0 || target >= queries.length) return false;
  const moving = queries[index];
  const other = queries[target];
  if (direction < 0 && moving.dependsOn.includes(other.id)) return false;
  if (direction > 0 && other.dependsOn.includes(moving.id)) return false;
  return true;
}

export function reorderQueries(
  queries: readonly QuerySectionQuery[],
  index: number,
  direction: -1 | 1,
): QuerySectionQuery[] {
  if (!canMoveQuery(queries, index, direction)) return [...queries];
  const next = [...queries];
  [next[index], next[index + direction]] = [next[index + direction], next[index]];
  return next.map((query, executionIndex) => ({
    ...query,
    stage: executionIndex,
    order: executionIndex,
  }));
}
