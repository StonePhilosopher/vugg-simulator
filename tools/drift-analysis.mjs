/**
 * tools/drift-analysis.mjs — the stronger movement comparison, as a library.
 *
 * ADDITIVE BY DESIGN. Nothing here modifies or replaces tools/baseline-diff.mjs.
 * That tool stays exactly as it was, and is the LEGACY MEASURING STICK this
 * module is measured against — delete drift-analysis.mjs and drift-audit.mjs
 * and the rebake workflow is untouched.
 *
 * WHY A SECOND COMPARISON EXISTS
 *
 * The gate is tests-js/calibration.test.ts:
 *   expect(got).toEqual(baseline[name])
 * a deep-equal over {active, dissolved, total, max_um} for every mineral. It
 * misses nothing, and any drift there fails the suite and forces the bump.
 *
 * tools/baseline-diff.mjs is the summary a human READS at rebake time, and it
 * asks a narrower question: species set difference, plus the SUM of `total`
 * across minerals per scenario. So three classes of real movement do not
 * appear in it:
 *
 *   REDISTRIBUTION  crystals moving between minerals at constant scenario
 *                   total — the sum cancels.
 *   SIZE-ONLY       any change to max_um. The field is never read.
 *   SPLIT           active vs dissolved reclassification at constant total.
 *
 * That is not a bug being fixed here. It is the thing being MEASURED. Keeping
 * both instruments is the point: the legacy summary is what the archive's
 * claims were written against, so the only way to know which of those claims
 * to re-read is to run the old tool and the gate side by side.
 *
 * `scenarioMoved` below IS the gate's comparison, so the audit never needs to
 * re-implement the thing it is checking against.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIR = path.join(ROOT, 'tests-js', 'baselines');
const LEGACY = path.join(ROOT, 'tools', 'baseline-diff.mjs');

/* --- data loading ----------------------------------------------------- */

export function listVersions() {
  return fs.readdirSync(DIR)
    .map((f) => /^seed42_v(\d+)\.json$/.exec(f))
    .filter(Boolean).map((m) => Number(m[1])).sort((a, b) => a - b);
}

export function loadBaseline(v) {
  return JSON.parse(fs.readFileSync(path.join(DIR, `seed42_v${v}.json`), 'utf8'));
}

export const scenariosOf = (base) => Object.keys(base).filter((k) => !k.startsWith('_'));

/* --- the gate's comparison -------------------------------------------- */

/**
 * One mineral entry, compared over the UNION of its fields — so a field added
 * to calibration.test.ts's `summarize()` later is compared without anyone
 * having to remember to come back here.
 */
export function sameEntry(a, b) {
  for (const f of new Set([...Object.keys(a ?? {}), ...Object.keys(b ?? {})])) {
    if ((a ?? {})[f] !== (b ?? {})[f]) return false;
  }
  return true;
}

/**
 * Did this scenario move? Identical in meaning to the suite's
 * `expect(got).toEqual(baseline[name])`.
 *
 * Deliberately NOT a JSON.stringify comparison: `summarize()` builds its
 * mineral keys in crystal-iteration order, so two byte-different files can
 * carry the same content in a different order. toEqual does not care, and a
 * stringify compare would report a phantom mover on every rebake.
 */
export function scenarioMoved(a, b) {
  const ka = Object.keys(a ?? {});
  const kb = Object.keys(b ?? {});
  if (ka.length !== kb.length) return true;
  for (const m of new Set([...ka, ...kb])) {
    if (!sameEntry((a ?? {})[m], (b ?? {})[m])) return true;
  }
  return false;
}

