#!/usr/bin/env node
/**
 * tools/cold-ci.mjs — run the full guard and STAMP the verdict.
 *
 * The cold-CI discipline (CATCHES.md, 10th catch): run `npm run ci` at the
 * very start of a session, before touching a single file, to learn whether
 * the inherited tree is actually green rather than assuming it. The 10th
 * catch is why: a comment edit after the final build left the committed
 * bundle stale, the guard's summary statistic lied ("diff length: 0
 * chars"), and the next session started on a red tree without knowing.
 *
 * What this wrapper adds over bare `npm run ci`: a VERDICT THAT PERSISTS.
 * On every run it writes `.ci-stamp.json` (gitignored) at the repo root:
 *
 *   { commit, dirty, verdict: "green"|"red", exitCode,
 *     startedAt, finishedAt, durationSec, node, simVersion }
 *
 * The next session (or the vugg-session-start skill) reads the stamp
 * first: if `commit` matches HEAD, the tree is clean, and the verdict is
 * green, the 9-minute re-run buys nothing — the answer is already known.
 * Any mismatch (new HEAD, dirty tree, red, or no stamp) → run this again.
 *
 * A DIRTY tree is stamped but the stamp records dirty:true — a verdict
 * earned on uncommitted work vouches for that working state only, not for
 * HEAD. (Concurrent-session note: two sessions sharing the repo will race
 * the stamp; the commit field is what keeps a stale stamp from lying.)
 *
 * Usage:
 *   node tools/cold-ci.mjs           # run ci + stamp
 *   node tools/cold-ci.mjs --check   # read the stamp, no run: exits 0 if
 *                                    #   it vouches for HEAD (clean+green),
 *                                    #   1 otherwise (with the reason)
 */

import { execSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const STAMP = path.join(ROOT, '.ci-stamp.json');

const git = (args) => execSync(`git ${args}`, { cwd: ROOT, encoding: 'utf8' }).trim();
const head = () => git('rev-parse HEAD');
const isDirty = () => git('status --porcelain') !== '';

if (process.argv.includes('--check')) {
  if (!fs.existsSync(STAMP)) {
    console.log('[cold-ci] no stamp — run `node tools/cold-ci.mjs`');
    process.exit(1);
  }
  const s = JSON.parse(fs.readFileSync(STAMP, 'utf8'));
  const reasons = [];
  if (s.commit !== head()) reasons.push(`stamp is for ${s.commit.slice(0, 7)}, HEAD is ${head().slice(0, 7)}`);
  if (s.dirty) reasons.push('stamp was earned on a DIRTY tree');
  if (isDirty()) reasons.push('tree is dirty NOW (stamp vouches for HEAD only)');
  if (s.verdict !== 'green') reasons.push(`stamped verdict is ${s.verdict.toUpperCase()}`);
  if (reasons.length) {
    console.log(`[cold-ci] stamp does NOT vouch for this tree:\n  - ${reasons.join('\n  - ')}`);
    process.exit(1);
  }
  console.log(`[cold-ci] GREEN — ${s.commit.slice(0, 7)} verified ${s.finishedAt} (${s.durationSec}s, sim v${s.simVersion ?? '?'})`);
  process.exit(0);
}

const startedAt = new Date().toISOString();
const t0 = Date.now();
const commit = head();
const dirty = isDirty();

console.log(`[cold-ci] running full guard on ${commit.slice(0, 7)}${dirty ? ' (DIRTY tree)' : ''}…`);
const r = spawnSync('npm', ['run', 'ci'], { cwd: ROOT, stdio: 'inherit', shell: true });

let simVersion = null;
try {
  const m = /const SIM_VERSION = (\d+)/.exec(fs.readFileSync(path.join(ROOT, 'js', '15-version.ts'), 'utf8'));
  if (m) simVersion = Number(m[1]);
} catch { /* stamp without it */ }

const stamp = {
  commit,
  dirty,
  verdict: r.status === 0 ? 'green' : 'red',
  exitCode: r.status,
  startedAt,
  finishedAt: new Date().toISOString(),
  durationSec: Math.round((Date.now() - t0) / 1000),
  node: process.version,
  simVersion,
};
fs.writeFileSync(STAMP, JSON.stringify(stamp, null, 2) + '\n');
console.log(`[cold-ci] ${stamp.verdict.toUpperCase()} in ${stamp.durationSec}s — stamped .ci-stamp.json for ${commit.slice(0, 7)}${dirty ? ' (dirty: vouches for the working state, not HEAD)' : ''}`);
process.exit(r.status ?? 1);
