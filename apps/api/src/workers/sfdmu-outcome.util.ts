export interface SfdmuOutcome {
  processedRecords: number | null;
  failedRecords: number;
  completedOperations: number;
}

const COMPLETED_OPERATION_PATTERN =
  /\[Batch#\s*([^\]]+)\]\s*\{([^}]+)\}\s*Completed\.\s*([\d,]+)\s+records?\s+processed,\s*([\d,]+)\s+records?\s+failed\./gi;

function parseCounter(value: string): number {
  return Number.parseInt(value.replace(/,/g, ''), 10);
}

/**
 * SFDMU can exit 0 even when Salesforce rejects individual rows. Its stable
 * completion lines contain the authoritative per-operation failure counters.
 * REST runs may print cumulative completion lines, so retain only the latest
 * count for each object/operation pair instead of summing every line.
 */
export function parseSfdmuOutcome(output: string): SfdmuOutcome {
  const operations = new Map<string, { processed: number; failed: number }>();
  const normalized = output.replace(/\u001B\[[0-9;]*m/g, '');
  let match: RegExpExecArray | null;

  while ((match = COMPLETED_OPERATION_PATTERN.exec(normalized)) !== null) {
    const batchLabel = match[1]!.trim();
    const operation = batchLabel.split(':').at(-1)?.trim().toLowerCase() || batchLabel.toLowerCase();
    const objectName = match[2]!.trim().toLowerCase();
    operations.set(`${objectName}:${operation}`, {
      processed: parseCounter(match[3]!),
      failed: parseCounter(match[4]!),
    });
  }

  if (operations.size === 0) {
    return { processedRecords: null, failedRecords: 0, completedOperations: 0 };
  }

  let processedRecords = 0;
  let failedRecords = 0;
  for (const operation of operations.values()) {
    processedRecords += operation.processed;
    failedRecords += operation.failed;
  }
  return { processedRecords, failedRecords, completedOperations: operations.size };
}

export function sfdmuRowFailureMessage(outcome: SfdmuOutcome): string {
  const total = outcome.processedRecords ?? outcome.failedRecords;
  return `SFDMU reported ${outcome.failedRecords.toLocaleString()} failed record(s) out of `
    + `${total.toLocaleString()} processed. Review the chunk output for Salesforce row errors.`;
}
