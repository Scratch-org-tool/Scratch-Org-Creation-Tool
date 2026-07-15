export function isUnsafeInsertChunkRetry(
  strategy: string,
  hasMatchField = false,
): boolean {
  return strategy === 'insert' || (strategy === 'generic' && !hasMatchField);
}

export function isSafeIdempotentUpsertRetry(
  operation: string,
  externalIdField: string | null | undefined,
): boolean {
  return operation === 'upsert' && Boolean(externalIdField?.trim());
}
