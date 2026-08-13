#!/usr/bin/env node
/**
 * tools/baseline-diff.mjs — per-scenario movement summary between two
 * seed-42 baselines. The rebake-review companion to gen-js-baseline.mjs
 * (its header says "inspect the diff" — this is that, structured:
 * what moved per scenario, plus the fleet-level net-lost list, which is
 * the first red-flag to chase).
 *
 * Usage: node tools/baseline-diff.mjs [vOld] [vNew]
 *   defaults: the two highest seed42_v*.json present.
 *
 * WHAT "MOVED" MEANS, AND WHY IT CHANGED (2026-08-13)
 *
 * The GATE is tests-js/calibration.test.ts: `expect(got).toEqual(baseline[name])`,
 * a deep-equal over {active, dissolved, total, max_um} for every mineral. It
 * misses nothing, and a drift there fails the suite and forces the bump. This
 * tool is the review aid layered on top of that gate — and until now it carried
 * a WEAKER definition of "moved" than the gate did:
 *
 *   - it summed `total` across minerals before comparing, so a redistribution
 *     between minerals at constant scenario total was invisible;
 *   - it never read max_um, active or dissolved at all.
 *
 * Measured across the whole recorded history — 210 consecutive bumps, v26 to
 * v237 — it under-reported on 44 BUMPS, dropping 136 scenario-instances the
 * gate calls moved. (An earlier pass put this at 8, by counting only bumps the
 * old predicate called ENTIRELY clean. That misses the worse case: a review
 * that says "3 scenarios moved" when eight did, where the reviewer has no way
 * to know five are missing. 136 is the number that matters.) Some of the
 * dropped moves are large — turquoise 1006.5→460.3 at v67, proustite
 * 378.5→7.7 at v221, native_copper 54.7→4.9 at v231, quartz 101.3→3068.2 at
 * v221. Two of the silent bumps were substantive engine changes:
 *
 *   v167->v168  EH_DYNAMIC_ENABLED flipped on. Aid: 0/30. Gate: radioactive_
 *               pegmatite and schneeberg both moved. That commit got it right
 *               anyway — it reported "29/31 BYTE-IDENTICAL" from a direct check.
 *   v189->v190  the Joplin dogtooth fix. Aid: 0/33. Gate: mvt moved — 18 of its
 *               19 minerals shifted max_um, calcite 44632.2 -> 42490.1, a 4.8%
 *               move on the scenario's headline mineral, while its crystal total
 *               held at 45->45. That commit records "baseline-diff v189->v190 =
 *               0/33 movers (mvt's count+max_um aggregates hold)", crediting a
 *               max_um check this tool did not perform. The strip digest caught
 *               the drift, so nothing wrong shipped — but the summary was silent
 *               and the archive kept the reasoning.
 *
 * A review aid must not hold a weaker notion of "changed" than the thing that
 * gates. `scenarioMoved` below IS the gate's comparison; everything else this
 * tool knows goes into EXPLAINING the move, never into deciding whether there
 * was one. tools/drift-audit.mjs re-checks that property across all recorded
 * history, and tests-js/baseline-diff.test.ts pins it.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIR = path.join(ROOT, 'tests-js', 'baselines');

const FIELDS = ['active', 'dissolved', 'total', 'max_um'];

/**
 * The gate's comparison for one mineral entry, over the UNION of fields, so a
 * field added to `summarize()` later is compared without anyone remembering to
 * come back here.
 */
function sameEntry(a, b) {
  for (const f of new Set([...Object.keys(a ?? {}), ...Object.keys(b ?? {})])) {
    if ((a ?? {})[f] !== (b ?? {})[f]) return false;
  }
  return true;
}

