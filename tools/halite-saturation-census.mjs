#!/usr/bin/env node
// tools/halite-saturation-census.mjs — the chloride-evaporite saturation
// census (rung-5 instrument, hostile-review fix ladder). For every scenario
// at seed 42: the salinity/concentration trajectories, peak BRINE STRENGTH
// = (salinity/35 psu) × evaporative concentration (in multiples of seawater),
// every halite/sylvite nucleation with its birth-step fluid, the evaporite
// arrival order (the bittern-sequence check: gypsum-family → halite → K-Mg
// bittern salts), and the σ each birth earns under the Usiglio-anchored
// model rung-5 shipped:
//   σ_halite  = (BS/10.6)²   — halite onset at 10.6× seawater (Usiglio 1849,
//                              Warren 2021 Evaporites)
//   σ_sylvite = (BS/70)²     — bittern K-salts at 70–90× (conservative end)
// The ppm axis deliberately CANNOT carry this decision: broths use abstracted,
// scenario-inconsistent sim-scale ppm (searles Na 1500 for a real ~110,000 ppm
// brine; sabkha Na 10,500 near-real). Brine strength is the axis the sim
// tracks in real units. An empty offender picture = every chloride birth sits
// above its onset (desiccation windows, drying events); a birth at BS < onset
// is a leak. Scenarios that never grow a chloride and never exceed 2× seawater
// are omitted from output.
//
// Usage: node tools/halite-saturation-census.mjs
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const h = await import(pathToFileURL(path.join(REPO, 'tools', '_harness.mjs')).href);
const { SCENARIOS, VugSimulator, setSeed } = await h.loadSimBundle({ toolName: 'hal-cen' });

const EVAP_ORDER = ['selenite', 'anhydrite', 'mirabilite', 'thenardite', 'borax', 'tincalconite', 'halite', 'sylvite'];
const CHLORIDES = new Set(['halite', 'sylvite']);
const HALITE_ONSET = 10.6, SYLVITE_ONSET = 70.0;

for (const name of Object.keys(SCENARIOS).sort()) {
  setSeed(42);
  const s = SCENARIOS[name]();
  const sim = new VugSimulator(s.conditions, s.events);
  const steps = s.defaultSteps ?? 100;
  const snap = [];
  let peakBS = 0, peakStep = 0, peakC = 0, peakSal = 0;
  for (let i = 0; i < steps; i++) {
    sim.run_step();
    const f = sim.conditions.fluid;
    const c = f.concentration ?? 1.0;
    const sal = f.salinity ?? 5.0;
    const bs = (sal / 35.0) * c;
    snap.push({ Na: f.Na, Cl: f.Cl, K: f.K, Mg: f.Mg, c, sal, T: sim.conditions.temperature, bs });
    if (bs > peakBS) { peakBS = bs; peakStep = i; }
    if (c > peakC) peakC = c;
    if (sal > peakSal) peakSal = sal;
  }
  const chlorideRows = [];
  const firstArrival = {};
  for (const cr of sim.crystals) {
    const st = Math.min(cr.nucleation_step ?? 0, snap.length - 1);
    if (EVAP_ORDER.includes(cr.mineral)) {
      if (!(cr.mineral in firstArrival) || st < firstArrival[cr.mineral]) firstArrival[cr.mineral] = st;
    }
    if (CHLORIDES.has(cr.mineral)) {
      const p = snap[st];
      chlorideRows.push({
        m: cr.mineral, step: cr.nucleation_step,
        Na: p.Na, Cl: p.Cl, K: p.K, c: p.c, sal: p.sal, T: p.T, bs: p.bs,
        sig: cr.mineral === 'halite' ? (p.bs / HALITE_ONSET) ** 2 : (p.bs / SYLVITE_ONSET) ** 2,
      });
    }
  }
  const hasChloride = chlorideRows.length > 0;
  const arrivals = Object.entries(firstArrival).sort((a, b) => a[1] - b[1]).map(([m, st]) => `${m}@${st}`).join(' -> ');
  const hMax = (peakBS / HALITE_ONSET) ** 2, sMax = (peakBS / SYLVITE_ONSET) ** 2;
  if (!(hasChloride || peakBS > 2 || hMax > 0.25)) continue;
  console.log(`\n## ${name}  salinity0 ${snap[0].sal}  peakC ${peakC.toFixed(2)}  peakSal ${peakSal.toFixed(1)}  peakBS ${peakBS.toFixed(2)}x seawater @step ${peakStep}`);
  console.log(`   model margins: halite sigma_max ${hMax.toFixed(3)}  sylvite sigma_max ${sMax.toFixed(4)}`);
  if (arrivals) console.log(`   evaporite arrivals: ${arrivals}`);
  for (const r of chlorideRows.sort((a, b) => (a.step ?? 0) - (b.step ?? 0))) {
    const flag = r.sig < 1 ? '  <-- LEAK (below onset)' : '';
    console.log(`   ${r.m.padEnd(8)} @${String(r.step).padStart(3)}  Na ${String(Math.round(r.Na)).padStart(6)} Cl ${String(Math.round(r.Cl)).padStart(6)} K ${String(Math.round(r.K)).padStart(5)}  c ${r.c.toFixed(2)}  sal ${r.sal.toFixed(1)}  BS ${r.bs.toFixed(2)}x  T ${r.T.toFixed(0)}  sigma ${r.sig.toFixed(3)}${flag}`);
  }
}
console.log('\n(omitted scenarios never grow a chloride, never exceed 2x seawater, and cannot approach halite onset)');
