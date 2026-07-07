// tools/localcolor-signal-probe.mjs — LOCAL CRYSTAL COLOR signal probe (boss
// queued item: "local color for crystals, that will resolve your concern about
// minerals that share space blending together invisibly"). Commits nothing.
//
// THE QUESTION (the C1 discipline: measure the signal before building the lever)
// -----------------------------------------------------------------------------
// Color today is spec.class_color — every crystal of a species renders the SAME
// colour (js/99i buildCrystalMaterial), so same-species neighbours and
// translucent overlaps blend. The bedrock fix (bedrock-over-effect-hacks) tints
// each crystal by its OWN zone chemistry (trace_Fe/Mn/Al/Ti/Pb/Cu, already
// recorded per GrowthZone) — the wulfenite/calcite chemistry-exact idiom. But
// that only SEPARATES neighbours if their zone chemistry actually DIFFERS. If
// two calcites in one vug grew from the same broth to the same traces, the
// chemistry tint gives them the same colour and the blending stands.
//
// So measure, per scenario, WITHIN a species sharing one cavity:
//   1. do the crystals carry nonzero trace chemistry at all? (is there anything
//      to tint from — or is the fleet mostly trace-free?)
//   2. how much does the growth-weighted per-crystal trace vector SPREAD among
//      same-species neighbours? (wide spread → bedrock chemistry separates them;
//      flat → the bedrock tint is a near-no-op and a deterministic per-crystal
//      floor is needed to hit the boss's GOAL honestly.)
//
// Usage: node tools/localcolor-signal-probe.mjs [--seed 42] [--min 2]

import { loadSimBundle } from './_harness.mjs';

const { SCENARIOS, VugSimulator, setSeed } = await loadSimBundle({ toolName: 'localcolor-signal-probe' });

const args = process.argv.slice(2);
const SEED = args.includes('--seed') ? Number(args[args.indexOf('--seed') + 1]) : 42;
const MIN_GROUP = args.includes('--min') ? Number(args[args.indexOf('--min') + 1]) : 2;

const TRACES = ['trace_Fe', 'trace_Mn', 'trace_Al', 'trace_Ti', 'trace_Pb', 'trace_Cu'];

// growth-weighted per-crystal trace vector (weights = zone thickness, positive zones)
function crystalTraces(c) {
  const acc = {}; let G = 0;
  for (const t of TRACES) acc[t] = 0;
  for (const z of (c.zones || [])) {
    const w = z.thickness_um;
    if (!(w > 0)) continue;
    G += w;
    for (const t of TRACES) acc[t] += (z[t] || 0) * w;
  }
  if (G <= 0) return null;
  for (const t of TRACES) acc[t] /= G;
  acc._G = G;
  return acc;
}

const cv = (arr) => {
  if (arr.length < 2) return 0;
  const m = arr.reduce((a, b) => a + b, 0) / arr.length;
  if (m === 0) return 0;
  const v = arr.reduce((a, b) => a + (b - m) * (b - m), 0) / arr.length;
  return Math.sqrt(v) / m;   // coefficient of variation
};
const spread = (arr) => { const s = [...arr].sort((a, b) => a - b); return s[s.length - 1] - s[0]; };

// group per scenario × species (crystals sharing a cavity ARE same-species neighbours)
const groups = [];   // { scen, mineral, n, traces:[{...}] }
for (const scen of Object.keys(SCENARIOS)) {
  setSeed(SEED);
  let conditions, events, defaultSteps;
  try { ({ conditions, events, defaultSteps } = SCENARIOS[scen]()); } catch { continue; }
  const sim = new VugSimulator(conditions, events);
  for (let i = 0; i < (defaultSteps ?? 120); i++) sim.run_step();
  const bySpecies = new Map();
  for (const c of sim.crystals) {
    if (!c || c.dissolved) continue;
    const tv = crystalTraces(c);
    if (!tv) continue;
    if (!bySpecies.has(c.mineral)) bySpecies.set(c.mineral, []);
    bySpecies.get(c.mineral).push(tv);
  }
  for (const [mineral, tvs] of bySpecies) {
    if (tvs.length >= MIN_GROUP) groups.push({ scen, mineral, n: tvs.length, traces: tvs });
  }
}

