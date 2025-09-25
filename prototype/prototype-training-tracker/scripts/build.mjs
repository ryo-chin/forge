import { promises as fs } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { build } from 'esbuild';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const srcDir = join(projectRoot, 'src');
const distDir = join(projectRoot, 'dist');

async function clean() {
  await fs.rm(distDir, { recursive: true, force: true });
  await fs.mkdir(distDir, { recursive: true });
  await fs.mkdir(join(distDir, 'assets'), { recursive: true });
}

async function copyStatic() {
  const staticFiles = ['index.html', 'styles.css'];
  await Promise.all(
    staticFiles.map(async (file) => {
      await fs.copyFile(join(srcDir, file), join(distDir, file));
    })
  );
}

async function bundleScripts() {
  await build({
    entryPoints: [join(srcDir, 'main.js')],
    bundle: true,
    outfile: join(distDir, 'assets', 'main.js'),
    sourcemap: false,
    minify: false,
    target: 'es2018',
    logLevel: 'info'
  });
}

async function copyAssets() {
  const publicDir = join(srcDir, 'public');
  try {
    const entries = await fs.readdir(publicDir, { withFileTypes: true });
    await Promise.all(entries.map(async (entry) => {
      const from = join(publicDir, entry.name);
      const to = join(distDir, entry.name);
      if (entry.isDirectory()) {
        await fs.cp(from, to, { recursive: true });
      } else {
        await fs.copyFile(from, to);
      }
    }));
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
}

async function main() {
  await clean();
  await Promise.all([copyStatic(), bundleScripts(), copyAssets()]);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
