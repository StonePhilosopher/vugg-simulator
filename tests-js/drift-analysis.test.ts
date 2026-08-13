// tests-js/drift-analysis.test.ts
//
// Tests for tools/drift-analysis.mjs and tools/drift-audit.mjs — the additive
// drift audit. NOTHING here tests changed behaviour of tools/baseline-diff.mjs,
// because that tool is deliberately unchanged; the last block asserts exactly
// that, including its known under-reporting, which is the property being
// measured rather than a bug to fix.
//
// The most important test is the v190 back-test, in the same spirit as
// twin-law-check.test.ts's v142 fabricated-adamite back-test: feed the real
// v189 -> v190 mvt pair through and the audit must both flag it as moved and
// name it as one the legacy summary did not report.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  compareBump,
  describeMove,
  legacySummary,
  listVersions,
  loadBaseline,
  scenarioMoved,
} from '../tools/drift-analysis.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LEGACY = path.join(ROOT, 'tools', 'baseline-diff.mjs');

const entry = (active: number, dissolved: number, max_um: number) =>
  ({ active, dissolved, total: active + dissolved, max_um });

describe('drift-analysis — the gate\'s comparison', () => {
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

  it('SIZE-ONLY: a max_um shift is a move the legacy summary cannot see', () => {
    const a = { calcite: entry(2, 1, 44632.2) };
    const b = { calcite: entry(2, 1, 42490.1) };
    expect(scenarioMoved(a, b)).toBe(true);
    const d = describeMove(a, b);
    expect(d.invisibleToLegacy).toBe(true);
    expect(d.classes).toContain('size');
  });

  it('REDISTRIBUTION: crystals moving between minerals at constant total', () => {
    const a = { calcite: entry(5, 0, 100), aragonite: entry(2, 0, 50) };
    const b = { calcite: entry(2, 0, 100), aragonite: entry(5, 0, 50) };
    expect(Object.values(a).reduce((n, v) => n + v.total, 0))
      .toBe(Object.values(b).reduce((n, v) => n + v.total, 0));
    expect(scenarioMoved(a, b)).toBe(true);
    const d = describeMove(a, b);
    expect(d.invisibleToLegacy).toBe(true);
    expect(d.classes).toContain('redistribution');
  });

  it('SPLIT: an active/dissolved reclassification at constant total', () => {
    const a = { calcite: entry(3, 0, 100) };
    const b = { calcite: entry(0, 3, 100) };
    expect(scenarioMoved(a, b)).toBe(true);
    const d = describeMove(a, b);
    expect(d.invisibleToLegacy).toBe(true);
    expect(d.classes).toContain('split');
  });

  it('a species gained or lost is a move the legacy summary DOES see', () => {
    const d = describeMove({ calcite: entry(1, 0, 10) }, {});
    expect(scenarioMoved({ calcite: entry(1, 0, 10) }, {})).toBe(true);
    expect(d.invisibleToLegacy).toBe(false);
    expect(d.classes).toContain('species');
  });

  it('size moves are ranked by RELATIVE change, not absolute micrometres', () => {
    const a = { big: entry(1, 0, 40000), small: entry(1, 0, 10) };
    const b = { big: entry(1, 0, 39000), small: entry(1, 0, 1) };
    expect(describeMove(a, b).sizes[0].mineral).toBe('small');
  });
});

