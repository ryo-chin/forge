import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));

const errors = [];
const warnings = [];

const readText = (path) => readFileSync(path, 'utf8');
const readJson = (path) => JSON.parse(readText(path));

const assert = (condition, message) => {
  if (!condition) {
    errors.push(message);
  }
};

const relativePath = (path) => relative(repoRoot, path) || '.';

const findFiles = (dir, names, result = []) => {
  for (const entry of readdirSync(dir)) {
    if (
      entry === '.git' ||
      entry === 'node_modules' ||
      entry === '.wrangler' ||
      entry === 'dist'
    ) {
      continue;
    }

    const path = join(dir, entry);
    const stats = statSync(path);
    if (stats.isDirectory()) {
      findFiles(path, names, result);
      continue;
    }
    if (names.has(entry)) {
      result.push(path);
    }
  }
  return result;
};

const parseNpmrc = () => {
  const path = join(repoRoot, '.npmrc');
  assert(existsSync(path), '.npmrc がありません');
  if (!existsSync(path)) return new Map();

  const entries = new Map();
  for (const line of readText(path).split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separator = trimmed.indexOf('=');
    if (separator === -1) continue;
    entries.set(trimmed.slice(0, separator), trimmed.slice(separator + 1));
  }
  return entries;
};

const checkNpmrc = () => {
  const npmrc = parseNpmrc();
  const required = new Map([
    ['registry', 'https://registry.npmjs.org/'],
    ['ignore-scripts', 'true'],
    ['frozen-lockfile', 'true'],
    ['package-lock', 'false'],
    ['engine-strict', 'true'],
    ['save-exact', 'true'],
    ['strict-ssl', 'true'],
    ['strict-peer-dependencies', 'true'],
  ]);

  for (const [key, expected] of required) {
    assert(npmrc.get(key) === expected, `.npmrc に ${key}=${expected} が必要です`);
  }
};

const checkLockfiles = () => {
  const pnpmLockPath = join(repoRoot, 'pnpm-lock.yaml');
  assert(existsSync(pnpmLockPath), 'pnpm-lock.yaml がありません');

  const forbiddenLocks = findFiles(
    repoRoot,
    new Set(['package-lock.json', 'npm-shrinkwrap.json', 'yarn.lock', 'bun.lock', 'bun.lockb']),
  );
  for (const path of forbiddenLocks) {
    errors.push(`pnpm 以外の lockfile を検出しました: ${relativePath(path)}`);
  }
};

const checkPackageScripts = () => {
  const packageJsonPaths = [
    join(repoRoot, 'package.json'),
    join(repoRoot, 'app/package.json'),
    join(repoRoot, 'api/package.json'),
  ];
  const lifecycleScripts = new Set([
    'preinstall',
    'install',
    'postinstall',
    'prepare',
    'prepack',
    'postpack',
    'prepublish',
    'prepublishOnly',
    'postpublish',
  ]);

  for (const path of packageJsonPaths) {
    const packageJson = readJson(path);
    const scripts = packageJson.scripts ?? {};
    for (const name of Object.keys(scripts)) {
      if (lifecycleScripts.has(name)) {
        errors.push(`${relativePath(path)} に lifecycle script "${name}" があります`);
      }
      if (/\bnpx\b/u.test(scripts[name])) {
        errors.push(`${relativePath(path)} の script "${name}" が npx を使っています`);
      }
    }
  }
};

const checkPnpmLockBuildScripts = () => {
  const path = join(repoRoot, 'pnpm-lock.yaml');
  if (!existsSync(path)) return;

  const lines = readText(path).split(/\r?\n/u);
  let currentPackage = null;
  const packagesRequiringBuild = [];

  for (const line of lines) {
    const packageMatch = line.match(/^  ('?[^:]+@[^']*'?):\s*$/u);
    if (packageMatch) {
      currentPackage = packageMatch[1].replace(/^'|'$/gu, '');
      continue;
    }
    if (line.includes('requiresBuild: true') && currentPackage) {
      packagesRequiringBuild.push(currentPackage);
    }
  }

  for (const packageName of packagesRequiringBuild) {
    errors.push(`install 時に build script が必要な依存があります: ${packageName}`);
  }
};

const checkPackageManager = () => {
  const packageJson = readJson(join(repoRoot, 'package.json'));
  if (!packageJson.engines?.pnpm) {
    errors.push('package.json に engines.pnpm がありません');
  }
  if (!packageJson.scripts?.['install:safe']) {
    errors.push('package.json に install:safe script がありません');
  }
  if (!packageJson.scripts?.['supply-chain:check']) {
    errors.push('package.json に supply-chain:check script がありません');
  }
};

checkNpmrc();
checkLockfiles();
checkPackageScripts();
checkPnpmLockBuildScripts();
checkPackageManager();

if (warnings.length > 0) {
  console.warn('Supply-chain warnings:');
  for (const warning of warnings) {
    console.warn(`WARN ${warning}`);
  }
}

if (errors.length > 0) {
  console.error('Supply-chain check failed:');
  for (const error of errors) {
    console.error(`FAIL ${error}`);
  }
  process.exit(1);
}

console.log('Supply-chain check passed.');
