// tests-js/amethyst-geode.test.ts — W-F O5 masking sceptre, first content:
// the Brazilian amethyst geode + the revived D1b amethyst colour.
//
// Two things this pins:
//   1. THE SHOWCASE — amethyst_geode grows a MASKING sceptre (route='masking' off
//      the prism-dominant celadonite film) and it renders AMETHYST (the D1b path
//      the Three renderer uses, resolveBodyColour).
//   2. THE D1b REVIVAL is contained — amethyst was "authored-but-dormant" (its
//      Fe>2 trigger needed ~600 ppm fluid Fe against the trace_Fe×0.005 scale, and
//      the parser had no radiation ceiling so it out-ranked smoky). The fix makes
//      amethyst a MODERATE-dose variant (radiation 0.1-0.3) mutually exclusive with
//      smoky (>0.3). The regression guard: a heavy dose still renders smoky/morion,
//      and the sphalerite Fe LADDER still collapses to its lower bound (a crystal-
//      field ceiling must NOT leak into zone-trace ladders).

import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

declare const resolveBodyColour: any;
declare const COLOUR_LEXICON: any;
declare const VugSimulator: any;
declare const SCENARIOS: any;
declare const setSeed: any;

const SPEC = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'minerals.json'), 'utf8')).minerals;

// A quartz crystal with one growth zone carrying a given trace_Fe, and a dose.
function quartzXtal(radDmg: number, traceFe: number): any {
  return { mineral: 'quartz', radiation_damage: radDmg, zones: [{ thickness_um: 100, trace_Fe: traceFe }] };
}

describe('W-F O5 amethyst geode — the masking sceptre grows and renders amethyst', () => {
  const run = () => {
    setSeed(42);
    const scen = SCENARIOS['amethyst_geode']();
    const sim = new VugSimulator(scen.conditions, scen.events);
    const steps = scen.duration_steps ?? 110;
    for (let i = 0; i < steps; i++) sim.run_step();
    return sim;
  };

  it('grows at least one MASKING-route sceptre off the prism-dominant celadonite film', () => {
    const sim = run();
    const masking = sim.crystals.filter((c: any) => c && c.mineral === 'quartz' && c._sceptre && c._sceptre.route === 'masking');
    expect(masking.length).toBeGreaterThan(0);
    const s = masking[0]._sceptre;
    expect(s.stemUm).toBeGreaterThan(200);
    expect(s.capUm).toBeGreaterThan(200);
    expect(masking[0].habit).toBe('scepter_overgrowth');
  });

  it('the celadonite horizon is prism-dominant; the goethite stain is NOT a sceptre', () => {
    const sim = run();
    const q = sim.crystals.find((c: any) => c && c.mineral === 'quartz' && c._sceptre);
    const horizons = (q.zones || []).filter((z: any) => z.masked_horizon);
    const celadonite = horizons.find((z: any) => z.film_mineral === 'celadonite');
    const goethite = horizons.find((z: any) => z.film_mineral === 'iron oxide');
    expect(celadonite).toBeTruthy();
    expect(celadonite.masked_phi_prism).toBeGreaterThan(celadonite.masked_phi_term);   // prism-dominant → trigger
    expect(goethite).toBeTruthy();
    expect(goethite.masked_phi_prism).toBeLessThanOrEqual(goethite.masked_phi_term);    // uniform → buried, not a sceptre
  });

  it('the sceptre quartz renders AMETHYST via the D1b resolver', () => {
    const sim = run();
    const q = sim.crystals.find((c: any) => c && c.mineral === 'quartz' && c._sceptre && c._sceptre.route === 'masking');
    expect(q).toBeTruthy();
    // radiation landed in the amethyst band, Fe cleared the recalibrated gate.
    expect(q.radiation_damage).toBeGreaterThan(0.1);
    expect(q.radiation_damage).toBeLessThanOrEqual(0.3);
    expect(resolveBodyColour(q, SPEC.quartz)).toBe(COLOUR_LEXICON.amethyst);
  });
});

describe('W-F O5 amethyst — the D1b revival is contained (ripple guards)', () => {
  it('amethyst fires at a MODERATE dose with Fe', () => {
    expect(resolveBodyColour(quartzXtal(0.2, 0.4), SPEC.quartz)).toBe(COLOUR_LEXICON.amethyst);
  });

  it('a HEAVY dose renders smoky / morion, NOT amethyst (the mutual-exclusion the revival adds)', () => {
    // radiation 0.5 with Fe present would have fired amethyst under the old clause-
    // count priority; now the 0.1-0.3 ceiling excludes it and smoky wins.
    expect(resolveBodyColour(quartzXtal(0.5, 0.4), SPEC.quartz)).toBe(COLOUR_LEXICON.smoky);
    expect(resolveBodyColour(quartzXtal(0.7, 0.4), SPEC.quartz)).toBe(COLOUR_LEXICON.morion);
  });

  it('no dose → clear even with Fe (radiation gate holds)', () => {
    const c = resolveBodyColour(quartzXtal(0, 0.4), SPEC.quartz);
    expect(c).not.toBe(COLOUR_LEXICON.amethyst);
    expect(c).not.toBe(COLOUR_LEXICON.smoky);
  });

  it('the sphalerite Fe ladder still collapses to its lower bound (the crystal-field ceiling does not leak)', () => {
    // Fe=12 sits in the 10-15 data gap: above honey_brown's 2-10 top, below
    // marmatite's >15. It must round DOWN to honey_brown, never fall through — the
    // zone-trace ladder behaviour the radiation ceiling must not touch.
    const sph = { mineral: 'sphalerite', zones: [{ thickness_um: 100, trace_Fe: 12 }] };
    expect(resolveBodyColour(sph, SPEC.sphalerite)).toBe(COLOUR_LEXICON.honey_brown);
  });
});
