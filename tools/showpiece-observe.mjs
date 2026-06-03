#!/usr/bin/env node
/**
 * tools/showpiece-observe.mjs — Phase 2c.3 verification (commits nothing).
 *
 * 2c.3 unites the feeder's chemical HALO (2c.1 origin:'cell' injection) with crystal
 * CLUSTERING (2c.2b) into one point-source showpiece. This tool dark-observes a
 * candidate origin:'cell' nutrient injection on a clustering-opted-in scenario and
 * reports the three things that must hold before baking:
 *   1. HALO — the injected field is higher near the feeder than far (decays with
 *      mesh graph-distance). 2c.1 mechanism, strip-visible.
 *   2. ONE-SIDED GROWTH — crystals near the feeder grow BIGGER than far ones, because
 *      _runEngineForCrystal reads the per-cell fluid (mesh.cellOf), so the injected
 *      nutrient feeds growth where it's delivered. This is the real one-sided effect
 *      (not just a strip halo): the feeder's nutrient grows its mineral locally.
 *   3. SAFE — no expects_species lost vs the no-injection baseline.
 *
 * Compares BASE (scenario as-is, clustering on) vs INJECT (+ an origin:'cell' movement).
 *
 * Usage:
 *   node tools/showpiece-observe.mjs [scenario] [field] [amp] [startStep]
 *   defaults: gem_pegmatite F +6000 150   (a late F pulse at the feeder — the topaz window)
 */
import { loadSimBundle } from './_harness.mjs';

const { SCENARIOS, VugSimulator, setSeed } = await loadSimBundle({ toolName: 'showpiece-observe' });

const [, , argScen, argField, argAmp, argStart] = process.argv;
const SCEN = argScen || 'gem_pegmatite';
const FIELD = argField || 'F';
const LEAF = FIELD.includes('.') ? FIELD.split('.').pop() : FIELD;
const FIELD_PATH = FIELD.includes('.') ? FIELD : (FIELD === 'temperature' ? 'temperature' : `fluid.${FIELD}`);
const AMP = argAmp !== undefined ? Number(argAmp) : 6000;

if (!SCENARIOS[SCEN]) { console.error('no scenario', SCEN); process.exit(1); }
const STEPS = SCENARIOS[SCEN]().defaultSteps ?? 120;
const START = argStart !== undefined ? Number(argStart) : Math.floor(STEPS * 0.65);
const spec = SCENARIOS[SCEN]._json5_spec || {};
const EXPECTS = Array.isArray(spec.expects_species) ? spec.expects_species : [];

function meshDist(a, b, N) {
  const ra = (a / N) | 0, ca = a % N, rb = (b / N) | 0, cb = b % N;
  const dc = Math.abs(ca - cb);
  return Math.abs(ra - rb) + Math.min(dc, N - dc);
}