/**
 * Did this scenario move? Identical in meaning to the suite's
 * `expect(got).toEqual(baseline[name])`.
 *
 * Deliberately NOT a JSON.stringify comparison: `summarize()` builds its mineral
 * keys in crystal-iteration order, so two byte-different files can carry the
 * same content in a different order. toEqual does not care and neither does this.
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

/** What moved, once `scenarioMoved` has already said that something did. */
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
      sizes.push({ m, from: va?.max_um ?? 0, to: vb?.max_um ?? 0 });
    }
    if ((va?.active ?? 0) !== (vb?.active ?? 0)) splits += 1;
  }
  // Ranked by RELATIVE move: a 4.8% shift on a 44 mm calcite is the story, and
  // ranking by absolute micrometres would report the biggest crystal every time.
  sizes.sort((x, y) => Math.abs(y.to - y.from) / Math.max(y.from, y.to, 1)
    - Math.abs(x.to - x.from) / Math.max(x.from, x.to, 1));

  return {
    gained,
    lost,
    countA,
    countB,
    counts,
    sizes,
    splits,
    /** True when the OLD predicate would have called this scenario clean. */
    aggregatesHeld: gained.length === 0 && lost.length === 0 && countA === countB,
  };
}

export function loadBaseline(v) {
  return JSON.parse(fs.readFileSync(path.join(DIR, `seed42_v${v}.json`), 'utf8'));
}

export function listVersions() {
  return fs.readdirSync(DIR)
    .map((f) => /^seed42_v(\d+)\.json$/.exec(f))
    .filter(Boolean).map((m) => Number(m[1])).sort((x, y) => x - y);
}

// ----- CLI driver -----

function isCliEntry() {
  try {
    return import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`
      || import.meta.url.endsWith(path.basename(process.argv[1] || ''));
  } catch {
    return false;
  }
}

function runCli() {
  const versions = listVersions();
  const [, , argOld, argNew] = process.argv;
  const vNew = argNew ? Number(String(argNew).replace(/^v/, '')) : versions[versions.length - 1];
  const vOld = argOld ? Number(String(argOld).replace(/^v/, '')) : versions[versions.length - 2];
  const A = loadBaseline(vOld);
  const B = loadBaseline(vNew);

  console.log(`baseline diff: v${vOld} → v${vNew}\n`);

  const scens = Object.keys(B).filter((k) => !k.startsWith('_'));
  let moved = 0;
  let quietMovers = 0;
  const gained = [];
  const lost = [];
  for (const s of scens) {
    if (!scenarioMoved(A[s], B[s])) continue;
    moved += 1;
    const d = describeMove(A[s] ?? {}, B[s] ?? {});
    if (d.aggregatesHeld) quietMovers += 1;
    gained.push(...d.gained);
    lost.push(...d.lost);

    const head = `  ${s}: species ${Object.keys(A[s] ?? {}).length}→${Object.keys(B[s] ?? {}).length}`
      + `, crystals ${d.countA}→${d.countB}`
      + (d.gained.length ? `  +[${d.gained.join(',')}]` : '')
      + (d.lost.length ? `  -[${d.lost.join(',')}]` : '');
    const detail = [];
    if (d.counts.length) detail.push(`counts on ${d.counts.length}`);
    if (d.sizes.length) detail.push(`max_um on ${d.sizes.length}`);
    if (d.splits) detail.push(`active/dissolved on ${d.splits}`);
    const loudest = d.sizes[0]
      ? `  loudest ${d.sizes[0].m} ${d.sizes[0].from}→${d.sizes[0].to}` : '';
    console.log(head + (detail.length ? `\n      moved: ${detail.join(', ')}${loudest}` : ''));
  }

  console.log(`\n${moved}/${scens.length} scenarios moved; species appearances gained ${gained.length}, lost ${lost.length}`);
  if (quietMovers) {
    console.log(`${quietMovers} of them moved ONLY in ways the pre-2026-08-13 summary could not see`
      + ` (same species, same scenario total; max_um and/or the active/dissolved split shifted)`);
  }
  const lostNet = [...new Set(lost)].filter((x) => !gained.includes(x));
  console.log('species lost fleet-wide (in no scenario anymore among the movers): '
    + (lostNet.length ? lostNet.join(', ') : '(none)'));
}

if (isCliEntry()) runCli();
