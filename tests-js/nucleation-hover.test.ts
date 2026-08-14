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
declare function _nucleationHoverHTML(name: string, c: any, sim?: any, sigmaOverride?: number | null): string;
declare function _buildMineralFormationExplanation(name: string, c: any, sim?: any, sigmaOverride?: number | null): any;
declare function _renderFortressSigmaGroups(c: any, host: HTMLElement): void;
declare function ehFromO2(o2: number): number;
declare function assessProductionNucleationDecision(name: string, sim: any, sigma: number, sigmaCrit: number): any;
declare function _formationAvailableAmount(name: string, species: string, c: any): number;

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

  it('does not advertise a literature-only substrate route that the calcite engine cannot execute', () => {
    const c = {
      temperature: 25,
      fluid: { Ca: 0.5, CO3: 100, pH: 7, O2: 1, Eh: ehFromO2(1) },
      supersaturation_calcite() { return 1.2; },
    };
    const sim = {
      conditions: c,
      crystals: [
        { mineral: 'fluorite', active: true, dissolved: false, enclosed_by: null },
        { mineral: 'aragonite', active: true, dissolved: false, enclosed_by: null },
      ],
    };
    const why = _buildMineralFormationExplanation('calcite', c, sim, 1.2);

    // Calcite's real registry threshold is 1.5, not the panel's legacy 1.0.
    expect(why.sigmaCrit).toBe(1.5);
    expect(why.chemistryEligible).toBe(false);
    // Calcite always uses its bare-wall >1.5 route. The broader literature
    // table contains calcite-on-fluorite, but no executable engine route does.
    expect(why.substrateEligible).toBe(false);
    expect(why.state).toBe('blocked');

    const reagents = group(why.groups, 'Calibrated growth budget').chips;
    expect(reagents[0].text).toContain('Ca');
    expect(reagents[0].text).toContain('limiting booked reagent');
    expect(reagents[0].text).toContain('proxy axial µm');
    expect(reagents[0].note).toContain('not physical solid mass or volume');
    expect(reagents[0].note).toContain('demand is independent of crystal size, habit, density, and rendered shell volume');
    const source = fs.readFileSync(path.join(ROOT, 'js', '97b-ui-sigma-panel.ts'), 'utf8');
    expect(source).toContain('STOICHIOMETRIC_GROWTH_BUDGET_DISCLOSURE.preserves');
    expect(source).toContain('STOICHIOMETRIC_GROWTH_BUDGET_DISCLOSURE.limitation');
    expect(reagents[0].met).toBe(true); // some Ca remains; this is capacity, not the floor gate
    const floors = group(why.groups, 'Nucleation floors').chips;
    expect(floors.find((chip: any) => chip.text.startsWith('Ca ')).met).toBe(false);
    expect(group(why.groups, 'Substrate').chips.some((ch: any) => ch.text.includes('fluorite'))).toBe(false);
    expect(group(why.groups, 'Competition').chips.some((ch: any) => ch.text.includes('aragonite') && ch.text.includes('Ca'))).toBe(true);
  });

  it('advertises only substrate discounts shared by the executable route registry and engine enforcement', () => {
    const c = {
      temperature: 120,
      fluid: { Ba: 20, S: 100, pH: 7, O2: 1, Eh: ehFromO2(1) },
      supersaturation_barite() { return 0.8; },
    };
    const sim = new VugSimulator(new VugConditions({
      temperature: 120,
      fluid: new FluidChemistry({ Ba: 20, S: 100, pH: 7, O2: 1 }),
    }), []);
    sim.crystals = [
      { mineral: 'sphalerite', crystal_id: 9, active: true, dissolved: false, enclosed_by: null },
      { mineral: 'fluorite', crystal_id: 10, active: true, dissolved: false, enclosed_by: null },
    ];
    sim.conditions = c;

    expect(engineExecutableSubstrateDiscount('sphalerite', 'barite')).toBe(0.7);
    expect(sim._sigmaDiscountForPosition('barite', 'on sphalerite #9')).toBe(0.7);
    expect(engineExecutableSubstrateDiscount('fluorite', 'calcite')).toBe(1);
    expect(sim._sigmaDiscountForPosition('calcite', 'on fluorite #10')).toBe(1);

    const why = _buildMineralFormationExplanation('barite', c, sim, 0.8);
    expect(why.substrateEligible).toBe(true); // 0.8 < 1.0 bare wall, > 0.7 assisted
    expect(why.effectiveEligible).toBe(true);
    expect(why.state).toBe('conditional');
    const substrate = group(why.groups, 'Substrate').chips;
    expect(substrate.some((ch: any) => ch.text.includes('sphalerite'))).toBe(true);
    expect(substrate.some((ch: any) => ch.text.includes('fluorite'))).toBe(false);

    // Once barite has formed, the historical verdict must use the same
    // substrate-assisted eligibility as the live chips and production route.
    sim.crystals.push({
      mineral: 'barite', crystal_id: 11, active: true, dissolved: false,
      enclosed_by: null, position: 'on sphalerite #9',
    });
    const formed = _buildMineralFormationExplanation('barite', c, sim, 0.8);
    expect(formed.chemistryEligible).toBe(false);
    expect(formed.substrateEligible).toBe(true);
    expect(formed.effectiveEligible).toBe(true);
    expect(formed.state).toBe('formed-supported');
    expect(formed.verdict).toContain('sphalerite-assisted threshold');
    expect(formed.verdict).toContain('host-dependent');
    expect(formed.verdict).not.toContain('no longer favor');
  });

  it('matches all production dissolved-host replacement routes below bare-wall threshold', () => {
    const cases = [
      { mineral: 'malachite', host: 'chalcopyrite' },
      { mineral: 'smithsonite', host: 'sphalerite' },
      { mineral: 'chrysocolla', host: 'azurite' },
    ];
    for (const row of cases) {
      const c: any = {
        temperature: 80,
        pressure: 0.2,
        fluid: {
          Ca: 500, CO3: 500, Cu: 500, Zn: 500, SiO2: 500,
          Fe: 100, S: 100, pH: 7, O2: 2, Eh: ehFromO2(2),
        },
      };
      c[`supersaturation_${row.mineral}`] = () => 0.8;
      const host = {
        mineral: row.host, crystal_id: 30, active: false, dissolved: true,
        enclosed_by: null,
      };
      const sim = { conditions: c, crystals: [host] };
      const route = engineExecutableSubstrateRoute(host, row.mineral);
      expect(route.executable, `${row.mineral} production host`).toBe(true);
      const why = _buildMineralFormationExplanation(row.mineral, c, sim, 0.8);
      expect(why.chemistryEligible, `${row.mineral} below bare wall`).toBe(false);
      expect(why.substrateEligible, `${row.mineral} replacement eligibility`).toBe(true);
      expect(why.effectiveEligible, `${row.mineral} effective eligibility`).toBe(true);
      const substrate = group(why.groups, 'Substrate').chips;
      expect(substrate.some((chip: any) => chip.text.includes(row.host)
        && chip.text.includes('dissolved replacement surface'))).toBe(true);
    }
  });

  it('reports the active Eh redox gate and marks an oxidizing broth hostile to siderite', () => {
    const c = {
      temperature: 100,
      fluid: { Fe: 50, CO3: 100, pH: 7, O2: 5, Eh: ehFromO2(5) },
      supersaturation_siderite() { return 0; },
    };
    const why = _buildMineralFormationExplanation('siderite', c, { conditions: c, crystals: [] }, 0);
    const redox = group(why.groups, 'Redox gate').chips[0];
    expect(redox.text).toContain('Eh');
    expect(redox.text).toContain('needs');
    expect(redox.met).toBe(false);
  });

  it('surfaces pressure only when it is load-bearing for the mineral engine or phase field', () => {
    const fluid = { Al: 500, SiO2: 1500, K: 100, Ca: 500, F: 20, pH: 7, O2: 0, Eh: -0.2 };
    const andalusite = {
      temperature: 600, pressure: 1.0, wall: { confining_pressure_kbar: 4.4 }, fluid,
      supersaturation_andalusite() { return 0; },
    };
    const why = _buildMineralFormationExplanation('andalusite', andalusite, { conditions: andalusite, crystals: [] }, 0);
    const pressure = group(why.groups, 'Pressure / phase field').chips[0];
    expect(pressure.text).toContain('uncertain Al2SiO5 field');
    expect(pressure.met).toBe(true); // uncertainty is disclosed, not fabricated as a hard block
    expect(pressure.status).toBe('uncertain');

    const quartz = {
      temperature: 600, pressure: 4.4, fluid,
      supersaturation_quartz() { return 0; },
    };
    const quartzWhy = _buildMineralFormationExplanation('quartz', quartz, { conditions: quartz, crystals: [] }, 0);
    expect(group(quartzWhy.groups, 'Pressure / phase field')).toBeUndefined();
  });

  it('labels shallow hot quartz as outside the pressure grid without showing a frozen density', () => {
    const c = {
      temperature: 350, pressure: 0.05,
      fluid: { SiO2: 1200, pH: 7, O2: 1, Eh: ehFromO2(1) },
      supersaturation_quartz() { return 1.2; },
    };
    const why = _buildMineralFormationExplanation('quartz', c, { conditions: c, crystals: [] }, 1.2);
    const pressure = group(why.groups, 'Pressure / phase field').chips[0];
    expect(pressure.status).toBe('uncertain');
    expect(pressure.met).toBe(true);
    expect(pressure.text).toContain('Manning correction inactive below 0.50 kbar');
    expect(pressure.text).not.toContain('rhoH2O');
    expect(pressure.note).toContain('reference-only');
  });

  it('renders the calcite/aragonite experimental boundary band as neutral uncertainty', () => {
    const c = {
      temperature: 25, pressure: 3.5,
      fluid: { Ca: 100, CO3: 100, Mg: 20, pH: 7, O2: 1, Eh: ehFromO2(1) },
      supersaturation_aragonite() { return 2; },
      supersaturation_calcite() { return 2; },
    };
    for (const name of ['calcite', 'aragonite']) {
      const why = _buildMineralFormationExplanation(name, c, { conditions: c, crystals: [] }, 2);
      const pressure = group(why.groups, 'Pressure / phase field').chips[0];
      expect(pressure.status).toBe('uncertain');
      expect(pressure.text).toContain('calcite/aragonite boundary');
      expect(_nucleationHoverHTML(name, c, { conditions: c, crystals: [] }, 2)).toContain('nuc-chip uncertain');
    }
  });

  it('renders deep-field calcite stability as an observer, never a failed gameplay gate', () => {
    const c = {
      temperature: 200, pressure: 4.4,
      fluid: { Ca: 100, CO3: 100, Mg: 20, pH: 7, O2: 1, Eh: ehFromO2(1) },
      supersaturation_calcite() { return 2; },
    };
    const why = _buildMineralFormationExplanation('calcite', c, { conditions: c, crystals: [] }, 2);
    const pressure = group(why.groups, 'Pressure / phase field').chips[0];
    expect(pressure.status).toBe('observer');
    expect(pressure.met).toBe(true);
    const text = new DOMParser().parseFromString(
      _nucleationHoverHTML('calcite', c, { conditions: c, crystals: [] }, 2),
      'text/html',
    ).body.textContent || '';
    expect(text).toContain('Observer only:');
    expect(text).toContain('not a failed gameplay gate');
  });

  it('renders occurrence and water-activity observations as neutral uncertainty, not binary truth', () => {
    const apConditions = {
      temperature: 120, pressure: 3.5,
      fluid: { Ca: 100, K: 100, F: 20, SiO2: 500, pH: 7, O2: 0.2, Eh: -50 },
      supersaturation_apophyllite() { return 0.8; },
    };
    const apWhy = _buildMineralFormationExplanation('apophyllite', apConditions, { conditions: apConditions, crystals: [] }, 0.8);
    expect(group(apWhy.groups, 'Pressure / phase field').chips[0].status).toBe('uncertain');
    const apText = new DOMParser().parseFromString(
      _nucleationHoverHTML('apophyllite', apConditions, { conditions: apConditions, crystals: [] }, 0.8),
      'text/html',
    ).body.textContent || '';
    expect(apText).toContain('Uncertain:');
    expect(apText).toContain('occurrence');

    const gyConditions = {
      temperature: 90, pressure: 0.2,
      fluid: { Ca: 200, S: 200, Na: 300, Cl: 400, salinity: 120, pH: 7, O2: 1, Eh: 100 },
      supersaturation_selenite() { return 2; },
    };
    const gyWhy = _buildMineralFormationExplanation('selenite', gyConditions, { conditions: gyConditions, crystals: [] }, 2);
    expect(group(gyWhy.groups, 'Pressure / phase field').chips[0].status).toBe('observer');
    const aw = group(gyWhy.groups, 'Water activity').chips[0];
    expect(aw.status).toBe('uncertain');
    expect(aw.note).toContain('phase selector consumes the same a_w');
    const gyHTML = _nucleationHoverHTML('selenite', gyConditions, { conditions: gyConditions, crystals: [] }, 2);
    expect(gyHTML).toContain('nuc-chip observer');
    const gyText = new DOMParser().parseFromString(gyHTML, 'text/html').body.textContent || '';
    expect(gyText).toContain('Observer only:');
    expect(gyText).toContain('phase selector consumes the same a_w');
  });

  it('uses the real quartz nucleator for repeat thresholds, active caps, and stochastic birth probability', () => {
    const conditions = new VugConditions({
      temperature: 250,
      fluid: new FluidChemistry({ SiO2: 1000, pH: 7, O2: 0.1 }),
    });
    conditions.supersaturation_quartz = () => 1.5;
    const sim = new VugSimulator(conditions, []);
    sim.crystals = [new Crystal({ mineral: 'quartz', crystal_id: 1 })];

    const repeatBlocked = assessProductionNucleationDecision('quartz', sim, 1.5, 1.2);
    expect(repeatBlocked.available).toBe(true);
    expect(repeatBlocked.eligible).toBe(false);
    expect(repeatBlocked.blockers.join(' ')).toContain('active-crystal rule');
    expect(repeatBlocked.blockers.join(' ')).toContain('σ > 2.000');

    conditions.supersaturation_quartz = () => 2.1;
    const stochastic = assessProductionNucleationDecision('quartz', sim, 2.1, 1.2);
    expect(stochastic.eligible).toBe(true);
    expect(stochastic.stochasticBirth).toBe(true);
    expect(stochastic.effectiveDrawProbability).toBeCloseTo(0.3, 3);

    conditions.supersaturation_quartz = () => 5;
    sim.crystals = Array.from({ length: 3 }, (_, i) =>
      new Crystal({ mineral: 'quartz', crystal_id: i + 1 }));
    const activeCap = assessProductionNucleationDecision('quartz', sim, 5, 1.2);
    expect(activeCap.eligible).toBe(false);
    expect(activeCap.blockers.join(' ')).toContain('3 active');
  });

  it('keeps local hover chemistry subordinate to the water-mode calcite serial gate', () => {
    const conditions = new VugConditions({
      temperature: 25,
      fluid: new FluidChemistry({ Ca: 5000, CO3: 5000, pH: 8, O2: 1 }),
    });
    const sim = new VugSimulator(conditions, []);
    sim.crystals = [new Crystal({ mineral: 'calcite', crystal_id: 1 })];
    const mesh = sim.wall_state.meshFor(sim);
    for (const cell of mesh.cells) Object.assign(cell.fluid, { Ca: 5000, CO3: 5000, pH: 8 });
    const why = _buildMineralFormationExplanation('calcite', conditions, sim);
    const production = group(why.groups, 'Production nucleator');
    expect(production).toBeTruthy();
    expect(production.chips[0].text).toContain('blocks a fresh nucleus');
    expect(production.chips.some((chip: any) => chip.text.includes('active-crystal rule'))).toBe(true);
    expect(why.state).toBe('formed-past');
    expect(why.verdict).toContain('Production now blocks a fresh nucleus');
  });

  it('surfaces an engine-specific hydrozincite SiO2 blocker by causal production rerun', () => {
    const conditions = new VugConditions({
      temperature: 20,
      fluid: new FluidChemistry({
        Zn: 1000, CO3: 1000, SiO2: 100, Cu: 0, S: 0,
        pH: 8, O2: 2, salinity: 1,
      }),
    });
    expect(conditions.supersaturation_hydrozincite()).toBe(0);
    const sim = new VugSimulator(conditions, []);
    const why = _buildMineralFormationExplanation('hydrozincite', conditions, sim, 0);
    const causal = group(why.groups, 'Production counterfactuals').chips;
    const silica = causal.find((chip: any) => chip.text.startsWith('SiO2 '));
    expect(silica, causal.map((chip: any) => chip.text).join('\n')).toBeTruthy();
    expect(silica.text).toContain('clears σcrit');
    expect(silica.note).toContain('production supersaturation');
  });

  it('uses raw CO3 for the three empirical carbonate routes and keeps formula capacity separate', () => {
    const conditions = new VugConditions({
      temperature: 100,
      fluid: new FluidChemistry({ Sr: 500, CO3: 200, pH: 3, O2: 1, salinity: 1 }),
    });
    expect(_formationAvailableAmount('strontianite', 'CO3', conditions)).toBe(200);
    expect(_formationAvailableAmount('witherite', 'CO3', conditions)).toBe(200);
    expect(_formationAvailableAmount('hydrozincite', 'CO3', conditions)).toBe(200);
    expect(_formationAvailableAmount('calcite', 'CO3', conditions)).toBeLessThan(200);

    const sim = new VugSimulator(conditions, []);
    const why = _buildMineralFormationExplanation(
      'strontianite', conditions, sim, conditions.supersaturation_strontianite(),
    );
    const floor = group(why.groups, 'Nucleation floors').chips
      .find((chip: any) => chip.text.startsWith('CO3 '));
    expect(floor.text).toContain('200');
    expect(floor.met).toBe(true);
    expect(group(why.groups, 'Calibrated growth budget').chips[0].text).toContain('books');
  });

  it('preserves full sigma precision between pill classification and dialog diagnosis', () => {
    const source = fs.readFileSync(path.join(ROOT, 'js', '97b-ui-sigma-panel.ts'), 'utf8');
    expect(source).toContain('data-sigma="${_satEsc(String(e.sigma))}"');
    expect(source).not.toContain('data-sigma="${e.sigma.toFixed(4)}"');
    const c = {
      temperature: 25,
      fluid: { Ca: 100, CO3: 100, pH: 7, O2: 1, Eh: ehFromO2(1) },
      supersaturation_calcite() { return 1.50004; },
    };
    const serialized = String(c.supersaturation_calcite());
    expect(serialized).toBe('1.50004');
    const why = _buildMineralFormationExplanation('calcite', c, null, Number(serialized));
    expect(why.chemistryEligible).toBe(true);
  });

  it('keeps the σ ≤ σcrit contract in every nucleation source guard', () => {
    const jsDir = path.join(ROOT, 'js');
    const files = fs.readdirSync(jsDir).filter(name => /-nucleation-.*\.ts$/.test(name));
    const violations: string[] = [];
    for (const file of files) {
      const source = fs.readFileSync(path.join(jsDir, file), 'utf8');
      const lines = source.split(/\r?\n/);
      lines.forEach((line, index) => {
        if (/\bsigma\w*\s*<\s*MINERAL_GATES_\w+\.sigma_crit/.test(line)) {
          violations.push(`${file}:${index + 1}: ${line.trim()}`);
        }
      });
    }
    expect(violations, violations.join('\n')).toEqual([]);
  });

  it('renders focusable mineral buttons and classifies against each mineral\'s sigma_crit', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const pop = document.createElement('div');
    pop.id = 'sat-hover-pop';
    pop.style.display = 'none';
    document.body.appendChild(pop);
    const c = {
      temperature: 25,
      fluid: { Ca: 100, CO3: 100, pH: 7, O2: 1, Eh: ehFromO2(1) },
      supersaturation_calcite() { return 1.2; },
    };
    _renderFortressSigmaGroups(c, host);
    const pill = host.querySelector('[data-hl-mineral="calcite"]') as HTMLButtonElement;
    expect(pill).toBeTruthy();
    expect(pill.tagName).toBe('BUTTON');
    expect(pill.type).toBe('button');
    expect(pill.classList.contains('sat-under')).toBe(true); // 1.2 < calcite sigma_crit 1.5
    expect(pill.getAttribute('aria-label')).toContain('nucleation threshold 1.50');
    pill.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    expect(pop.style.display).toBe('block');
    expect(pill.getAttribute('aria-describedby')).toBe('sat-hover-pop');
    expect(pop.getAttribute('role')).toBe('tooltip');
    const activate = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Enter' });
    pill.dispatchEvent(activate);
    expect(activate.defaultPrevented).toBe(true);
    expect(pop.getAttribute('role')).toBe('dialog');
    expect(pop.hasAttribute('aria-modal')).toBe(false);
    expect(pop.classList.contains('is-pinned')).toBe(true);
    const close = pop.querySelector('[data-nuc-pop-close]') as HTMLButtonElement;
    expect(close).toBeTruthy();
    expect(document.activeElement).toBe(close);
    close.click();
    expect(pop.style.display).toBe('none');
    expect(pop.hasAttribute('aria-modal')).toBe(false);
    expect(document.activeElement).toBe(pill);
    pill.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    pill.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' }));
    expect(pop.style.display).toBe('none');
    pop.remove();
    host.remove();
  });
});
