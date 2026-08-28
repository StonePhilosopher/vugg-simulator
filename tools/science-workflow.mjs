#!/usr/bin/env node
/**
 * Serialized Node-only science verification and evidence rebake.
 *
 *   node tools/science-workflow.mjs --verify
 *   node tools/science-workflow.mjs --rebake
 *
 * Every child process completes before the next starts. Vitest also has one
 * worker and file parallelism disabled in vitest.config.ts, so this workflow
 * cannot recreate the former multi-worker RAM spike. The retired Python game
 * and Python virtual environments are intentionally absent from this path.
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertCommissionedEvidenceRuntime } from './evidence-runtime.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
assertCommissionedEvidenceRuntime();
const NODE = process.execPath;
const VITEST = path.join(ROOT, 'node_modules', 'vitest', 'vitest.mjs');
const SCIENCE_TESTS = [
  'tests-js/artifact-identity.test.ts',
  'tests-js/scenario-expectation-contracts.test.ts',
  'tests-js/locality-envelope-audit.test.ts',
  'tests-js/claim-cards.test.ts',
  'tests-js/mechanism-witnesses.test.ts',
  'tests-js/science-provenance-manifest.test.ts',
  'tests-js/pressure-science.test.ts',
];

function simVersion() {
  const source = fs.readFileSync(path.join(ROOT, 'js', '15-version.ts'), 'utf8');
  const match = /const SIM_VERSION = (\d+);/.exec(source);
  if (!match) throw new Error('could not read SIM_VERSION from js/15-version.ts');
  return Number(match[1]);
}

function run(label, args) {
  console.log(`\n[science-workflow] ${label}`);
  const result = spawnSync(NODE, args, {
    cwd: ROOT,
    stdio: 'inherit',
    env: process.env,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${label} failed with exit ${result.status ?? 'unknown'}`);
  }
}

function verify() {
  // build-all emits the current TypeScript before checking index.html. This is
  // intentionally stronger than `tsc --noEmit` + `build.mjs --check`: dist/ is
  // ignored, so the latter could test stale output or fail on a clean clone.
  run('compile current sources and check bundled index drift', ['tools/build-all.mjs', '--check']);
  run('aggregate science evidence authentication', ['tools/science-evidence-receipt.mjs', '--check']);
  run('science provenance check', ['tools/gen-science-provenance-manifest.mjs', '--check']);
  run('locality envelope check', ['tools/locality-envelope-audit.mjs', '--check']);
  run('focused science tests (one worker)', [VITEST, 'run', ...SCIENCE_TESTS]);
}

function rebake() {
  const version = simVersion();
  const cardDir = path.join('archive', 'claim-cards', `v${version}`);
  run('compile and rebuild local game bundle', ['tools/build-all.mjs']);
  run('three-seed locality-frequency receipt', ['tools/gen-locality-frequency-baseline.mjs']);
  run('canonical seed-42 strip archive', ['tools/gen-strip-archive.mjs']);
  run('canonical seed-42 scenario baseline', ['tools/gen-js-baseline.mjs']);
  run('strip digest tripwire', ['tools/gen-strip-digest.mjs']);
  run('production mechanism boundary witnesses', ['tools/gen-mechanism-witnesses.mjs']);
  run('byte-bound hostile-review claim cards', [
    'tools/review-claim-card.mjs', '--all', '--version', String(version), '--out', cardDir,
  ]);
  run('clean-checkout aggregate science evidence receipt', ['tools/science-evidence-receipt.mjs']);
  run('science provenance manifest', ['tools/gen-science-provenance-manifest.mjs']);
  verify();
}

const verifyRequested = process.argv.includes('--verify');
const rebakeRequested = process.argv.includes('--rebake');
if (verifyRequested === rebakeRequested) {
  console.error('Usage: node tools/science-workflow.mjs (--verify | --rebake)');
  process.exit(2);
}

try {
  if (rebakeRequested) rebake();
  else verify();
  console.log('\n[science-workflow] PASS');
} catch (error) {
  console.error(`\n[science-workflow] FAIL: ${error.message}`);
  process.exit(1);
}
