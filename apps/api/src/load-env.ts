import { existsSync } from 'fs';
import { join } from 'path';
import { config } from 'dotenv';

function resolveMonorepoRoot(): string {
  const cwd = process.cwd();
  if (existsSync(join(cwd, 'apps', 'api', 'package.json'))) {
    return cwd;
  }
  if (existsSync(join(cwd, '..', '..', 'package.json')) && existsSync(join(cwd, 'package.json'))) {
    return join(cwd, '..', '..');
  }
  return cwd;
}

/** Monorepo root `.env` first, then `apps/api/.env` overrides (turbo cwd is usually apps/api). */
export function loadApiEnv(): void {
  const monorepoRoot = resolveMonorepoRoot();
  const apiDir = join(monorepoRoot, 'apps', 'api');

  const sharedEnv = join(monorepoRoot, '.env');
  if (existsSync(sharedEnv)) {
    config({ path: sharedEnv });
  }

  const overrideCandidates = [
    join(apiDir, '.env'),
    join(process.cwd(), '.env'),
    join(__dirname, '..', '.env'),
  ];

  const seen = new Set<string>();
  for (const envPath of overrideCandidates) {
    if (!envPath || seen.has(envPath) || !existsSync(envPath)) continue;
    seen.add(envPath);
    config({ path: envPath, override: true });
  }

  const webEnvLocal = join(monorepoRoot, 'apps', 'web', '.env.local');
  if (existsSync(webEnvLocal)) {
    config({ path: webEnvLocal, override: false });
  }

  const webApiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim();
  if (webApiKey && !process.env.FIREBASE_WEB_API_KEY?.trim()) {
    process.env.FIREBASE_WEB_API_KEY = webApiKey;
  }
}

loadApiEnv();