// ---- Report ----
console.log(`\nLocal-colour signal probe — same-species neighbours sharing a cavity (seed ${SEED}, min group ${MIN_GROUP}).`);
console.log('Q: does per-crystal ZONE CHEMISTRY differ enough to tint neighbours apart, or is a deterministic floor needed?\n');

let anyChem = 0, flatChem = 0, totalGroups = groups.length;
const perTraceCV = {}; for (const t of TRACES) perTraceCV[t] = [];

console.log('scenario                       species          n  dominant traces (mean ppm)              maxCV   sep?');
console.log('------------------------------ ---------------- --- --------------------------------------- ------- ----');
for (const g of groups.sort((a, b) => a.scen.localeCompare(b.scen))) {
  const means = {}, cvs = {};
  for (const t of TRACES) {
    const vals = g.traces.map((tv) => tv[t]);
    means[t] = vals.reduce((a, b) => a + b, 0) / vals.length;
    cvs[t] = cv(vals);
    perTraceCV[t].push(cvs[t]);
  }
  // which traces are present (mean > 0.1 ppm) and how much they vary
  const present = TRACES.filter((t) => means[t] > 0.1);
  const maxCV = Math.max(0, ...present.map((t) => cvs[t]));
  const hasChem = present.length > 0;
  const separable = hasChem && maxCV >= 0.05;   // ≥5% relative spread → a visible tint difference
  if (hasChem) anyChem++; if (hasChem && !separable) flatChem++;
  const traceStr = present.length
    ? present.map((t) => `${t.slice(6)}=${means[t].toFixed(1)}`).join(' ')
    : '(trace-free)';
  console.log(
    `${g.scen.slice(0, 30).padEnd(30)} ${g.mineral.slice(0, 16).padEnd(16)} ${String(g.n).padStart(3)} ` +
    `${traceStr.slice(0, 39).padEnd(39)} ${maxCV.toFixed(3).padStart(7)} ${separable ? ' YES' : (hasChem ? ' flat' : '  none')}`);
}

console.log('\nSUMMARY');
console.log(`  same-species neighbour groups (n≥${MIN_GROUP}) : ${totalGroups}`);
console.log(`  groups carrying any trace chemistry        : ${anyChem}  (${(100 * anyChem / Math.max(1, totalGroups)).toFixed(0)}%)`);
console.log(`  of those, FLAT (maxCV<5% — tint can't separate) : ${flatChem}`);
console.log(`  → bedrock chemistry SEPARATES: ${anyChem - flatChem} groups; needs a deterministic floor: ${totalGroups - (anyChem - flatChem)}`);
console.log('\n  per-trace CV across all groups (how much each element varies neighbour-to-neighbour):');
for (const t of TRACES) {
  const arr = perTraceCV[t].filter((x) => x > 0);
  const med = arr.length ? [...arr].sort((a, b) => a - b)[Math.floor(arr.length / 2)] : 0;
  console.log(`    ${t.padEnd(10)} groups-with-variance=${String(arr.length).padStart(3)}  median CV=${med.toFixed(3)}`);
}

// ---- Fleet trace distribution (calibrate the chemistry tint on the sim's OWN scale) ----
const allTV = [];
for (const g of groups) for (const tv of g.traces) allTV.push(tv);
const q = (arr, p) => { if (!arr.length) return 0; const s = [...arr].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.round(p * (s.length - 1)))]; };
console.log('\n  FLEET per-crystal trace distribution (nonzero only — the tint calibration reference):');
for (const t of TRACES) {
  const arr = allTV.map((tv) => tv[t]).filter((x) => x > 0.01);
  if (!arr.length) { console.log(`    ${t.padEnd(10)} (none nonzero)`); continue; }
  console.log(`    ${t.padEnd(10)} n=${String(arr.length).padStart(4)}  med=${q(arr, 0.5).toFixed(2)} q75=${q(arr, 0.75).toFixed(2)} q90=${q(arr, 0.9).toFixed(2)} q99=${q(arr, 0.99).toFixed(2)} max=${q(arr, 1).toFixed(2)}`);
}
