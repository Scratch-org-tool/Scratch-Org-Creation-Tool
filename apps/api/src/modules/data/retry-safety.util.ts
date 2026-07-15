export function isUnsafeInsertChunkRetry(
  strategy: string,
  hasMatchField = false,
): boolean {
  return strategy === 'insert' || (strategy === 'generic' && !hasMatchField);
}