/** What moved, and in which of the three classes the legacy summary cannot see. */
export function describeMove(a = {}, b = {}) {
  const sa = new Set(Object.keys(a));
  const sb = new Set(Object.keys(b));
  const gained = [...sb].filter((m) => !sa.has(m));
  const lost = [...sa].filter((m) => !sb.has(m));
  const countA = Object.values(a).reduce((n, v) => n + (v.total ?? 0), 0);
  const countB = Object.values(b).reduce((n, v) => n + (v.total ?? 0), 0);

  const counts = [];
  const sizes = [];
  let splits = 0;
  for (const m of new Set([...sa, ...sb])) {
    const va = a[m];
    const vb = b[m];
    if ((va?.total ?? 0) !== (vb?.total ?? 0)) counts.push(m);
    if ((va?.max_um ?? 0) !== (vb?.max_um ?? 0)) {
      sizes.push({ mineral: m, from: va?.max_um ?? 0, to: vb?.max_um ?? 0 });
    }
    if ((va?.active ?? 0) !== (vb?.active ?? 0)) splits += 1;
  }
  // Ranked by RELATIVE move: a 4.8% slip on a 44 mm calcite is the story, and
  // ranking by absolute micrometres reports the biggest crystal every time.
  sizes.sort((x, y) => Math.abs(y.to - y.from) / Math.max(y.from, y.to, 1)
    - Math.abs(x.to - x.from) / Math.max(x.from, x.to, 1));

  /** Which of the legacy summary's blind classes this movement falls in. */
  const classes = [];
  if (gained.length || lost.length) classes.push('species');
  if (counts.length && countA === countB) classes.push('redistribution');
  else if (counts.length) classes.push('counts');
  if (sizes.length) classes.push('size');
  if (splits) classes.push('split');

  return {
    gained,
    lost,
    countA,
    countB,
    counts,
    sizes,
    splits,
    classes,
    /**
     * True when this scenario is invisible to the legacy summary: same species
     * set and the same scenario-wide crystal total, whatever moved underneath.
     */
    invisibleToLegacy: gained.length === 0 && lost.length === 0 && countA === countB,
  };
}

/* --- the legacy measuring stick, measured as it actually runs ---------- */

/**
 * Run tools/baseline-diff.mjs — the real one, unmodified — and read its verdict.
 *
 * A SUBPROCESS RATHER THAN A REIMPLEMENTATION, on purpose. Copying the legacy
 * predicate into this file would mean the audit compares the gate against a
 * REPRODUCTION of the old summary, and would keep saying so long after the real
 * one had changed. Shelling out means the audit always reports what an operator
 * running that command would actually see.
 *
 * Costs one process per pair — about a minute for the whole recorded history.
 * That is fine for something run at rebake time or on demand, and it is the
 * only version of this comparison that stays honest.
 *
 * Parses the two stable lines of its output: the `  <scenario>: species ...`
 * rows and the `N/M scenarios moved` summary. `parsed:false` comes back if the
 * format ever changes, which is itself worth knowing rather than papering over.
 */
export function legacySummary(vOld, vNew) {
  let stdout;
  try {
    stdout = execFileSync(process.execPath, [LEGACY, String(vOld), String(vNew)], {
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
    });
  } catch (err) {
    return { parsed: false, error: String(err && err.message), movers: [], moved: null, total: null };
  }
  const movers = [];
  for (const line of stdout.split('\n')) {
    const m = /^\s{2}(\S+): species /.exec(line);
    if (m) movers.push(m[1]);
  }
  const tail = /^(\d+)\/(\d+) scenarios moved/m.exec(stdout);
  return {
    parsed: Boolean(tail),
    movers,
    moved: tail ? Number(tail[1]) : null,
    total: tail ? Number(tail[2]) : null,
    stdout,
  };
}

/**
 * One bump, both instruments.
 *
 * `missed` is the useful output: scenarios the gate calls moved that the legacy
 * summary did not name, each with the reason it counts as changed.
 */
export function compareBump(vOld, vNew) {
  const A = loadBaseline(vOld);
  const B = loadBaseline(vNew);
  const scens = [...new Set([...scenariosOf(A), ...scenariosOf(B)])].sort();

  const legacy = legacySummary(vOld, vNew);
  const legacyNamed = new Set(legacy.movers);

  const gateMovers = [];
  const missed = [];
  for (const s of scens) {
    const a = A[s] ?? {};
    const b = B[s] ?? {};
    if (!scenarioMoved(a, b)) continue;
    gateMovers.push(s);
    if (!legacyNamed.has(s)) missed.push({ scenario: s, ...describeMove(a, b) });
  }
  return { from: vOld, to: vNew, scenarios: scens.length, gateMovers, legacy, missed };
}
