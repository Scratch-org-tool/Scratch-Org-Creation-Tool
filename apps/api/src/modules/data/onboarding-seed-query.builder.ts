import {
  buildGenericDeployQuery,
  ONBOARDING_OBJECT,
  parseOrgToOrgSoql,
  validateSoqlForObject,
  type ConaManualSeedQuery,
} from '@sfcc/shared';

export interface ResolvedManualOnboardingQuery extends ConaManualSeedQuery {
  objectName: typeof ONBOARDING_OBJECT;
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
