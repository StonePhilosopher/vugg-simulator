/** Bounded, authored test selection. A chip result is never a full-suite verdict. */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SELF_TEST = 'tests-js/test-chip-check.test.ts';
export const CHIP_SELECTION_EXIT_CODE = 2;

function safeRelativePath(value) {
  return typeof value === 'string' && value.length > 0
    && !/[\\:\x00-\x1f]/.test(value) && !path.posix.isAbsolute(value)
    && value.split('/').every(part => part && part !== '.' && part !== '..');
}

export function loadChipMap(root = ROOT) {
  const map = JSON.parse(fs.readFileSync(path.join(root, 'tools/test-chip-map.json'), 'utf8'));
  validateChipMap(map);
  return map;
}

export function validateChipMap(map) {
  if (map?.schema !== 'vugg-chip-map-v1' || map.scope !== 'audited-development-tooling'
      || !Array.isArray(map.groups) || !map.groups.length || !Array.isArray(map.documentation)) {
    throw new Error('invalid chip map schema or scope');
  }
  const paths = new Set();
  const ids = new Set();
  for (const group of map.groups) {
    if (!group?.id || ids.has(group.id) || typeof group.reason !== 'string' || !group.reason
        || !Array.isArray(group.paths) || !group.paths.length
        || !Array.isArray(group.tests) || !group.tests.length) throw new Error('invalid chip map group');
    ids.add(group.id);
    for (const file of group.paths) {
      if (!safeRelativePath(file) || paths.has(file)) throw new Error(`invalid or duplicate chip path: ${file}`);
      paths.add(file);
    }
    for (const file of group.tests) {
      if (!safeRelativePath(file) || !/^tests-js\/[a-z0-9/-]+\.test\.ts$/.test(file)) {
        throw new Error(`invalid chip test: ${file}`);
      }
    }
  }
  for (const file of map.documentation) {
    if (!safeRelativePath(file) || !file.endsWith('.md') || paths.has(file)) {
      throw new Error(`invalid or duplicate chip documentation path: ${file}`);
    }
    paths.add(file);
  }
  return map;
}

export function selectChipTests(changedFiles, {
  map = loadChipMap(),
  exists = file => fs.existsSync(path.join(ROOT, file)),
} = {}) {
  validateChipMap(map);
  if (!Array.isArray(changedFiles) || changedFiles.some(file => !safeRelativePath(file))) {
    throw new Error('chip changes must be repository-relative paths');
  }
  const changed = [...new Set(changedFiles)].sort();
  const tests = new Set();
  const matches = [];
  const uncovered = [];
  for (const file of changed) {
    const group = map.groups.find(candidate => candidate.paths.includes(file));
    if (group && exists(file)) {
      matches.push({ path: file, subsystem: group.id, reason: group.reason });
      group.tests.forEach(test => tests.add(test));
    } else if (map.documentation.includes(file)) {
      matches.push({ path: file, subsystem: 'documentation', reason: 'Authored documentation-only path.' });
    } else {
      uncovered.push({ path: file, reason: group ? 'mapped file deleted or unavailable' : 'outside authored map' });
    }
  }
  // Always exercise the selector's own guards when it makes a test selection.
  if (tests.size) tests.add(SELF_TEST);
  for (const file of tests) {
    if (!exists(file)) uncovered.push({ path: file, reason: 'selected test missing' });
  }
  return {
    schema: 'vugg-chip-plan-v1', scope: map.scope, full_suite_pass: false,
    status: uncovered.length ? 'requires-full-check' : tests.size ? 'chip' : 'no-test-selection',
    changed_files: changed, matches, uncovered, tests: [...tests].sort(),
  };
}

export function collectChipChanges({ root = ROOT, base = 'origin/main' } = {}) {
  if (typeof base !== 'string' || !base || base.startsWith('-')) throw new Error('chip base must be a Git commit reference');
  const git = (...args) => execFileSync('git', args, {
    cwd: root, encoding: 'utf8', stdio: 'pipe', windowsHide: true, maxBuffer: 16 * 1024 * 1024,
  });
  const baseSha = git('rev-parse', '--verify', '--end-of-options', `${base}^{commit}`).trim();
  const headSha = git('rev-parse', '--verify', 'HEAD').trim();
  const mergeBase = git('merge-base', baseSha, headSha).trim();
  // Separate diffs preserve committed/staged changes even if dirty edits undo them. Disable
  // rename detection so both the removed and added names require coverage.
  const branch = git('diff', '--no-ext-diff', '--no-renames', '--name-only', '-z', mergeBase, headSha, '--');
  const staged = git('diff', '--no-ext-diff', '--no-renames', '--name-only', '-z', '--cached', headSha, '--');
  const dirty = git('diff', '--no-ext-diff', '--no-renames', '--name-only', '-z', '--');
  const untracked = git('ls-files', '--others', '--exclude-standard', '-z');
  return {
    base, base_sha: baseSha, head_sha: headSha, merge_base_sha: mergeBase,
    files: [...new Set(`${branch}${staged}${dirty}${untracked}`.split('\0').filter(Boolean))].sort(),
  };
}

export function planChipCheck({ root = ROOT, base = 'origin/main' } = {}) {
  const changes = collectChipChanges({ root, base });
  return {
    ...selectChipTests(changes.files, {
      map: loadChipMap(root), exists: file => fs.existsSync(path.join(root, file)),
    }),
    comparison: { base: changes.base, base_sha: changes.base_sha,
      head_sha: changes.head_sha, merge_base_sha: changes.merge_base_sha },
  };
}

export class ChipSelectionRequiredError extends Error {
  constructor(plan) {
    super(plan.status === 'requires-full-check'
      ? `Full check required: ${plan.uncovered.map(row => `${row.path} (${row.reason})`).join('; ')}`
      : 'No tests selected: no mapped tooling change. No PASS is issued.');
    this.name = 'ChipSelectionRequiredError';
  }
}

export function requireChipSelection(plan) {
  if (plan.status !== 'chip' || !plan.tests.length) throw new ChipSelectionRequiredError(plan);
  return plan;
}

const invokedDirectly = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  try {
    const args = process.argv.slice(2);
    if (args.length === 1 && args[0] === '--help') {
      console.log('node tools/test-chip-check.mjs [--base REF]   # print JSON plan only');
      console.log('npm test -- --chip-base REF                 # prepare and run the selected tests');
    } else {
      if (args.length && (args.length !== 2 || args[0] !== '--base' || !args[1])) {
        throw new Error('expected --base REF');
      }
      const plan = planChipCheck({ base: args[1] ?? 'origin/main' });
      console.log(JSON.stringify(plan, null, 2));
      if (plan.status !== 'chip') process.exitCode = CHIP_SELECTION_EXIT_CODE;
    }
  } catch (error) {
    console.error(`[test-chip] Cannot select tests: ${error.message}`);
    process.exitCode = CHIP_SELECTION_EXIT_CODE;
  }
}
