// design-sync buildCmd: compile the src/ui design-system primitives into a
// self-contained package at dist/ui/ (JS + .d.ts + package.json).
//
// Why this exists: this repo is a Next.js app, not a published component
// library — the primitives live as TS source in src/ui with no build that
// emits declarations. The design-sync converter discovers components (and
// their prop types) from a package's shipped .d.ts. This script produces that
// package deterministically so the converter has real declarations to read,
// WITHOUT modifying any of the repo's own source files. dist/ is gitignored,
// so the output is transient and regenerated on every sync.
//
// The converter is pointed at dist/ui via cfg.entry = "dist/ui/index.js"
// (--entry), which makes dist/ui the package root: package.json below supplies
// the name/version/types the converter reads.

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');
const tsconfig = join(here, 'tsconfig.dspkg.json');
const outDir = join(repoRoot, 'dist', 'ui');

console.error(`[build-ds-pkg] tsc -p ${tsconfig} → ${outDir}`);
const r = spawnSync('npx', ['tsc', '-p', tsconfig], {
  cwd: repoRoot,
  stdio: ['ignore', 'inherit', 'inherit'],
  encoding: 'utf8',
  shell: process.platform === 'win32',
});
// noEmitOnError is false, so tsc emits even with type-noise; only a hard
// launch failure or missing output is fatal.
if (r.error) {
  console.error(`[build-ds-pkg] failed to launch tsc: ${r.error.message}`);
  process.exit(1);
}
if (!existsSync(join(outDir, 'index.js')) || !existsSync(join(outDir, 'index.d.ts'))) {
  console.error('[build-ds-pkg] tsc did not emit dist/ui/index.{js,d.ts} — aborting');
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });
writeFileSync(
  join(outDir, 'package.json'),
  JSON.stringify(
    {
      name: '@anker/ui',
      version: '0.1.0',
      description: 'Anker Protocol design-system primitives (generated for design-sync).',
      type: 'module',
      main: 'index.js',
      module: 'index.js',
      types: 'index.d.ts',
      peerDependencies: { react: '>=18', 'react-dom': '>=18' },
    },
    null,
    2,
  ) + '\n',
);
console.error('[build-ds-pkg] wrote dist/ui/package.json');
