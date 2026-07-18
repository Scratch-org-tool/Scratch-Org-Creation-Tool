import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

/**
 * Resolve the repository assets used by scratch creation and bundled SFDMU.
 * API processes normally run from apps/api, while production images run from
 * /repo/apps/api, so process.cwd() alone is not a stable asset root.
 */
export function resolveSfProjectRoot(
  cwd = process.cwd(),
  configured = process.env.SF_PROJECT_ROOT,
): string {
  if (configured?.trim()) return resolve(configured.trim());

  let candidate = resolve(cwd);
  for (let depth = 0; depth < 6; depth += 1) {
    if (
      existsSync(join(candidate, 'package.json'))
      && existsSync(join(candidate, 'config', 'project-scratch-def.json'))
    ) {
      return candidate;
    }
    const parent = dirname(candidate);
    if (parent === candidate) break;
    candidate = parent;
  }

  return resolve(cwd);
}
