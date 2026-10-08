import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  collectChipChanges, loadChipMap, requireChipSelection, selectChipTests, validateChipMap,
} from '../tools/test-chip-check.mjs';
import { collectTestFiles, parseArgs } from '../tools/test-workflow.mjs';

const runner = 'tests-js/test-workflow.test.ts';
const ledger = 'tests-js/test-quarry-ledger.test.ts';
const selector = 'tests-js/test-chip-check.test.ts';
const allPresent = { exists: () => true };

describe('bounded authored chip selection', () => {
  // These expectations are deliberately authored independently of the JSON map.
  // Dropping a dependency from the map must fail a selected chip test.
  it.each([
    ['tools/test-workflow.mjs', [runner, ledger]],
    ['tests-js/test-workflow.test.ts', [runner, ledger]],
    ['tools/test-quarry-ledger.mjs', [runner, ledger]],
    ['tests-js/test-quarry-ledger.test.ts', [runner, ledger]],
    ['tools/test-chip-check.mjs', [runner, ledger, selector]],
    ['tools/test-chip-map.json', [runner, ledger, selector]],
    [selector, [runner, ledger, selector]],
  ])('maps %s to its required witnesses', (file, required) => {
    const plan = selectChipTests([file], allPresent);
    expect(plan.status).toBe('chip');
    expect(plan.tests).toEqual([...new Set([...required, selector])].sort());
    expect(plan.full_suite_pass).toBe(false);
  });

  it('selects only registered full-suite tests, with no duplicates or order dependence', () => {
    const map = loadChipMap();
    const changes = map.groups.flatMap(group => group.paths);
    const plan = selectChipTests([...changes, ...changes]);
    expect(plan.status).toBe('chip');
    expect(plan).toEqual(selectChipTests([...changes].reverse()));
    expect(plan.tests.every(test => collectTestFiles().includes(test))).toBe(true);
    expect(plan.tests).toEqual([selector, ledger, runner].sort());
  });

  it.each([
    'js/15-version.ts', 'data/scenarios.json5', 'tests-js/calibration-lib.ts',
    'tests-js/setup.ts', 'tests-js/helpers.ts', 'tests-js/new-science.test.ts',
    'tests-js/baselines/seed42_v285.json', 'archive/evidence/v285.json',
    'index.html', 'package.json', 'package-lock.json', 'tsconfig.json',
    'tools/prep-test-bundle.mjs', 'tools/new-helper.mjs', 'agent-api/vugg-agent.js',
    '.github/workflows/ci.yml', 'proposals/unknown.md',
  ])('requires a full check when %s accompanies a covered edit', (file) => {
    const plan = selectChipTests(['tools/test-workflow.mjs', file], allPresent);
    expect(plan.status).toBe('requires-full-check');
    expect(plan.uncovered).toContainEqual({ path: file, reason: 'outside authored map' });
    expect(() => requireChipSelection(plan)).toThrow('Full check required');
    expect(plan.full_suite_pass).toBe(false);
  });

  it('does not turn an empty or documentation-only diff into a PASS', () => {
    for (const changes of [[], ['README.md']]) {
      const plan = selectChipTests(changes, allPresent);
      expect(plan.status).toBe('no-test-selection');
      expect(plan.tests).toEqual([]);
      expect(() => requireChipSelection(plan)).toThrow('No PASS is issued');
    }
  });

  it.each(['tools/test-workflow.mjs', runner, selector])('fails closed on a missing %s', file => {
    const plan = selectChipTests(['tools/test-workflow.mjs'], { exists: name => name !== file });
    expect(plan.status).toBe('requires-full-check');
    expect(() => requireChipSelection(plan)).toThrow('Full check required');
  });

  it.each(['../outside', '/absolute', 'C:/absolute', 'tests-js/../tools/a.mjs', 'a\nfile', ''])('rejects unsafe path %j', file => {
    expect(() => selectChipTests([file], allPresent)).toThrow('repository-relative');
  });

  it('rejects malformed maps instead of silently narrowing their coverage', () => {
    const cloneMap = () => JSON.parse(JSON.stringify(loadChipMap()));
    const empty = cloneMap(); empty.groups[0].tests = [];
    expect(() => validateChipMap(empty)).toThrow('invalid chip map group');
    const duplicate = cloneMap(); duplicate.groups[1].paths.push(duplicate.groups[0].paths[0]);
    expect(() => validateChipMap(duplicate)).toThrow('duplicate chip path');
    const escape = cloneMap(); escape.groups[0].tests = ['../other.test.ts'];
    expect(() => validateChipMap(escape)).toThrow('invalid chip test');
    const falseDoc = cloneMap(); falseDoc.documentation.push('tools/test-workflow.mjs');
    expect(() => validateChipMap(falseDoc)).toThrow('documentation path');
  });

  it('does not let chip execution mix manual filtering, resume, reset, or batching', () => {
    expect(parseArgs(['--chip-base', 'origin/main'])).toMatchObject({ chipBase: 'origin/main', batchSize: 1 });
    for (const extra of [['--file', runner], ['--start-index', '0'], ['--fresh'], ['--batch-size', '1']]) {
      expect(() => parseArgs(['--chip-base', 'HEAD', ...extra])).toThrow('cannot be combined');
    }
    expect(() => parseArgs(['--chip-base'])).toThrow('requires a Git commit reference');
    expect(() => parseArgs(['--chip-base', '--fresh'])).toThrow('requires a Git commit reference');
    expect(() => parseArgs(['--chip-base', 'HEAD', '--chip-base', 'HEAD'])).toThrow('only be specified once');
  });

  it('collects branch, staged, unstaged, deleted, renamed, and untracked paths from Git', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vugg-chip-git-'));
    const git = (...args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: 'pipe', windowsHide: true });
    const write = (file: string, text: string) => fs.writeFileSync(path.join(root, file), text);
    const commit = (message: string) => git('-c', 'user.name=Chip Test', '-c', 'user.email=chip@example.invalid',
      '-c', 'commit.gpgsign=false', '-c', `core.hooksPath=${path.join(root, 'no-hooks')}`, 'commit', '-qm', message);
    try {
      git('init', '-q');
      for (const file of ['branch.txt', 'staged.txt', 'staged-undo.txt', 'unstaged.txt', 'deleted.txt', 'rename.txt']) write(file, 'before\n');
      write('.gitignore', '.local-evidence/\n');
      git('add', '.'); commit('base');
      const base = git('rev-parse', 'HEAD').trim();
      write('branch.txt', 'committed\n'); git('add', 'branch.txt'); commit('branch');
      // A worktree reversal must not cancel the committed branch change.
      write('branch.txt', 'before\n');
      write('staged.txt', 'staged\n'); git('add', 'staged.txt');
      write('staged-undo.txt', 'staged\n'); git('add', 'staged-undo.txt'); write('staged-undo.txt', 'before\n');
      write('unstaged.txt', 'unstaged\n');
      fs.unlinkSync(path.join(root, 'deleted.txt'));
      git('mv', 'rename.txt', 'renamed.txt');
      write('untracked space.txt', 'new\n');
      fs.mkdirSync(path.join(root, '.local-evidence'));
      write('.local-evidence/ignored.txt', 'operator output\n');
      expect(collectChipChanges({ root, base }).files).toEqual([
        'branch.txt', 'deleted.txt', 'rename.txt', 'renamed.txt', 'staged-undo.txt', 'staged.txt', 'unstaged.txt', 'untracked space.txt',
      ]);
      expect(() => collectChipChanges({ root, base: 'does-not-exist' })).toThrow();
      expect(() => collectChipChanges({ root, base: '--all' })).toThrow('commit reference');
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  });
});
