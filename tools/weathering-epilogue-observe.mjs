#!/usr/bin/env node
/**
 * Seed-42 executed-history judge for the Wittichen supergene tail and Naica
 * dewatering/preservation interval. Node-only; no external solver/runtime.
 */
import { loadSimBundle } from './_harness.mjs';

const { SCENARIOS, VugSimulator, setSeed } = await loadSimBundle({
  toolName: 'weathering-epilogue-observe',
});

const args = process.argv.slice(2);
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
const requestedSteps = args.includes('--steps') ? Number(args[args.indexOf('--steps') + 1]) : null;

function run(name, seed = 42) {
  setSeed(seed);
  const { conditions, events, defaultSteps } = SCENARIOS[name]();
  const sim = new VugSimulator(conditions, events);
  const count = Number.isFinite(requestedSteps) ? requestedSteps : defaultSteps;
  for (let step = 0; step < count; step++) sim.run_step();
  return sim;
}

function alive(sim, mineral) {
  return sim.crystals.filter(c => c.mineral === mineral
    && !c.dissolved && c.total_growth_um > 0);
}

function summary(sim) {
  const state = sim._weatheringEpilogueState;
  const boundary = sim._vadoseExposureTransactions || [];
  const dissolution = (state?.timeline || []).flatMap(row => row.dissolution || []);
  const replacement = (state?.timeline || []).flatMap(row => row.replacement || []);
  const releases = {};
  for (const row of dissolution) for (const [species, amount] of Object.entries(row.returnedInventory || {})) {
    releases[species] = (releases[species] || 0) + Number(amount || 0);
  }
  const parents = sim.crystals
    .filter(c => ['skutterudite', 'safflorite', 'cobaltite'].includes(c.mineral))
    .map(c => {
      const anchor = sim.wall_state._resolveAnchor(c);
      const arag = sim._localNucleationEvaluationAtAnchor('aragonite', anchor);
      const ery = sim._localNucleationEvaluationAtAnchor('erythrite', anchor);
      return {
        id: c.crystal_id,
        mineral: c.mineral,
        anchor,
        local: arag?.fluid ? {
          temperatureC: arag.temperatureC,
          Co: arag.fluid.Co, As: arag.fluid.As, Ca: arag.fluid.Ca,
          CO3: arag.fluid.CO3, pH: arag.fluid.pH, O2: arag.fluid.O2,
          aragoniteSigma: arag.sigma, erythriteSigma: ery?.sigma,
        } : null,
      };
    });
  return {
    scenario: sim.conditions._scenario.id,
    step: sim.step,
    state: state ? {
      valid: state.valid,
      kind: state.kind,
      startStep: state.startStep,
      rows: state.timeline.length,
      activation: state.activation,
    } : null,
    boundary: boundary.map(tx => ({
      step: tx.step,
      becameVadose: tx.becameVadose,
      rewetted: tx.rewetted,
      concentrationFactor: tx.concentrationFactor,
      oxygenImportedCanonicalPpmEquivalent: (tx.rings || []).reduce(
        (sum, row) => sum + row.oxygenImportedCanonicalPpmEquivalent, 0,
      ),
      compatibilityMirrorPpm: (tx.rings || []).reduce(
        (sum, row) => sum + row.oxygenImportedCompatibilityMirrorPpm, 0,
      ),
      sulfurClosed: tx.closed,
    })),
    dissolution: {
      zones: dissolution.length,
      minerals: Object.fromEntries([...new Set(dissolution.map(row => row.mineral))]
        .sort().map(name => [name, dissolution.filter(row => row.mineral === name).length])),
      releasedInventory: releases,
    },
    replacement: {
      zones: replacement.length,
      minerals: Object.fromEntries([...new Set(replacement.map(row => row.mineral))]
        .sort().map(name => [name, replacement.filter(row => row.mineral === name).length])),
    },
    carbonLedger: sim._carbonLedgerHistory?.at(-1) || null,
    parents,
    alive: Object.fromEntries(
      ['skutterudite', 'safflorite', 'erythrite', 'aragonite', 'selenite', 'thenardite']
        .map(name => [name, alive(sim, name).length]),
    ),
    products: sim.crystals
      .filter(c => ['erythrite', 'aragonite'].includes(c.mineral))
      .map(c => ({
        id: c.crystal_id,
        mineral: c.mineral,
        alive: !c.dissolved && c.total_growth_um > 0,
        step: c.nucleation_step,
        position: c.position,
        precursor: c.weathering_precursor_receipt || null,
        coBookedPpm: (c.zones || []).reduce(
          (sum, z) => sum + Math.max(0, Number(z._budget_inventory_per_um?.Co) || 0)
            * Math.max(0, Number(z._remaining_solid_um) || 0), 0,
        ),
      })),
  };
}

for (const name of (only ? [only] : ['wittichen', 'naica_geothermal'])) {
  console.log(JSON.stringify(summary(run(name)), null, 2));
}
