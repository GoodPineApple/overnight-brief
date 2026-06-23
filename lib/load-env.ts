import { config } from 'dotenv';
import { existsSync } from 'fs';
import { resolve } from 'path';

/** `.env` → `.env.local` 순으로 로드 (.env.local이 우선) */
export function loadEnv(): void {
  const root = process.cwd();
  const envPath = resolve(root, '.env');
  const localPath = resolve(root, '.env.local');

  if (existsSync(envPath)) config({ path: envPath });
  if (existsSync(localPath)) config({ path: localPath, override: true });
}

loadEnv();
