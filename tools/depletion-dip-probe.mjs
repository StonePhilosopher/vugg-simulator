#!/usr/bin/env node
/**
 * tools/depletion-dip-probe.mjs — verify the boss's ear (2026-06-03):
 *   "I don't think I'm seeing dips in the levels in the broth around crystals."
 *
 * Crystal growth DOES debit the per-cell fluid: _runEngineForCrystal points
 * conditions.fluid at cell.fluid (by ref) and applyMassBalance subtracts
 * MASS_BALANCE_SCALE × thickness_um × stoich. So a depletion HALO should
 * exist around each crystal — UNLESS it's (a) too small (scale 0.02), and/or
 * (b) smeared flat by the per-step 3D voxel diffusion.
 *
 * This probe runs a scenario headless, then for every crystal compares its
 * cell's primary-consumed-ion concentration to the BULK mean of that ion,
 * and reports the mean dip%. It also reports each key ion's spatial
 * coefficient of variation (CV = std/mean) across all cells — a flat field
 * (CV≈0) means diffusion won; a structured field (CV>0) means dips survive.
 * Commits nothing.
 *
 * Usage:  node tools/depletion-dip-probe.mjs [scenario ...]
 *   default: a spread of precipitation-heavy scenarios.
 */
import { loadSimBundle } from './_harness.mjs';

const { SCENARIOS, VugSimulator, setSeed, MINERAL_STOICHIOMETRY, MASS_BALANCE_SCALE } =
  await loadSimBundle({
    toolName: 'depletion-dip-probe',
    extraExports: ['MINERAL_STOICHIOMETRY', 'MASS_BALANCE_SCALE'],
  });

const SCENS = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ['mvt', 'sunnyside', 'gem_pegmatite', 'reactive_wall'];

// primary consumed ion for a mineral = species with the largest POSITIVE
// stoichiometric coefficient (negative = produced/consumed-as-reactant sinks).
function primaryIon(mineral) {
  const st = MINERAL_STOICHIOMETRY[mineral];
  if (!st) return null;
  let best = null, bestV = 0;
  for (const sp in st) { if (st[sp] > bestV) { bestV = st[sp]; best = sp; } }
  return best;
}

function stats(xs) {
  if (!xs.length) return { mean: NaN, cv: NaN, n: 0 };
  const mean = xs.reduce((s, x) => s + x, 0) / xs.length;
  const v = xs.reduce((s, x) => s + (x - mean) * (x - mean), 0) / xs.length;
  return { mean, cv: mean > 1e-9 ? Math.sqrt(v) / mean : 0, n: xs.length };
}

console.log(`\n### DEPLETION-DIP PROBE  (MASS_BALANCE_SCALE=${MASS_BALANCE_SCALE})`);

for (const SCEN of SCENS) {
  if (!SCENARIOS[SCEN]) { console.log(`\n${SCEN}: (no such scenario)`); continue; }
  setSeed(42);
  const { conditions, events } = SCENARIOS[SCEN]();
  const sim = new VugSimulator(conditions, events);
  const STEPS = SCENARIOS[SCEN]().defaultSteps ?? 120;
  for (let s = 0; s < STEPS; s++) sim.run_step();

  const mesh = sim.wall_state.meshFor(sim);
  const N = sim.wall_state.cells_per_ring | 0;
  const cells = mesh.cells;

  // bulk per-ion stats across all cells, + which ions are tracked
  const ions = {};
  for (const c of cells) { const f = c && c.fluid; if (!f) continue; for (const k in f) if (typeof f[k] === 'number') (ions[k] ??= []).push(f[k]); }

  // crystals → per-ion dip: cell value vs bulk mean of that ion
  const perIonDips = {};   // ion → [dip fractions]
  let measured = 0, noStoich = 0;
  for (const c of sim.crystals) {
    const ion = primaryIon(c.mineral);
    if (!ion) { noStoich++; continue; }
    const a = sim.wall_state._resolveAnchor(c);
    if (!a) continue;
    const idx = a.ringIdx * N + a.cellIdx;
    const f = cells[idx] && cells[idx].fluid;
    if (!f || typeof f[ion] !== 'number') continue;
    const bulk = stats(ions[ion] || []).mean;
    if (!(bulk > 1e-9)) continue;
    (perIonDips[ion] ??= []).push((bulk - f[ion]) / bulk);   // + = crystal cell is BELOW bulk (a dip)
    measured++;
  }

  console.log(`\n── ${SCEN}  (${STEPS} steps, ${sim.crystals.length} crystals, ${cells.length} cells, N=${N}) ──`);
  console.log(`   crystals measured: ${measured}  (no-stoich: ${noStoich})`);
  // field uniformity for the ions crystals actually consume here
  const usedIons = Object.keys(perIonDips).sort();
  if (!usedIons.length) { console.log('   (no consumed-ion cells resolved)'); continue; }
  console.log(`   ion        bulk-mean    field-CV     mean-dip-at-crystal   maxdip`);
  for (const ion of usedIons) {
    const bs = stats(ions[ion] || []);
    const d = perIonDips[ion];
    const dipMean = d.reduce((s, x) => s + x, 0) / d.length;
    const dipMax = Math.max(...d);
    console.log(`   ${ion.padEnd(10)} ${bs.mean.toExponential(2).padStart(10)}  ${(bs.cv * 100).toFixed(2).padStart(7)}%   ${(dipMean * 100).toFixed(3).padStart(10)}% (n${d.length})      ${(dipMax * 100).toFixed(2)}%`);
  }
}
console.log(`\nlegend: field-CV≈0 → diffusion has flattened the broth (no spatial dips survive);`);
console.log(`        mean-dip>0 → crystal cells sit below bulk (a depletion halo exists at that magnitude).`);
