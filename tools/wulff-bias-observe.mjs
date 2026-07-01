#!/usr/bin/env node
// tools/wulff-bias-observe.mjs — DARK-OBSERVE for the "kinetic biasC" proposal (realism roadmap rank 1).
// The proposal: retire classifyWulffForm's golden-ratio biasC hash and drive face-bias from each crystal's
// own recorded _morphology.surf_sigma (which classifyMorphologyStep computes from chemistry). BEFORE any
// code change, this sweep answers the empirical question the critic raised: across the seed-42 render
// population of each Wulff tenant, does surf_sigma actually SPREAD, or is it near-constant / absent?
//   - If ABSENT (mineral not in MORPH_TH): there is NO signal to wire to at all.
//   - If NEAR-CONSTANT: wiring biasC to it changes nothing — the hash is doing the real spread work, so the
//     "earned form" story is illusory for that tenant (a no-op dressed as a keystone).
//   - If it SPREADS: real signal — kinetic biasC would add earned variation there.
// It reports, per tenant, the surf_sigma distribution (crystal-final AND pooled per-zone growth history) vs
// the CURRENT hashed biasC distribution, so we can see whether chemistry or the id-hash carries the variety.
// SIM-neutral, read-only.  KEY FACT: classifyMorphologyStep computes ONE bulk sigma per mineral per step;
// per-crystal surf_sigma variation comes only from the boundary-layer size-damp + which step each crystal
// last grew, NOT from crystals seeing different fluid.
import { loadSimBundle } from './_harness.mjs';
const { SCENARIOS, VugSimulator, setSeed } = await loadSimBundle({ toolName: 'wulff-bias-observe' });
const SEED = Number(process.env.SEED || 42);

// the six live Wulff tenants and their showcase scenarios + opt-in flag
const TENANTS = [
  { min: 'fluorite',  scen: 'sunnyside_american_tunnel', flag: 'wulff_fluorite'  },
  { min: 'calcite',   scen: 'mvt',                        flag: 'wulff_calcite'   },
  { min: 'galena',    scen: 'mvt',                        flag: 'wulff_galena'    },
  { min: 'wulfenite', scen: 'supergene_oxidation',        flag: 'wulff_wulfenite' },
  { min: 'barite',    scen: 'wittichen',                  flag: 'wulff_barite'    },
  { min: 'titanite',  scen: 'grimsel_alpine_cleft',       flag: 'wulff_titanite'  },
];
// MORPH_TH registry (js/45) — the minerals with a surf_sigma signal at all
const MORPH_TH_MINERALS = new Set(['calcite', 'halite', 'sylvite', 'native_bismuth', 'fluorite', 'pyrite', 'native_copper', 'native_gold']);

const stat = (xs) => {
  if (!xs.length) return null;
  const n = xs.length, mean = xs.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / n);
  return { n, min: Math.min(...xs), max: Math.max(...xs), mean, sd, cv: mean ? sd / mean : 0 };
};
const fmt = (s, d = 3) => s ? `n=${s.n} min=${s.min.toFixed(d)} max=${s.max.toFixed(d)} mean=${s.mean.toFixed(d)} CV=${(s.cv * 100).toFixed(1)}%` : '(none)';

console.log(`=== wulff-bias-observe — does surf_sigma spread across each Wulff tenant's render population? (seed ${SEED}) ===\n`);
const summary = [];
for (const t of TENANTS) {
  setSeed(SEED);
  const { conditions, events, defaultSteps } = SCENARIOS[t.scen]();
  conditions.wall[t.flag] = true;                    // force the Wulff opt-in so classifyWulffForm tags the tenant
  const sim = new VugSimulator(conditions, events);
  const steps = defaultSteps || 160;
  for (let i = 0; i < steps; i++) sim.run_step();

  const all = sim.crystals.filter(c => c.mineral === t.min && !c.dissolved);
  const tagged = all.filter(c => c._wulffForm);       // the actual Wulff render population (biasC matters here)
  const withMorph = tagged.filter(c => c._morphology && isFinite(c._morphology.surf_sigma));

  const finalSurf = withMorph.map(c => c._morphology.surf_sigma);
  const zoneSurf = [];
  for (const c of tagged) for (const z of (c.zones || [])) if (z && isFinite(z.morph_surf_sigma)) zoneSurf.push(z.morph_surf_sigma);
  const biasCs = tagged.map(c => c._wulffForm.biasC).filter(isFinite);
  const regimes = {}; for (const c of withMorph) { const r = c._morphology.regime || '?'; regimes[r] = (regimes[r] || 0) + 1; }

  const sS = stat(finalSurf), zS = stat(zoneSurf), bS = stat(biasCs);
  const inReg = MORPH_TH_MINERALS.has(t.min);
  let verdict;
  if (!inReg) verdict = 'NO SIGNAL — not in MORPH_TH (surf_sigma never computed for this tenant)';
  else if (!sS) verdict = 'NO DATA — in MORPH_TH but no tagged crystal carries _morphology (grew when σ<1?)';
  else if (sS.cv < 0.05) verdict = `NEAR-CONSTANT surf_sigma (CV ${(sS.cv * 100).toFixed(1)}%) — wiring biasC to it would be a NO-OP; the id-hash carries the spread`;
  else verdict = `surf_sigma SPREADS (CV ${(sS.cv * 100).toFixed(1)}%) — real signal for kinetic biasC`;

  console.log(`### ${t.min}  (${t.scen}, ${steps} steps) — MORPH_TH? ${inReg ? 'YES' : 'NO'}`);
  console.log(`  Wulff-tagged render population: ${tagged.length}  |  carrying _morphology: ${withMorph.length}`);
  console.log(`  surf_sigma (crystal-final):  ${fmt(sS)}`);
  console.log(`  surf_sigma (pooled per-zone growth history):  ${fmt(zS)}`);
  console.log(`  CURRENT hashed biasC:  ${fmt(bS)}`);
  console.log(`  regimes: ${JSON.stringify(regimes)}`);
  console.log(`  → ${verdict}\n`);
  summary.push({ min: t.min, inReg, tagged: tagged.length, surfCV: sS ? sS.cv : null, biasSpread: bS ? bS.max - bS.min : null, verdict });
}

console.log('=== VERDICT TABLE ===');
for (const s of summary) {
  console.log(`  ${s.min.padEnd(10)} tagged=${String(s.tagged).padStart(3)}  surfCV=${s.surfCV == null ? '  n/a ' : (s.surfCV * 100).toFixed(1).padStart(5) + '%'}  biasSpread=${s.biasSpread == null ? 'n/a' : s.biasSpread.toFixed(2)}  ${s.verdict.split(' —')[0]}`);
}
const haveSignal = summary.filter(s => s.inReg && s.surfCV != null && s.surfCV >= 0.05);
const noSignal = summary.filter(s => !s.inReg);
console.log(`\n${haveSignal.length}/6 tenants have a SPREADING surf_sigma signal today; ${noSignal.length}/6 have NO signal (not in MORPH_TH).`);
console.log(haveSignal.length ? `  kinetic biasC is real for: ${haveSignal.map(s => s.min).join(', ')}` : '  kinetic biasC would be a no-op or blocked on every tenant as-is.');
