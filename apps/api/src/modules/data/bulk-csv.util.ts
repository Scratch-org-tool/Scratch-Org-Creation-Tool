import { readFile, writeFile } from 'node:fs/promises';
import { normalizeBulkCsvLineEndings } from '@sfcc/shared';

/** Rewrite a bulk CSV on disk to LF-only line endings for Salesforce Bulk API ingest. */
export async function ensureBulkCsvLf(filePath: string): Promise<void> {
  const raw = await readFile(filePath, 'utf8');
  const normalized = normalizeBulkCsvLineEndings(raw);
  if (normalized !== raw) {
    await writeFile(filePath, normalized, 'utf8');
  }
}
