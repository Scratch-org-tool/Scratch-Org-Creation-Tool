export interface SalesforcePicklistValue {
  value: string;
  active: boolean;
  validFor?: string;
}

export interface PicklistDependency {
  value: string;
  validFor: string[];
}

/** Decode Salesforce base64 validFor bitsets using controller-value order. */
export function decodeValidFor(validFor: string | undefined, controllerValues: string[]): string[] {
  if (!validFor) return [];
  const bytes = Buffer.from(validFor, 'base64');
  const result: string[] = [];
  for (let index = 0; index < controllerValues.length; index += 1) {
    const byte = bytes[Math.floor(index / 8)] ?? 0;
    const mask = 0x80 >> (index % 8);
    if ((byte & mask) !== 0) result.push(controllerValues[index]);
  }
  return result;
}

export function buildPicklistDependencies(
  values: SalesforcePicklistValue[],
  controllerMetadata: SalesforcePicklistValue[] | string[],
): PicklistDependency[] {
  const fullControllerOrder = controllerMetadata.map((value) =>
    typeof value === 'string' ? value : value.value);
  const activeControllers = new Set(
    controllerMetadata
      .filter((value) => typeof value === 'string' || value.active)
      .map((value) => typeof value === 'string' ? value : value.value),
  );
  return values
    .filter((value) => value.active)
    .map((value) => ({
      value: value.value,
      validFor: decodeValidFor(value.validFor, fullControllerOrder)
        .filter((controller) => activeControllers.has(controller)),
    }));
}
