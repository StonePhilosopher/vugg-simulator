#!/usr/bin/env node
/**
 * Locate a Python 3.12 environment containing the exact promoted Reaktoro
 * version, then run the offline SUPCRTBL pressure-grid generator.
 *
 * Resolution order:
 *   1. VUGG_REAKTORO_PYTHON (explicit, recommended for CI)
 *   2. repo-local .venv-pressure-grid
 *   3. disposable vugg-reaktoro-* environments under the system temp roots
 *   4. python / python3 / py -3.12 on PATH
 *
 * Every candidate is probed for Reaktoro 2.13.0 before it can execute the
 * generator. A random system Python can therefore never silently regenerate
 * a thermodynamic artifact with a different model version.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const GENERATOR = path.join(ROOT, 'tools', 'gen-thermo-pressure-grid.py');
const REQUIRED_REAKTORO = '2.13.0';

const candidates = [];
function add(command, prefix = [], label = command) {
  if (!command) return;
  const key = JSON.stringify([command, prefix]);
  if (candidates.some((candidate) => candidate.key === key)) return;
  candidates.push({ command, prefix, label, key });
}

add(process.env.VUGG_REAKTORO_PYTHON, [], 'VUGG_REAKTORO_PYTHON');
if (process.platform === 'win32') {
  add(path.join(ROOT, '.venv-pressure-grid', 'python.exe'), [], 'repo-local conda environment');
  add(path.join(ROOT, '.venv-pressure-grid', 'Scripts', 'python.exe'), [], 'repo-local venv');
} else {
  add(path.join(ROOT, '.venv-pressure-grid', 'bin', 'python'), [], 'repo-local environment');
}

const tempRoots = new Set([os.tmpdir()]);
if (process.platform === 'win32') tempRoots.add(path.join(path.parse(ROOT).root, 'tmp'));
for (const tempRoot of tempRoots) {
  let entries = [];
  try {
    entries = fs.readdirSync(tempRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name.startsWith('vugg-reaktoro-'))
      .map((entry) => path.join(tempRoot, entry.name));
  } catch {
    continue;
  }
  entries.sort((left, right) => {
    try { return fs.statSync(right).mtimeMs - fs.statSync(left).mtimeMs; }
    catch { return 0; }
  });
  for (const envRoot of entries) {
    add(
      process.platform === 'win32' ? path.join(envRoot, 'python.exe') : path.join(envRoot, 'bin', 'python'),
      [],
      `temporary environment ${envRoot}`,
    );
  }
}

add('python', [], 'python on PATH');
add('python3', [], 'python3 on PATH');
if (process.platform === 'win32') add('py', ['-3.12'], 'Python launcher 3.12');

const probeCode = `import reaktoro as r; print(r.__version__)`;
const failures = [];
for (const candidate of candidates) {
  const probe = spawnSync(candidate.command, [...candidate.prefix, '-c', probeCode], {
    cwd: ROOT,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 15000,
  });
  const version = String(probe.stdout || '').trim();
  if (probe.status !== 0 || version !== REQUIRED_REAKTORO) {
    const reason = probe.error?.code === 'ENOENT'
      ? 'not found'
      : version
        ? `Reaktoro ${version}`
        : 'Reaktoro unavailable';
    failures.push(`${candidate.label}: ${reason}`);
    continue;
  }

  console.log(`[pressure-grid] using ${candidate.label} (Reaktoro ${version})`);
  const run = spawnSync(candidate.command, [...candidate.prefix, GENERATOR, ...process.argv.slice(2)], {
    cwd: ROOT,
    stdio: 'inherit',
    windowsHide: true,
  });
  if (run.error) {
    console.error(`[pressure-grid] failed to start generator: ${run.error.message}`);
    process.exit(1);
  }
  process.exit(run.status ?? 1);
}

console.error(`[pressure-grid] no Python environment with Reaktoro ${REQUIRED_REAKTORO} was found.`);
console.error('Create the pinned environment:');
console.error('  micromamba create -p .venv-pressure-grid -f environment-pressure-grid.yml');
console.error('Or set VUGG_REAKTORO_PYTHON to that environment\'s Python executable.');
if (failures.length) console.error(`Candidates checked:\n  ${failures.join('\n  ')}`);
process.exit(1);
