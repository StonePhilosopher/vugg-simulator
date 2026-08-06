import { spawnSync } from 'node:child_process';
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
} = {}) {
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
