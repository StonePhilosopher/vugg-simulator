#!/usr/bin/env node
/**
 * tools/birth-census.mjs — the birth census (mineral-recipe review, 2026-10-21).
 *
 * Records the conditions every nucleation was ADMITTED under, read from the live run. Two
 * traps it avoids:
 *   - Timing. The strip archive's per-step series hold each step's END state, and events carry
 *     sample_index = step − 1, so sample n is the end of step n + 1. A birth during step n
 *     usually matches sample n − 2 (the start of its step), sometimes n − 1, and never sample n
 *     alone (SIM 285 fleet, temperature within 0.05 °C). The review's first pass read sample n
 *     and put a porphyry stibnite (step 84) at "33.7 °C, +322 mV", past step 85's oxidation
 *     event; the run shows 351.1 °C, +44 mV.
 *   - Admission vs landing. Unless the wall has per_vertex_nucleation (or the thermal field is
 *     active), a species is admitted on the BULK fluid and its wall cell is drawn afterwards, so the
 *     landing cell's fluid is not what cleared the gate. Both are recorded; the checks use the
 *     admitting one (`admit: 'bulk' | 'cell'`).
 * It reruns each scenario at seed 42, wraps VugSimulator.prototype.nucleate (and the two anchor
 * pickers it calls), and checks each birth against:
 *
 *   - the mineral's own MINERAL_GATES (T, pH, O2 windows),
 *   - its own spec survival window (minerals.json pH_dissolution_below / _above),
 *   - its spec T_range_C,
 *   - the oxidized / reduced class lists of tools/nucleation-eh-census.mjs (+100 mV boundary).
 *
 * PASSIVE instrument: reads, reports, exits 0 regardless of findings. Output goes to
 * .local-evidence/ (the directory the identity guard excludes), so running it never disturbs a
 * test run's identity hash.
 *
 * Usage:
 *   node tools/birth-census.mjs                      # all scenarios
 *   node tools/birth-census.mjs sulphur_bank bisbee  # a subset
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = path.join(ROOT, '.local-evidence', 'birth-census');
fs.mkdirSync(OUT, { recursive: true });
const h = await import(pathToFileURL(path.join(ROOT, 'tools', '_harness.mjs')).href);
const { SCENARIOS, VugSimulator, setSeed, SIM_VERSION, MINERAL_GATES_REGISTRY } = await h.loadSimBundle({
  toolName: 'birth-census', extraExports: ['MINERAL_GATES_REGISTRY'],
});
const spec = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'minerals.json'), 'utf8')).minerals;

// Exact copy of js/20c ehFromO2 (anchors 0.05 → −150, 0.5 → +100, 5 → +500 mV).
function ehFromO2(o2) {
  if (typeof o2 !== 'number' || o2 <= 0) return -200;
  const l = Math.log10(Math.max(o2, 1e-6));
  if (l <= -1.30) return -150 + (l + 1.30) * 100;
  if (l <= -0.30) return -150 + (l + 1.30) * 250;
  if (l <= 0.70) return 100 + (l + 0.30) * 400;
  return 500 + (l - 0.70) * 1000;
}
// Same class lists as tools/nucleation-eh-census.mjs (54 oxidized, 47 reduced; keep them in step).
// The secondary Cu-enrichment sulfides (bornite/chalcocite/covellite) are absent on purpose — the
// defended enrichment blanket.
const OXIDIZED = new Set(['pyromorphite', 'mimetite', 'vanadinite', 'descloizite', 'mottramite', 'wulfenite', 'powellite', 'ferrimolybdite', 'raspite', 'stolzite', 'clinobisvanite', 'cerussite', 'malachite', 'azurite', 'smithsonite', 'rosasite', 'aurichalcite', 'hydrozincite', 'anglesite', 'linarite', 'caledonite', 'leadhillite', 'brochantite', 'antlerite', 'chalcanthite', 'jarosite', 'alunite', 'adamite', 'olivenite', 'scorodite', 'erythrite', 'annabergite', 'conichalcite', 'pharmacolite', 'willemite', 'hemimorphite', 'uranophane', 'dioptase', 'shattuckite', 'chrysoprase', 'tigers_eye', 'atacamite', 'turquoise', 'plumbogummite', 'goethite', 'lepidocrocite', 'hematite', 'pyrolusite', 'torbernite', 'autunite', 'zeunerite', 'uranospinite', 'carnotite', 'tyuyamunite']);
const REDUCED = new Set(['galena', 'sphalerite', 'wurtzite', 'pyrite', 'marcasite', 'chalcopyrite', 'molybdenite', 'tetrahedrite', 'tennantite', 'enargite', 'proustite', 'pyrargyrite', 'stibnite', 'bismuthinite', 'arsenopyrite', 'cobaltite', 'nickeline', 'millerite', 'skutterudite', 'safflorite', 'rammelsbergite', 'loellingite', 'acanthite', 'argentite', 'greenockite', 'hawleyite', 'realgar', 'orpiment', 'pararealgar', 'cinnabar', 'metacinnabar', 'calaverite', 'sylvanite', 'hessite', 'naumannite', 'clausthalite', 'uraninite', 'coffinite', 'siderite', 'chromite', 'wolframite', 'native_silver', 'native_bismuth', 'native_arsenic', 'native_copper', 'native_tellurium', 'awaruite']);

// ---- capture ----
const P = VugSimulator.prototype;
const origNuc = P.nucleate, origCell = P._assignWallCell, origRing = P._assignWallRing;
let lastCell = null, lastRing = null, current = null;
P._assignWallCell = function (...a) { lastCell = origCell.apply(this, a); return lastCell; };
P._assignWallRing = function (...a) { lastRing = origRing.apply(this, a); return lastRing; };
const SOL = ['Ca', 'CO3', 'Fe', 'Mn', 'Zn', 'Pb', 'Cu', 'S', 'S_sulfide', 'S_sulfate', 'As', 'Sb', 'Ag', 'Cd', 'Mg', 'SiO2', 'Al', 'K', 'Na', 'Cl', 'F', 'P', 'V', 'U', 'Ba', 'Sr', 'Mo', 'W', 'Ni', 'Co', 'Bi', 'Te', 'Se', 'Au', 'Hg', 'Sn', 'Li', 'Be', 'B', 'Cr', 'Ti'];
const events = [];
P.nucleate = function (mineral, position, sigma) {
  lastCell = null; lastRing = null;
  // Snapshot the bulk fluid BEFORE the anchor pickers run: it is what the species' gate read.
  const bulk = this.conditions.fluid;
  const bulkState = bulk ? { pH: bulk.pH, Eh: bulk.Eh, O2: bulk.O2, salinity: bulk.salinity } : null;
  const bulkSol = {};
  if (bulk) for (const k of SOL) if (typeof bulk[k] === 'number') bulkSol[k] = +bulk[k].toFixed(4);
  const admitOnCell = !!(this.wall_state?.per_vertex_nucleation || this._thermalFieldActivated);
  const c = origNuc.call(this, mineral, position, sigma);
  try {
    const N = this.wall_state.cells_per_ring;
    const mesh = this.wall_state.meshFor(this);
    const cellFluid = (lastRing != null && lastCell != null) ? mesh?.cells?.[lastRing * N + lastCell]?.fluid : null;
    const useCell = admitOnCell && !!cellFluid;
    const state = useCell ? { pH: cellFluid.pH, Eh: cellFluid.Eh, O2: cellFluid.O2, salinity: cellFluid.salinity } : bulkState;
    const ev = {
      scenario: current, step: this.step, mineral, id: c.crystal_id, position: String(c.position).slice(0, 60),
      admit: useCell ? 'cell' : 'bulk',
      T: c.nucleation_temp, sigma: c.nucleation_sigma, bulkT: this.conditions.temperature,
      pH: state.pH, Eh: state.Eh, O2: state.O2, salinity: state.salinity,
      cell_pH: cellFluid?.pH, cell_Eh: cellFluid?.Eh, cell_O2: cellFluid?.O2,
    };
    if (useCell) { for (const k of SOL) if (typeof cellFluid[k] === 'number') ev[k] = +cellFluid[k].toFixed(4); }
    else Object.assign(ev, bulkSol);
    events.push(ev);
  } catch (e) {
    // An instrument must refuse rather than guess: record the failure, never a fabricated state.
    events.push({ scenario: current, step: this.step, mineral, error: String(e?.message || e) });
  }
  return c;
};

const only = process.argv.slice(2);
for (const name of (only.length ? only : Object.keys(SCENARIOS)).sort()) {
  current = name;
  setSeed(42);
  const s = SCENARIOS[name]();
  const sim = new VugSimulator(s.conditions, s.events);
  const steps = s.defaultSteps ?? 100;
  for (let i = 0; i < steps; i++) sim.run_step();
}

// ---- analysis ----
const flags = [];
const per = {};
const flag = (e, why) => flags.push(`${e.scenario.padEnd(28)} s${String(e.step).padStart(3)} ${e.mineral.padEnd(15)} T ${(+e.T).toFixed(1).padStart(6)} pH ${(+e.pH).toFixed(2)} Eh ${(+e.Eh).toFixed(0).padStart(5)} O2 ${(+e.O2).toFixed(2)} σ ${(+e.sigma).toFixed(2)}  ${why}`);
for (const e of events) {
  if (e.error) { flags.push(`${e.scenario.padEnd(28)} s${String(e.step).padStart(3)} ${e.mineral.padEnd(15)} CAPTURE FAILED: ${e.error}`); continue; }
  const g = MINERAL_GATES_REGISTRY[e.mineral] || {};
  const sp = spec[e.mineral] || {};
  const p = (per[e.mineral] ||= { n: 0, T: [Infinity, -Infinity], pH: [Infinity, -Infinity], Eh: [Infinity, -Infinity], scen: new Set() });
  p.n++; p.scen.add(e.scenario);
  p.T = [Math.min(p.T[0], e.T), Math.max(p.T[1], e.T)];
  p.pH = [Math.min(p.pH[0], e.pH), Math.max(p.pH[1], e.pH)];
  p.Eh = [Math.min(p.Eh[0], e.Eh), Math.max(p.Eh[1], e.Eh)];
  if (g.T_min !== undefined && e.T < g.T_min - 0.5) flag(e, `below gate T_min ${g.T_min}`);
  if (g.T_max !== undefined && e.T > g.T_max + 0.5) flag(e, `above gate T_max ${g.T_max}`);
  if (g.pH_min !== undefined && e.pH < g.pH_min - 0.05) flag(e, `below gate pH_min ${g.pH_min}`);
  if (g.pH_max !== undefined && e.pH > g.pH_max + 0.05) flag(e, `above gate pH_max ${g.pH_max}`);
  if (g.O2_min !== undefined && e.O2 < g.O2_min - 1e-6) flag(e, `below gate O2_min ${g.O2_min} (≈${ehFromO2(g.O2_min).toFixed(0)} mV)`);
  if (g.O2_max !== undefined && e.O2 > g.O2_max + 1e-6) flag(e, `above gate O2_max ${g.O2_max} (≈${ehFromO2(g.O2_max).toFixed(0)} mV)`);
  if (typeof sp.pH_dissolution_below === 'number' && e.pH < sp.pH_dissolution_below) flag(e, `born below its own survival floor pH_dissolution_below ${sp.pH_dissolution_below}`);
  if (typeof sp.pH_dissolution_above === 'number' && e.pH > sp.pH_dissolution_above) flag(e, `born above its own survival ceiling pH_dissolution_above ${sp.pH_dissolution_above}`);
  if (OXIDIZED.has(e.mineral) && e.Eh < 100) flag(e, 'oxidized-class born below +100 mV');
  if (REDUCED.has(e.mineral) && e.Eh > 100) flag(e, 'reduced-class born above +100 mV');
  const decl = sp.T_range_C;
  if (Array.isArray(decl) && ((decl[0] !== null && e.T < decl[0] - 0.5) || (decl[1] !== null && e.T > decl[1] + 0.5))) flag(e, `outside minerals.json T_range_C ${JSON.stringify(decl)}`);
}
const fmt = (a, d = 0) => a[0] === a[1] ? a[0].toFixed(d) : `${a[0].toFixed(d)}..${a[1].toFixed(d)}`;
const ok = events.filter(e => !e.error);
const cellDiffers = ok.filter(e => typeof e.cell_pH === 'number' && Math.abs(e.cell_pH - e.pH) > 1e-6).length;
let txt = `BIRTH CENSUS — SIM ${SIM_VERSION}, seed 42, ${events.length} births: ${ok.filter(e => e.admit === 'bulk').length} admitted on the bulk fluid, ${ok.filter(e => e.admit === 'cell').length} on their wall cell (per-vertex nucleation or thermal field); landing-cell pH differs from the admitting pH at ${cellDiffers}; ${events.filter(e => e.error).length} capture failures\n\n`;
txt += `FLAGS (${flags.length}):\n${flags.sort().join('\n')}\n\nPER-MINERAL LOCAL BIRTH RANGES:\n`;
for (const [m, p] of Object.entries(per).sort()) {
  txt += `${m.padEnd(16)} n ${String(p.n).padStart(3)}  T ${fmt(p.T).padEnd(10)} pH ${fmt(p.pH, 2).padEnd(11)} Eh ${fmt(p.Eh).padEnd(10)} ${[...p.scen].join(',')}\n`;
}
fs.writeFileSync(path.join(OUT, 'birth-events.json'), JSON.stringify({ SIM_VERSION, events }, null, 1));
fs.writeFileSync(path.join(OUT, 'birth-census.txt'), txt);
console.log(`SIM ${SIM_VERSION}: ${events.length} births, ${flags.length} flags → ${path.relative(ROOT, OUT)}/birth-census.txt`);
