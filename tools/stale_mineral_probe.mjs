#!/usr/bin/env node
/**
 * tools/stale_mineral_probe.mjs — diagnose stale minerals.
 *
 * For each (mineral, scenario) pair the coverage check tool flags as
 * stale (scenario expects, engine never agrees), run the scenario and
 * sample at every step:
 *
 *   * supersaturation_<mineral>() at the equator-ring fluid view
 *   * every value of every key the mineral's required_ingredients
 *     declares — so we can see WHICH gate is failing
 *   * any aux quantities the engine's σ formula reads (O2, pH,
 *     concentration, the inferred `cu_zn_total` / `zn_fraction` etc.)
 *   * the ring-water-state at the equator (submerged / meniscus /
 *     vadose) — supergene fluids need oxidizing meniscus
 *
 * Report per scenario:
 *
 *   * "ever σ > 1": yes/no across all steps. If yes, the engine
 *     SHOULD have nucleated — root cause is the cap check, the
 *     RNG roll, or the engine has a non-σ-only gate.
 *   * "ingredient floor hits": each step where σ=0 because of a
 *     specific ingredient threshold — distribution across causes
 *     tells you which gate is the long pole.
 *   * "max σ ever": the peak. If max σ is e.g. 0.8 with the gate at
 *     1.0, the engine's almost firing — small chemistry bump
 *     would clear it.
 *
 * Reads authored data from data/minerals.json directly (avoiding the
 * async MINERAL_SPEC fallback issue documented in
 * tools/twin_rate_check.mjs).
 *
 * Usage: `node tools/stale_mineral_probe.mjs`
 *
 * Edits to PROBES (below) targeted at the post-Backlog-K stale list:
 *   * adamite          (supergene_oxidation)
 *   * chrysoprase      (ultramafic_supergene)
 *   * native_tellurium (epithermal_telluride)
 *   * ruby             (marble_contact_metamorphism)
 *
 * Companion to tools/twin_rate_check.mjs + tools/mineral_coverage_check.mjs.
 * Same harness pattern (jsdom + bundle eval + fetch mock + DOM stub).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSimBundle } from './_harness.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const { SIM_VERSION, SCENARIOS, VugSimulator, setSeed } =
  await loadSimBundle({ toolName: 'stale_mineral_probe' });

const MINERALS_JSON = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'minerals.json'), 'utf8')).minerals;

// --- Probes — (mineral, scenario, key chemistry to track) ---
//
// `extras` are computed-but-not-required signals — pH, O2 fugacity,
// ring water state — useful for debugging non-σ gates. Add to taste.

const PROBES = [
  // Round 1 (Backlog K era — Apr 2026): adamite, chrysoprase, native_tellurium,
  // ruby. All four landed. Tracked here for reference; commented to keep
  // the cascade-gate-audit signal clean.
  //   { mineral: 'adamite', scenario: 'supergene_oxidation', ... }
  //   { mineral: 'chrysoprase', scenario: 'ultramafic_supergene', ... }
  //   { mineral: 'native_tellurium', scenario: 'epithermal_telluride', ... }
  //   { mineral: 'ruby', scenario: 'marble_contact_metamorphism', ... }
  //
  // Round 2 (Path C cascade-gate audit — May 2026): all six dead minerals
  // with hard upper-S / upper-Fe gates. Native_tellurium's Ag-hard-gate
  // fix established the soft-suppressor pattern. These engines all carry
  // the same structural defect: a hard `if (fluid.X > Y) return 0` on
  // a species that depletes locally (via sulfides, arsenides, etc.) but
  // the σ engine reads the bulk-view fluid at the equator ring.
  // Round 2 (Path C cascade-gate audit — May 2026) + Round 3 (roughten_gill
  // tune pass — 2026-06-10) entries are RESOLVED and removed for signal
  // cleanliness (native-element S-gates shipped; roughten_gill V-suite + ZnS
  // shipped v193/v199). See git history of this file for the prior PROBES.
  //
  // Round 4 (PROPOSALS-LEDGER §A #10 — "stale expects_species, 3 to diagnose",
  // 2026-06-18): the three remaining stale (mineral, scenario) pairs flagged
  // by the ledger as needing per-target confirmation.
  {
    mineral: 'azurite',
    scenario: 'bisbee',  // ledger note: "gate not cleared despite event firing"
    extras: ['Cu', 'CO3', 'S', 'O2', 'pH', 'temperature'],
  },
  {
    mineral: 'mirabilite',
    scenario: 'searles_lake',  // Na2SO4·10H2O evaporite — low-T sodium sulfate
    extras: ['Na', 'S', 'concentration', 'O2', 'pH', 'temperature'],
  },
  {
    mineral: 'torbernite',
    scenario: 'schneeberg',  // Cu(UO2)2(PO4)2 uranyl phosphate; ledger: 0/10
    extras: ['Cu', 'U', 'P', 'O2', 'pH', 'temperature'],
  },
];

function probe({ mineral, scenario, extras }, { seeds = [42, 1, 7] } = {}) {
  const scenFn = SCENARIOS[scenario];
  if (!scenFn) return { error: `no scenario named ${scenario}` };

  // Aggregate across seeds. Per-step ALL-seed averaging is overkill;
  // the simpler signal is: best (max) σ ever seen across all (seed, step)
  // pairs + the step it occurred + the fluid snapshot at that step.
  let bestSigma = 0;
  let bestSnapshot = null;
  let everAboveOne = 0;  // count of (seed, step) pairs where σ > 1
  let everNucleated = false;
  const totalPairs = [];
  // Track min observed value of each extras key — for cascade-gated minerals
  // (native_tellurium needs Ag≤5 AND Au≤1 AND O2≤0.5), the min tells you if
  // the cascade ever resolves the gate. If min Ag never drops below 5 over
  // 180 steps × 3 seeds, hessite isn't consuming enough Ag in the scenario's
  // budget.
  const extraMins = {};
  for (const k of extras) extraMins[k] = Infinity;

  for (const seed of seeds) {
    setSeed(seed);
    const { conditions, events, defaultSteps } = scenFn();
    const sim = new VugSimulator(conditions, events);
    const steps = defaultSteps ?? 100;

    const sigmaFn = sim.conditions[`supersaturation_${mineral}`];
    if (typeof sigmaFn !== 'function') {
      return { error: `no supersaturation function for ${mineral}` };
    }

    for (let i = 0; i < steps; i++) {
      sim.run_step();
      // Sample at the equator-ring fluid view (which is what bulk-fluid
      // engines see). conditions.fluid points at ring_fluids[equator]
      // post-Tranche-4a aliasing.
      let sigma = 0;
      try {
        sigma = sigmaFn.call(sim.conditions);
      } catch (_e) {
        sigma = -1;  // engine threw — gate failed catastrophically
      }
      if (Number.isFinite(sigma) && sigma > bestSigma) {
        bestSigma = sigma;
        const snap = { step: i, sigma, T: sim.conditions.temperature };
        for (const k of extras) {
          if (k === 'temperature') snap.T = sim.conditions.temperature;
          else snap[k] = sim.conditions.fluid?.[k];
        }
        bestSnapshot = snap;
      }
      if (sigma > 1) everAboveOne++;
      totalPairs.push(sigma);
      // Track mins for each extra so cascade-gate diagnostics surface.
      for (const k of extras) {
        let v;
        if (k === 'temperature') v = sim.conditions.temperature;
        else v = sim.conditions.fluid?.[k];
        if (typeof v === 'number' && Number.isFinite(v) && v < extraMins[k]) {
          extraMins[k] = v;
        }
      }
    }
    const nucleated = sim.crystals.some(c => c.mineral === mineral);
    if (nucleated) everNucleated = true;
  }

  return {
    mineral, scenario,
    seeds,
    steps_per_seed: SCENARIOS[scenario]()?.defaultSteps ?? 100,
    total_step_count: totalPairs.length,
    ever_nucleated: everNucleated,
    ever_sigma_gt_1: everAboveOne,
    best_sigma: bestSigma,
    best_snapshot: bestSnapshot,
    extra_mins: extraMins,
    required: MINERALS_JSON[mineral]?.required_ingredients ?? null,
  };
}

console.log(`[stale_mineral_probe] SIM_VERSION ${SIM_VERSION}`);
console.log(`Sampling ${PROBES.length} stale (mineral, scenario) pairs at 3 seeds × default-steps.\n`);

for (const p of PROBES) {
  const r = probe(p);
  console.log('='.repeat(78));
  console.log(`MINERAL: ${r.mineral}    SCENARIO: ${r.scenario}`);
  if (r.error) {
    console.log(`  ERROR: ${r.error}`);
    continue;
  }
  console.log(`  required:           ${r.required ? JSON.stringify(r.required) : '(none authored)'}`);
  console.log(`  steps sampled:      ${r.total_step_count} (${r.seeds.length} seeds × ${r.steps_per_seed} steps)`);
  console.log(`  ever nucleated:     ${r.ever_nucleated ? 'YES' : 'no'}`);
  console.log(`  σ > 1 occurrences:  ${r.ever_sigma_gt_1} / ${r.total_step_count}`);
  console.log(`  best σ seen:        ${r.best_sigma.toFixed(4)}`);
  if (r.best_snapshot) {
    const s = r.best_snapshot;
    console.log(`  best σ at step ${s.step}, T=${(s.T ?? 0).toFixed(1)}°C:`);
    for (const k of Object.keys(s)) {
      if (k === 'step' || k === 'sigma' || k === 'T') continue;
      const v = s[k];
      if (v == null) { console.log(`    ${k.padEnd(16)} = (undefined)`); continue; }
      if (typeof v === 'number') console.log(`    ${k.padEnd(16)} = ${v.toFixed(3)}`);
      else console.log(`    ${k.padEnd(16)} = ${v}`);
    }
  }
  // Min observed across the whole sweep — surfaces cascade-gate state.
  // Especially for native_tellurium (Au<1 AND Ag<5 AND O2<0.5) where the
  // best-σ snapshot is empty because σ stayed at 0.
  if (r.extra_mins) {
    const interesting = Object.entries(r.extra_mins).filter(
      ([_, v]) => v !== Infinity && v !== r.best_snapshot?.[_]
    );
    if (interesting.length) {
      console.log(`  min ever (across all steps × seeds):`);
      for (const [k, v] of interesting) {
        console.log(`    ${k.padEnd(16)} = ${typeof v === 'number' ? v.toFixed(3) : v}`);
      }
    }
  }
  console.log('');
}

console.log('Diagnosis tips:');
console.log('  best σ < 1     → engine never close to firing; chemistry / temperature / pH / redox gate fails');
console.log('  best σ in 0.5-0.99 → just below threshold; small broth bump or scenario tweak likely clears it');
console.log('  σ > 1 occurrences > 0 but ever_nucleated=no → cap, RNG roll, or non-σ gate (look at engine code)');
console.log('  best σ >> 1 and nucleated=no → almost certainly a non-σ engine gate (vugFill cap pre-K, ring-water-state, …)');
