// tools/negative-fluid-census.mjs — negative cell-fluid census (PASSIVE).
//
// The additive event broadcast (_propagateGlobalDelta → voxel-grid
// propagateEventDelta, js/24:576) applies (post − pre) bulk deltas to
// EVERY voxel unguarded. When a crash-style event fires while cells
// have drifted below bulk (growth debits drain them; refill ≈ nil),
// the subtraction lands on the drifted value and the cell goes
// NEGATIVE — unphysical ppm. Discovered on shigar (Door 1): the star's
// cell reads ≈ −90 Be post-etch at SIM 219 (was −0.8 at SIM 218).
// Harmless TODAY (σ functions gate at ingredient minima; engines clamp
// their own debits at 0) but it will bite the first consumer that
// READS a negative trace — narrators, UV rules, D1c chemistry axes.
//
// This census runs the canonical seed-42 fleet and reports, per
// scenario and per fluid field: the minimum value any voxel reaches,
// when it first crosses 0, how many voxels sit negative at run end,
// and which event fired on the first-crossing step. The census is the
// clamp's justification AND its blast-radius forecast: every
// (scenario, field) row here is a place a propagate-time clamp at 0
// would move recorded outputs.
//
// Sampling: wall voxels (d=0 — the growth cells, where drift
// concentrates) are checked EVERY step; the full grid (interior d≥1)
// every 5 steps and at run end.
//
// SIGNED FIELDS (the census's own first finding, 2026-07-08): Eh and
// pH are legitimately negative — Eh is a redox potential in mV (−200
// is ordinary reducing geochemistry, deliberately modeled by the
// movements arc) and negative pH is physically attested (Iron
// Mountain mine water ran −3.6). Their rows are reported with
// signed:true and MUST NOT be clamped; the defect class is
// CONCENTRATION fields (ppm) below zero. First fleet census at SIM
// 219: 7 concentration rows across 6 scenarios — sabkha Ca −90.6
// (Tidal Flood #2), shigar Be −60.0 (The Etch) / K −4.5, schneeberg
// P −2.6, bisbee S −2.2 (no event line — the movements vector),
// great_salt_plains Ca −0.4, roughten_gill Fe −0.13 (6,082 voxels
// negative at run end — a persistent movements drift).
//
// Passive instrument (the vugg convention): prints JSON, exit 0 always.
//   node tools/negative-fluid-census.mjs [scenario ...]
//
import { loadSimBundle } from './_harness.mjs';

const { SCENARIOS, VugSimulator, setSeed } = await loadSimBundle({ toolName: 'negative-fluid-census' });

const only = process.argv.slice(2);
const names = only.length ? only : Object.keys(SCENARIOS).sort();

// Signed physical quantities — negative is a VALUE, not a defect.
const SIGNED_FIELDS = ['pH', 'Eh'];

const fleet = {};
let fleetRows = 0;

for (const name of names) {
  if (!SCENARIOS[name]) { console.error(`[census] unknown scenario ${name}`); continue; }
  setSeed(42);
  const { conditions, events, defaultSteps } = SCENARIOS[name]();
  const sim = new VugSimulator(conditions, events);
  const dur = defaultSteps ?? 200;
  const grid = sim.wall_state.voxelGridFor(sim);
  if (!grid || !grid.voxels || !grid.voxels.length) {
    fleet[name] = { note: 'no voxel grid — skipped' };
    continue;
  }
  const fields = sim._fluidFieldNames;
  // per-field: { min, minStep, firstNegStep, firstNegEvent }
  const rec = {};

  const scan = (step, wallOnly) => {
    const voxels = grid.voxels;
    for (let i = 0; i < voxels.length; i++) {
      const v = voxels[i];
      if (!v || !v.fluid) continue;
      if (wallOnly && v.depthIdx !== 0) continue;
      const f = v.fluid;
      for (let k = 0; k < fields.length; k++) {
        const val = f[fields[k]];
        if (typeof val !== 'number' || val >= 0) continue;
        let r = rec[fields[k]];
        if (!r) r = rec[fields[k]] = { min: 0, minStep: 0, firstNegStep: null, firstNegEvent: null };
        if (val < r.min) { r.min = val; r.minStep = step; }
        if (r.firstNegStep === null) {
          r.firstNegStep = step;
          const evLine = (sim.log || []).find(l => l.includes('⚡ EVENT'));
          r.firstNegEvent = evLine ? evLine.replace(/.*⚡ EVENT:\s*/, '').trim() : null;
        }
      }
    }
  };

  for (let s = 1; s <= dur; s++) {
    sim.run_step();
    scan(s, true);                    // wall cells every step
    if (s % 5 === 0 || s === dur) scan(s, false);  // full grid periodically
  }
  // end-state negative counts (full grid)
  const endCounts = {};
  for (const v of grid.voxels) {
    if (!v || !v.fluid) continue;
    for (const fn of fields) {
      const val = v.fluid[fn];
      if (typeof val === 'number' && val < 0) endCounts[fn] = (endCounts[fn] || 0) + 1;
    }
  }
  const rows = Object.entries(rec).map(([field, r]) => ({
    field,
    signed: SIGNED_FIELDS.includes(field),
    min: +r.min.toFixed(2),
    minStep: r.minStep,
    firstNegStep: r.firstNegStep,
    firstNegEvent: r.firstNegEvent,
    voxelsNegAtEnd: endCounts[field] || 0,
  })).sort((a, b) => a.min - b.min);
  if (rows.length) {
    fleet[name] = { rows };
    fleetRows += rows.length;
    const conc = rows.filter(r => !r.signed);
    const worst = conc[0];
    console.error(`  ${name.padEnd(28)} ${rows.length} negative field(s)` +
      (worst ? `, worst CONCENTRATION ${worst.field} ${worst.min}` : ' (signed-only — physical)'));
  } else {
    console.error(`  ${name.padEnd(28)} clean`);
  }
}

const concRows = [];
for (const [scen, data] of Object.entries(fleet)) {
  for (const r of (data.rows || [])) if (!r.signed) concRows.push({ scenario: scen, ...r });
}
concRows.sort((a, b) => a.min - b.min);

console.log(JSON.stringify({
  tool: 'negative-fluid-census',
  fleetScenariosWithNegatives: Object.keys(fleet).filter(k => fleet[k].rows).length,
  fleetNegativeRows: fleetRows,
  concentrationDefects: concRows,
  scenarios: fleet,
}, null, 1));
