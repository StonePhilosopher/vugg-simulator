import { spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const TSC_ENTRY = join(ROOT, 'node_modules', 'typescript', 'bin', 'tsc');

export function runBuildAll({
  spawn = spawnSync,
  execPath = process.execPath,
  root = ROOT,
  tscEntry = TSC_ENTRY,
  forwardedArgs = process.argv.slice(2),
  remove = rmSync,
} = {}) {
  const narrativeArgs = ['tools/narrative-workflow.mjs'];
  if (forwardedArgs.includes('--check')) narrativeArgs.push('--check');
  console.log('[build-all] auditing narrative manifest…');
  const narratives = spawn(execPath, narrativeArgs, {
    cwd: root,
    stdio: 'inherit',
  });
  if (narratives.error) {
    console.error(`[build-all] could not launch narrative audit: ${narratives.error.message}`);
    return 1;
  }
  if (narratives.status !== 0) {
    console.error(`[build-all] narrative audit failed (exit ${narratives.status ?? 'unknown'}); compilation skipped.`);
    return narratives.status ?? 1;
  }
  console.log('[build-all] cleaning dist/ before exact compilation…');
  try {
    remove(join(root, 'dist'), { recursive: true, force: true });
  } catch (error) {
    console.error(`[build-all] could not clean dist/: ${error.message}`);
    return 1;
  }
  console.log('[build-all] running tsc…');
  const tsc = spawn(execPath, [tscEntry, '-p', 'tsconfig.json'], {
    cwd: root,
    stdio: 'inherit',
  });
  if (tsc.error) {
    console.error(`[build-all] could not launch tsc: ${tsc.error.message}`);
    return 1;
  }
  if (tsc.status !== 0) {
    console.error(`[build-all] tsc failed (exit ${tsc.status ?? 'unknown'}); bundle splice skipped.`);
    return tsc.status ?? 1;
  }
  console.log('[build-all] running tools/build.mjs…');
  const splice = spawn(execPath, ['tools/build.mjs', ...forwardedArgs], {
    cwd: root,
    stdio: 'inherit',
  });
  if (splice.error) {
    console.error(`[build-all] could not launch bundle splice: ${splice.error.message}`);
    return 1;
  }
  return splice.status ?? 1;
}
