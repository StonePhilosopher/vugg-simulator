// tests-js/nucleation-hover.test.ts — nucleation hover popover (97b, 2026-07-08)
//
// The popover's promise: hover a σ pill and see the mineral's recipe as
// red/green chips evaluated against the CURRENT conditions. The logic
// under test is _nucleationHoverGroups — a pure builder over
// MINERAL_SPEC + a plain-readable conditions object — so these tests
// need no DOM and no sim.
//
// The load-bearing subtlety (boss call): the Library's "Acid
// dissolution: pH < 5" states when the crystal DIES; the popover states
// when it SURVIVES — `pH ≥ 5`, green in safe broth, red under acid
// attack. Dissolves-above species invert to `pH ≤ Y`.

import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

declare function _nucleationHoverGroups(name: string, c: any): Array<{ label: string; chips: Array<{ text: string; met: boolean; note?: string }> }>;
declare function _nucleationHoverHTML(name: string, c: any): string;

// Species discovery reads data/minerals.json from DISK (the scenario-
// menu-coverage pattern): the globalThis MINERAL_SPEC export is the
// load-time fallback snapshot — the bundle reassigns its inner binding
// when the full spec fetch lands, so the snapshot lacks the acid fields
// (the _liveRng staleness class). The builder itself runs inside the
// bundle and sees the live spec; both derive from this same file.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SPEC_DOC = (() => {
  const d = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'minerals.json'), 'utf8'));
  return (d.minerals || d) as Record<string, any>;
})();

function group(groups: any[], label: string) {
  return groups.find(g => g.label === label);
}

describe('nucleation hover popover (97b) — recipe chips vs live conditions', () => {
  it('actinolite, happy broth: every chip green, acid chip reads the REVERSED survival condition', () => {
    const c = { temperature: 400, fluid: { Ca: 100, Mg: 40, Fe: 40, SiO2: 300, pH: 6.0, Cr: 2, Mn: 0 } };
    const groups = _nucleationHoverGroups('actinolite', c);
    expect(groups.map(g => g.label)).toEqual(['T window', 'Requires', 'Traces', 'Acid dissolution']);

    const t = group(groups, 'T window').chips[0];
    expect(t.text).toBe('200–700°C (optimum 300–500)');
    expect(t.met).toBe(true);

    const req = group(groups, 'Requires').chips;
    expect(req.map((ch: any) => ch.text)).toEqual(['Ca ≥60', 'Mg ≥30', 'Fe ≥30', 'SiO2 ≥250']);
    expect(req.every((ch: any) => ch.met)).toBe(true);

    const traces = group(groups, 'Traces').chips;
    expect(traces.map((ch: any) => ch.text)).toEqual(['Cr', 'Mn']);
    expect(traces[0].met).toBe(true);   // Cr 2 ppm in the broth
    expect(traces[1].met).toBe(false);  // no Mn
    expect(traces[0].note).toContain('smaragdite'); // spec flavor rides as chip tooltip

    // THE REVERSAL: library says "dissolves pH < 5"; popover states survival.
    const acid = group(groups, 'Acid dissolution').chips[0];
    expect(acid.text).toBe('pH ≥ 5');
    expect(acid.met).toBe(true); // pH 6 — safe
  });

  it('actinolite, hostile broth: cold, starved, and under acid attack — chips go red', () => {
    const c = { temperature: 150, fluid: { Ca: 10, Mg: 40, Fe: 40, SiO2: 300, pH: 4.0, Cr: 0, Mn: 0 } };
    const groups = _nucleationHoverGroups('actinolite', c);
    expect(group(groups, 'T window').chips[0].met).toBe(false);      // 150 < 200
    const req = group(groups, 'Requires').chips;
    expect(req.find((ch: any) => ch.text === 'Ca ≥60').met).toBe(false);
    expect(req.find((ch: any) => ch.text === 'Mg ≥30').met).toBe(true);
    // pH 4 < 5: the crystal is dissolving — the survival chip is red.
    expect(group(groups, 'Acid dissolution').chips[0].met).toBe(false);
  });

  it('dissolves-above species invert to pH ≤ Y (scorodite class)', () => {
    // The 95-ui-library acidText comment names the dissolves-above
    // minerals; find one from the spec file rather than hardcoding.
    const name = Object.keys(SPEC_DOC).find(n => SPEC_DOC[n] && SPEC_DOC[n].pH_dissolution_above != null);
    expect(name).toBeTruthy();
    const y = SPEC_DOC[name!].pH_dissolution_above;
    const safe = _nucleationHoverGroups(name!, { temperature: 100, fluid: { pH: y - 0.5 } });
    const chipSafe = group(safe, 'Acid dissolution').chips.find((ch: any) => ch.text === `pH ≤ ${y}`);
    expect(chipSafe).toBeTruthy();
    expect(chipSafe.met).toBe(true);
    const hostile = _nucleationHoverGroups(name!, { temperature: 100, fluid: { pH: y + 0.5 } });
    expect(group(hostile, 'Acid dissolution').chips.find((ch: any) => ch.text === `pH ≤ ${y}`).met).toBe(false);
  });

  it('threshold-less acid_dissolution species chip as "resistant", always green', () => {
    const name = Object.keys(SPEC_DOC).find(n => {
      const m = SPEC_DOC[n];
      return m && m.acid_dissolution
        && (m.acid_dissolution.pH_threshold == null)
        && m.pH_dissolution_below == null
        && m.pH_dissolution_above == null;
    });
    expect(name).toBeTruthy(); // beryl / tourmaline family per the library comment
    const groups = _nucleationHoverGroups(name!, { temperature: 100, fluid: { pH: 1.0 } });
    const acid = group(groups, 'Acid dissolution');
    expect(acid.chips[0].text).toBe('resistant');
    expect(acid.chips[0].met).toBe(true); // even at pH 1
  });

  it('HTML renderer: met/unmet classes land on the chips, trace notes become tooltips', () => {
    const c = { temperature: 400, fluid: { Ca: 100, Mg: 40, Fe: 40, SiO2: 300, pH: 4.0, Cr: 2, Mn: 0 } };
    const html = _nucleationHoverHTML('actinolite', c);
    expect(html).toContain('nuc-pop-head');
    expect(html).toContain('class="nuc-chip met"');
    expect(html).toContain('class="nuc-chip unmet"'); // pH 4 → acid chip red
    expect(html).toContain('title="'); // Cr/Mn flavor text
    // Unknown mineral or missing conditions degrade to empty, not a throw.
    expect(_nucleationHoverHTML('not_a_mineral', c)).toBe('');
    expect(_nucleationHoverHTML('actinolite', null)).toBe('');
  });
});
