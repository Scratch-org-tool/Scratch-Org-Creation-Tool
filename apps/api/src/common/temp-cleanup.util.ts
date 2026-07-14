import { rm } from 'fs/promises';

export async function removeTempDir(dir: string): Promise<void> {
  try {
    await rm(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`Temp workspace cleanup failed for ${dir}: ${message}`);
  }
}
