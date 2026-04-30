import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getCorsHeaders } from '../http/response';

const readSourceFiles = (root: string): string[] => {
  const entries = readdirSync(root);
  const files: string[] = [];

  for (const entry of entries) {
    const path = join(root, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      files.push(...readSourceFiles(path));
      continue;
    }
    if (['.ts', '.tsx'].includes(extname(path))) {
      files.push(path);
    }
  }

  return files;
};

describe('security boundary static checks', () => {
  it('does not expose Supabase service role material to the browser app', () => {
    const appRoot = resolve(process.cwd(), '../app/src');
    const source = readSourceFiles(appRoot)
      .map((path) => readFileSync(path, 'utf8'))
      .join('\n');

    expect(source).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
    expect(source).not.toMatch(/service[_-]?role/i);
  });

  it('keeps canonical time-tracker writes independent from request body user ids', () => {
    const handlerSource = readFileSync(
      resolve(process.cwd(), 'src/handlers/timeTracker.ts'),
      'utf8',
    );

    expect(handlerSource).not.toMatch(/\bbody\.(user_id|userId)\b/);
    expect(handlerSource).not.toMatch(/\b(user_id|userId)\s*=\s*body\b/);
  });

  it('does not expose Google OAuth tokens in browser-facing Google sync contracts', () => {
    const contractSource = readFileSync(
      resolve(process.cwd(), '../app/src/features/time-tracker/domain/googleSyncTypes.ts'),
      'utf8',
    );

    expect(contractSource).not.toMatch(/\b(access_token|refresh_token)\b/);
    expect(contractSource).not.toMatch(/\b(accessToken|refreshToken)\b/);
  });

  it('does not fall back to wildcard CORS origins', () => {
    expect(getCorsHeaders('https://evil.example')['Access-Control-Allow-Origin']).toBe(
      'https://forge.h031203yama.workers.dev',
    );
    expect(getCorsHeaders('http://localhost:5173')['Access-Control-Allow-Origin']).toBe(
      'http://localhost:5173',
    );
  });
});
