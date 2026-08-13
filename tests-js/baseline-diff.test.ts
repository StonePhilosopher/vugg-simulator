// tests-js/baseline-diff.test.ts
//
// Unit tests for tools/baseline-diff.mjs — the rebake-review summary.
//
// The one property that matters: the summary's notion of "moved" must be
// IDENTICAL to the gate's. The gate is calibration.test.ts's
// `expect(got).toEqual(baseline[name])`; this tool is the thing a human reads
// to find out what that drift was. Until 2026-08-13 it carried a weaker
// definition — species set plus the SUM of totals per scenario — and printed
// "0 scenarios moved" on eight bumps in the recorded history.
//
// The most important test here is the v190 back-test, in the same spirit as
// twin-law-check.test.ts's v142 fabricated-adamite back-test: feed the real
// v189 -> v190 mvt pair through `scenarioMoved` and it must say moved. That
// proves the tool would now catch the case that motivated the fix.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { describeMove, listVersions, loadBaseline, scenarioMoved } from '../tools/baseline-diff.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASELINES = path.join(ROOT, 'tests-js', 'baselines');

const entry = (active: number, dissolved: number, max_um: number) =>
  ({ active, dissolved, total: active + dissolved, max_um });

describe('baseline-diff — "moved" means what the gate means', () => {
  it('an identical pair has not moved', () => {
    const a = { calcite: entry(2, 1, 44632.2), barite: entry(0, 3, 28.2) };
    const b = { calcite: entry(2, 1, 44632.2), barite: entry(0, 3, 28.2) };
    expect(scenarioMoved(a, b)).toBe(false);
  });

  it('key ORDER is not a move', () => {
    // summarize() builds mineral keys in crystal-iteration order, so two
    // byte-different files can hold identical content. A JSON.stringify
    // comparison would report a phantom mover on every rebake.
    const a = { calcite: entry(2, 1, 44632.2), barite: entry(0, 3, 28.2) };
    const b = { barite: entry(0, 3, 28.2), calcite: entry(2, 1, 44632.2) };
    expect(scenarioMoved(a, b)).toBe(false);
  });

  it('a max_um-only shift IS a move', () => {
    // The blind spot: the old predicate never read this field at all.
    const a = { calcite: entry(2, 1, 44632.2) };
    const b = { calcite: entry(2, 1, 42490.1) };
    expect(scenarioMoved(a, b)).toBe(true);
    expect(describeMove(a, b).aggregatesHeld).toBe(true);
  });

  it('a redistribution at constant scenario total IS a move', () => {
    // The other blind spot: totals were summed across minerals first, so
    // three crystals moving from one species to another cancelled out.
    const a = { calcite: entry(5, 0, 100), aragonite: entry(2, 0, 50) };
    const b = { calcite: entry(2, 0, 100), aragonite: entry(5, 0, 50) };
    expect(Object.values(a).reduce((n, v) => n + v.total, 0))
      .toBe(Object.values(b).reduce((n, v) => n + v.total, 0));
    expect(scenarioMoved(a, b)).toBe(true);
  });

  it('an active/dissolved reclassification IS a move', () => {
    const a = { calcite: entry(3, 0, 100) };
    const b = { calcite: entry(0, 3, 100) };
    expect(scenarioMoved(a, b)).toBe(true);
  });

  it('a species gained or lost is still a move', () => {
    expect(scenarioMoved({ calcite: entry(1, 0, 10) }, {})).toBe(true);
    expect(scenarioMoved({}, { calcite: entry(1, 0, 10) })).toBe(true);
  });
});

describe('baseline-diff — back-test against the real history', () => {
  it('v189 -> v190 mvt: the Joplin dogtooth drift the old summary missed', () => {
    const a = loadBaseline(189).mvt;
    const b = loadBaseline(190).mvt;
    expect(scenarioMoved(a, b)).toBe(true);

    const d = describeMove(a, b);
    // Same species, same scenario total — which is exactly why it was silent.
    expect(d.gained).toEqual([]);
    expect(d.lost).toEqual([]);
    expect(d.countA).toBe(d.countB);
    expect(d.aggregatesHeld).toBe(true);
    // And yet almost every mineral in the scenario changed size.
    expect(d.sizes.length).toBeGreaterThanOrEqual(18);
  });

  it('v167 -> v168 radioactive_pegmatite: the Eh flag-flip drift', () => {
    expect(scenarioMoved(loadBaseline(167).radioactive_pegmatite,
      loadBaseline(168).radioactive_pegmatite)).toBe(true);
  });
});

describe('baseline-diff — the predicate agrees with vitest toEqual', () => {
  // The property, checked against real data rather than fixtures. Restricted
  // to the most recent 60 bumps to keep the suite quick; drift-audit.mjs
  // sweeps the whole history on demand.
  const versions = listVersions().slice(-61);

  it(`agrees on every scenario of ${versions.length - 1} recent bumps`, () => {
    let checked = 0;
    for (let i = 1; i < versions.length; i += 1) {
      const A = loadBaseline(versions[i - 1]);
      const B = loadBaseline(versions[i]);
      const scens = [...new Set([...Object.keys(A), ...Object.keys(B)])].filter((k) => !k.startsWith('_'));
      for (const s of scens) {
        let gateSaysEqual = true;
        try {
          expect(A[s] ?? {}).toEqual(B[s] ?? {});
        } catch {
          gateSaysEqual = false;
        }
        expect(scenarioMoved(A[s] ?? {}, B[s] ?? {}),
          `v${versions[i - 1]}→v${versions[i]} ${s}`).toBe(!gateSaysEqual);
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(1000);
  });

  it('every baseline file the repo carries is loadable', () => {
    for (const v of listVersions()) {
      expect(fs.existsSync(path.join(BASELINES, `seed42_v${v}.json`)), `v${v}`).toBe(true);
    }
  });
});