function run(inject, refCell) {
  setSeed(42);
  const { conditions, events } = SCENARIOS[SCEN]();
  const sim = new VugSimulator(conditions, events);
  const N = sim.wall_state.cells_per_ring | 0;
  if (inject) {
    const base = (sim.conditions.fluid[LEAF] ?? 0);
    sim.conditions._scenario = sim.conditions._scenario || {};
    sim.conditions._scenario.movements = [{
      field: FIELD_PATH, startStep: START, endStep: STEPS, base,
      ops: [{ kind: 'trend', amp: AMP, ease: true }], texture: { theta: 0.3, sigma: 0 },
      origin: 'cell',
    }];
  }
  for (let s = 0; s < STEPS; s++) sim.run_step();

  const mesh = sim.wall_state.meshFor(sim);
  const originCell = (sim._movements && sim._movements._state && sim._movements._state[0])
    ? sim._movements._state[0].originCell : -1;
  // measure around a SHARED reference cell (the inject origin) so BASE vs INJECT
  // near/far growth is apples-to-apples on the same feeder.
  const feederCell = (typeof refCell === 'number' && refCell >= 0) ? refCell
    : (originCell >= 0 ? originCell
      : (sim._fluidSpots.openSpots().filter(s => s.supply > 1)[0] || {}).cell ?? -1);

  // per-cell injected-field halo, binned by distance from the feeder
  const haloBins = {};
  if (feederCell >= 0) {
    for (let i = 0; i < mesh.cells.length; i++) {
      const f = mesh.cells[i] && mesh.cells[i].fluid;
      if (!f || typeof f[LEAF] !== 'number') continue;
      const d = meshDist(i, feederCell, N);
      (haloBins[d] ??= []).push(f[LEAF]);
    }
  }
  const haloAt = (d) => haloBins[d] ? (haloBins[d].reduce((s, x) => s + x, 0) / haloBins[d].length) : NaN;

  // crystals: near-feeder vs far, mean growth; + per-species counts
  let nearSum = 0, nearN = 0, farSum = 0, farN = 0;
  const counts = {};
  for (const c of sim.crystals) {
    const a = sim.wall_state._resolveAnchor(c);
    counts[c.mineral] = counts[c.mineral] || { n: 0, max: 0 };
    counts[c.mineral].n++;
    counts[c.mineral].max = Math.max(counts[c.mineral].max, Math.round(c.total_growth_um));
    if (!a || feederCell < 0) continue;
    const d = meshDist(a.ringIdx * N + a.cellIdx, feederCell, N);
    if (d <= 3) { nearSum += c.total_growth_um; nearN++; }
    else if (d >= 8) { farSum += c.total_growth_um; farN++; }
  }
  return {
    N, feederCell, originCell,
    halo: { d0: haloAt(0), d1: haloAt(1), d3: haloAt(3), d8: haloAt(8), dFar: haloAt(20) },
    nearMean: nearN ? nearSum / nearN : 0, nearN, farMean: farN ? farSum / farN : 0, farN,
    counts, species: new Set(Object.keys(counts)),
  };
}

const INJ = run(true);                 // resolve the origin cell first
const BASE = run(false, INJ.originCell); // then measure BASE around the SAME cell

console.log(`\n### 2c.3 SHOWPIECE OBSERVATION — ${SCEN}, origin:'cell' injecting ${FIELD_PATH} (+${AMP} trend from step ${START}/${STEPS})`);
console.log(`    feeder cell: BASE ${BASE.feederCell} | INJECT resolved origin ${INJ.originCell}`);

console.log(`\n  HALO — per-cell ${LEAF} vs graph-distance from feeder (INJECT):`);
const h = INJ.halo;
console.log(`    d0 ${(+h.d0).toFixed(1)} → d1 ${(+h.d1).toFixed(1)} → d3 ${(+h.d3).toFixed(1)} → d8 ${(+h.d8).toFixed(1)} → far ${(+h.dFar).toFixed(1)}`);
console.log(`    ${h.d0 > h.dFar + 1 ? '✓ HALO PRESENT (near > far)' : '✗ no halo'}  (BASE far ${(+BASE.halo.dFar).toFixed(1)})`);

console.log(`\n  ONE-SIDED GROWTH — mean crystal growth_um near feeder (d≤3) vs far (d≥8):`);
const fmtG = (r) => `near ${Math.round(r.nearMean)}µm (n${r.nearN}) vs far ${Math.round(r.farMean)}µm (n${r.farN})`;
console.log(`    BASE:   ${fmtG(BASE)}`);
console.log(`    INJECT: ${fmtG(INJ)}   ${INJ.nearMean > INJ.farMean ? '✓ bigger near feeder' : '~ flat'}`);

console.log(`\n  ASSEMBLAGE SAFETY (expects_species: ${EXPECTS.join(', ')}):`);
const lost = EXPECTS.filter(m => BASE.counts[m] && !INJ.counts[m]);
const gainedSp = [...INJ.species].filter(m => !BASE.species.has(m)).sort();
const lostSp = [...BASE.species].filter(m => !INJ.species.has(m)).sort();
console.log(`    expects lost: ${lost.length ? '⚠ ' + lost.join(', ') : 'NONE ✓'}`);
console.log(`    full assemblage Δ: +[${gainedSp.join(',') || '—'}]  -[${lostSp.join(',') || '—'}]`);
console.log(`\n  per-expects-species n×maxµm (BASE → INJECT):`);
for (const m of EXPECTS) {
  const b = BASE.counts[m], i = INJ.counts[m];
  console.log(`    ${m.padEnd(14)} ${(b ? `${b.n}×${b.max}` : '—').padEnd(12)} → ${i ? `${i.n}×${i.max}` : '—'}`);
}