describe('drift-analysis — back-test against the real history', () => {
  it('v189 -> v190 mvt: the Joplin dogtooth drift the summary missed', () => {
    const a = loadBaseline(189).mvt;
    const b = loadBaseline(190).mvt;
    expect(scenarioMoved(a, b)).toBe(true);

    const d = describeMove(a, b);
    expect(d.gained).toEqual([]);
    expect(d.lost).toEqual([]);
    expect(d.countA).toBe(d.countB);
    expect(d.invisibleToLegacy).toBe(true);
    expect(d.sizes.length).toBeGreaterThanOrEqual(18);
    expect(d.classes).toEqual(expect.arrayContaining(['redistribution', 'size', 'split']));
  });

  it('v167 -> v168: the Eh flag-flip drift, on two scenarios', () => {
    for (const s of ['radioactive_pegmatite', 'schneeberg']) {
      expect(scenarioMoved(loadBaseline(167)[s], loadBaseline(168)[s]), s).toBe(true);
    }
  });

  it('the predicate agrees with vitest toEqual across recent history', () => {
    // The property, against real data rather than fixtures. Restricted to the
    // most recent 40 bumps to keep the suite quick; drift-audit.mjs sweeps the
    // whole history on demand.
    const versions = listVersions().slice(-41);
    let checked = 0;
    for (let i = 1; i < versions.length; i += 1) {
      const A = loadBaseline(versions[i - 1]);
      const B = loadBaseline(versions[i]);
      const scens = [...new Set([...Object.keys(A), ...Object.keys(B)])].filter((k) => !k.startsWith('_'));
      for (const s of scens) {
        let equal = true;
        try {
          expect(A[s] ?? {}).toEqual(B[s] ?? {});
        } catch {
          equal = false;
        }
        expect(scenarioMoved(A[s] ?? {}, B[s] ?? {}),
          `v${versions[i - 1]}→v${versions[i]} ${s}`).toBe(!equal);
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(1000);
  });
});

describe('drift-audit — the comparison between the two instruments', () => {
  it('reads the legacy tool by RUNNING it, not by reproducing it', () => {
    const legacy = legacySummary(189, 190);
    expect(legacy.parsed).toBe(true);
    expect(legacy.moved).toBe(0);
    expect(legacy.total).toBe(33);
    expect(legacy.movers).toEqual([]);
  });

  it('v189 -> v190: names mvt as missed, with the reasons it counts as changed', () => {
    const r = compareBump(189, 190);
    expect(r.legacy.moved).toBe(0);
    expect(r.gateMovers).toEqual(['mvt']);
    expect(r.missed).toHaveLength(1);
    expect(r.missed[0].scenario).toBe('mvt');
    expect(r.missed[0].classes).toEqual(expect.arrayContaining(['redistribution', 'size', 'split']));
  });

  it('v167 -> v168: names both scenarios the summary missed', () => {
    const r = compareBump(167, 168);
    expect(r.legacy.moved).toBe(0);
    expect(r.missed.map((m: { scenario: string }) => m.scenario).sort())
      .toEqual(['radioactive_pegmatite', 'schneeberg']);
  });

  it('agrees with the legacy tool where the legacy tool is right', () => {
    // The audit must not cry wolf. These bumps really are what the archive says.
    for (const [a, b] of [[207, 208], [211, 212], [212, 213]]) {
      const r = compareBump(a, b);
      expect(r.gateMovers, `v${a}→v${b}`).toEqual([]);
      expect(r.missed, `v${a}→v${b}`).toEqual([]);
    }
    const r = compareBump(213, 214);
    expect(r.gateMovers).toEqual(['great_salt_plains']);
    expect(r.missed).toEqual([]);       // the legacy summary named it too
  });
});

describe('REGRESSION — tools/baseline-diff.mjs is unchanged', () => {
  // This block exists so the audit can never quietly become a replacement.
  // The legacy summary is the measuring stick the archive's claims were written
  // against; its narrower notion of "moved" is the thing being MEASURED, not a
  // defect to repair here. If someone later "fixes" it, these fail loudly and
  // the comparison the audit exists to make has to be reconsidered on purpose.

  it('exports nothing — it is a CLI script, not a library', () => {
    const src = fs.readFileSync(LEGACY, 'utf8');
    expect(/^\s*export\b/m.test(src)).toBe(false);
  });

  it('still runs with no arguments and defaults to the two highest baselines', () => {
    const versions = listVersions();
    const out = execFileSync(process.execPath, [LEGACY], { encoding: 'utf8' });
    expect(out).toContain(`baseline diff: v${versions[versions.length - 2]} → v${versions[versions.length - 1]}`);
    expect(out).toMatch(/^\d+\/\d+ scenarios moved; species appearances gained \d+, lost \d+$/m);
    expect(out).toContain('species lost fleet-wide (in no scenario anymore among the movers): ');
  });

  it('still reports its KNOWN-WEAKER verdicts, unchanged', () => {
    // Deliberately pinning the under-reporting. 189->190 and 167->168 both
    // moved by the gate; the legacy summary says 0 and must keep saying 0.
    for (const [a, b, expected] of [[189, 190, '0/33'], [167, 168, '0/30'], [213, 214, '1/37']] as const) {
      const out = execFileSync(process.execPath, [LEGACY, String(a), String(b)], { encoding: 'utf8' });
      expect(out, `v${a}→v${b}`).toContain(`${expected} scenarios moved`);
    }
  });

  it('its full output for one pair is byte-for-byte what it always was', () => {
    const out = execFileSync(process.execPath, [LEGACY, '213', '214'], { encoding: 'utf8' });
    expect(out).toBe([
      'baseline diff: v213 → v214',
      '',
      '  great_salt_plains: species 5→5, crystals 30→28',
      '',
      '1/37 scenarios moved; species appearances gained 0, lost 0',
      'species lost fleet-wide (in no scenario anymore among the movers): (none)',
      '',
    ].join('\n'));
  });
});
