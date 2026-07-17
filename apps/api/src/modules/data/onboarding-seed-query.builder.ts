import {
  buildGenericDeployQuery,
  findTopLevelKeyword,
  ONBOARDING_OBJECT,
  parseOrgToOrgSoql,
  validateSoqlForObject,
  type ConaManualSeedQuery,
} from '@sfcc/shared';

export interface ResolvedManualOnboardingQuery extends ConaManualSeedQuery {
  objectName: typeof ONBOARDING_OBJECT;
}

export interface OnboardingFieldDescription {
  name: string;
  type?: string;
  compoundFieldName?: string;
  createable?: boolean;
  calculated?: boolean;
}

export interface PreparedManualOnboardingQuery extends ResolvedManualOnboardingQuery {
  excludedFields: Array<{ field: string; reason: string }>;
  expandedCompoundFields: Array<{ field: string; components: string[] }>;
}

/**
 * Validate and normalize user-entered OnboardingConfig SOQL for a bounded
 * cross-org insert. Source Id is removed by buildGenericDeployQuery.
 */
export function resolveManualOnboardingSeedQuery(
  query: ConaManualSeedQuery,
): ResolvedManualOnboardingQuery {
  try {
    validateSoqlForObject(query.soql, ONBOARDING_OBJECT);
  } catch (error) {
    throw new Error(
      `Manual query "${query.label}" is invalid: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  const parsed = parseOrgToOrgSoql(query.soql);
  const scalarFields = parsed.fields.filter((field) => field.toLowerCase() !== 'id');
  const unsupported = scalarFields.find((field) => !/^[A-Za-z_][A-Za-z0-9_]*$/.test(field));
  if (unsupported) {
    throw new Error(
      `Manual query "${query.label}" contains unsupported field expression "${unsupported}". `
      + 'Select only writable OnboardingConfig fields; relationship subqueries and aggregate '
      + 'expressions are not supported.',
    );
  }
  if (!scalarFields.some((field) => field.toLowerCase() === 'recordtypeid')) {
    throw new Error(
      `Manual query "${query.label}" must select RecordTypeId so it can be mapped to the target org`,
    );
  }
  if (scalarFields.length < 2) {
    throw new Error(
      `Manual query "${query.label}" must select at least one OnboardingConfig field in addition `
      + 'to RecordTypeId',
    );
  }

  return {
    ...query,
    objectName: ONBOARDING_OBJECT,
    soql: buildGenericDeployQuery({
      soql: query.soql,
      objectName: ONBOARDING_OBJECT,
      recordLimit: query.limit,
    }),
  };
}

/**
 * Bulk API query does not accept compound Address or Geolocation fields.
 * Replace selected compound fields with writable components, and remove fields
 * that cannot be inserted into the target org.
 */
export function prepareManualOnboardingQueryForBulk(
  query: ResolvedManualOnboardingQuery,
  sourceFields: OnboardingFieldDescription[],
  targetFields: OnboardingFieldDescription[],
): PreparedManualOnboardingQuery {
  const parsed = parseOrgToOrgSoql(query.soql);
  const sourceByName = new Map(
    sourceFields.map((field) => [field.name.toLowerCase(), field]),
  );
  const targetByName = new Map(
    targetFields.map((field) => [field.name.toLowerCase(), field]),
  );
  const selectedFields: string[] = [];
  const seen = new Set<string>();
  const excludedFields: PreparedManualOnboardingQuery['excludedFields'] = [];
  const expandedCompoundFields:
    PreparedManualOnboardingQuery['expandedCompoundFields'] = [];

  const includeTargetWritableField = (fieldName: string, selectedFrom: string) => {
    const target = targetByName.get(fieldName.toLowerCase());
    if (!target) {
      excludedFields.push({
        field: selectedFrom,
        reason: `target field ${fieldName} is missing`,
      });
      return false;
    }
    if (target.calculated || target.createable === false) {
      excludedFields.push({
        field: selectedFrom,
        reason: `target field ${fieldName} is not createable`,
      });
      return false;
    }
    const key = target.name.toLowerCase();
    if (!seen.has(key)) {
      selectedFields.push(target.name);
      seen.add(key);
    }
    return true;
  };

  for (const selectedField of parsed.fields) {
    const source = sourceByName.get(selectedField.toLowerCase());
    if (!source) {
      throw new Error(
        `Manual query "${query.label}" selects source field ${selectedField}, `
        + 'but that field is not available in the source org',
      );
    }
    const sourceType = source.type?.toLowerCase();
    if (sourceType === 'address' || sourceType === 'location') {
      const components = sourceFields.filter(
        (field) =>
          field.compoundFieldName?.toLowerCase() === source.name.toLowerCase(),
      );
      const includedComponents: string[] = [];
      for (const component of components) {
        if (includeTargetWritableField(component.name, selectedField)) {
          includedComponents.push(component.name);
        }
      }
      if (includedComponents.length > 0) {
        expandedCompoundFields.push({
          field: source.name,
          components: includedComponents,
        });
      } else {
        excludedFields.push({
          field: source.name,
          reason: 'compound field is not supported by Bulk Query and has no writable components',
        });
      }
      continue;
    }
    includeTargetWritableField(source.name, source.name);
  }

  if (!selectedFields.some((field) => field.toLowerCase() === 'recordtypeid')) {
    throw new Error(
      `Manual query "${query.label}" has no writable RecordTypeId after target field validation`,
    );
  }
  if (selectedFields.length < 2) {
    throw new Error(
      `Manual query "${query.label}" has no writable OnboardingConfig fields besides RecordTypeId`,
    );
  }

  const fromIndex = findTopLevelKeyword(query.soql, 'FROM');
  if (fromIndex === -1) {
    throw new Error(`Manual query "${query.label}" has no FROM clause`);
  }
  return {
    ...query,
    soql: `SELECT ${selectedFields.join(', ')} ${query.soql.slice(fromIndex)}`,
    excludedFields,
    expandedCompoundFields,
  };
}
