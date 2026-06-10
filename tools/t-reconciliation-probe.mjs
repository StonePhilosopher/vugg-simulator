#!/usr/bin/env node
/**
 * tools/t-reconciliation-probe.mjs — T-RECONCILIATION dark observation.
 * (Movements sub-project #1 — subsume ambient_cooling onto a dedicated
 * thermal stream. HANDOFF-GATES-AND-NARRATORS-2026-06-10.md next-step #1,
 * HANDOFF-MOVEMENTS-AND-BACKLOG-2026-06-01.md F1.)
 *
 * THE QUESTION. ambient_cooling (js/85d:137) is an ad-hoc per-step T movement
 * on the SHARED rng: a cooling drift (1 draw/step, always) + stochastic
 * thermal-pulse re-warming (1 draw/step always + 1..6 more when a pulse
 * fires, with SiO2/Fe/Mn/flow/pH riders). Moving those draws to a dedicated
 * stream decouples the thermal history from the nucleation cascade — the
 * precondition for scenarios DECLARING their own temperature movements
 * (naica's stable pool, the pegmatites' 650→300 ramp, marble's metamorphic
 * curve). But it shifts every shared-rng consumer → full-fleet rebake.
 *
 * WHAT THIS PROBE DOES (commits nothing, engine untouched):
 *   LIVE   — today's engine, as shipped.
 *   SHADOW — per-sim monkey-patch of ambient_cooling: IDENTICAL math, but
 *            drift + pulse draws come from a dedicated SeededRandom seeded
 *            (rng.state at construction) ^ 0x48454154 ('HEAT') — run-seed-
 *            derived (per-seed thermal variety preserved; ambient cooling is
 *            weather, not geology — contrast the movement stream's
 *            shape_seed^'MOVE', which IS geology), zero shared draws.
 *            The deterministic feedback tail (pH recovery, flow decay,
 *            quartz/sulfide depletion) is replicated verbatim — it is NOT
 *            part of the move (zero draws, stays in 85d).
 *
 * Equivalence claim being tested is STATISTICAL, not bit-exact (a different
 * stream is a different realization by construction):
 *   T1  per-scenario T trajectory stays in-family (mean/final/min T)
 *   T2  pulse counts stay in-family (same arrival law)
 *   T3  assemblages stay recognizable (species Jaccard) — this is the
 *       honest PREVIEW OF THE REBAKE BLAST RADIUS, not a pass/fail gate.
 *
 * Usage:
 *   node tools/t-reconciliation-probe.mjs                 # fleet, seed 42
 *   node tools/t-reconciliation-probe.mjs --seeds 8       # + multi-seed stats
 *                                                         #   on 3 sentinels
 *   node tools/t-reconciliation-probe.mjs --seeds 8 --scen cooling,mvt
 */

import { loadSimBundle } from './_harness.mjs';

const { SIM_VERSION, SCENARIOS, VugSimulator, setSeed, SeededRandom } =
  await loadSimBundle({ toolName: 't_reconciliation_probe' });

console.log(`SIM_VERSION ${SIM_VERSION}\n`);

const HEAT_SALT = 0x48454154; // ASCII 'HEAT' — distinct from 'MOVE' (85j) + spots (85k)

const argv = process.argv.slice(2);
const seedsIdx = argv.indexOf('--seeds');
const nSeeds = seedsIdx >= 0 ? Math.max(2, Number(argv[seedsIdx + 1]) || 8) : 0;
const scenIdx = argv.indexOf('--scen');
const seedScens = scenIdx >= 0
  ? argv[scenIdx + 1].split(',')
  : ['cooling', 'amethyst_geode', 'mvt'];

// ---------------------------------------------------------------
// The SHADOW patch — ambient_cooling verbatim, thermal draws moved
// to a dedicated stream. Mirror of js/85d:137-214; any divergence
// from that source is a probe bug, not a design choice.
// ---------------------------------------------------------------
function patchShadow(sim, heat) {
  sim.ambient_cooling = function (rate = null) {
    if (rate === null || rate === undefined) {
      const wr = this.conditions.wall?.cooling_rate;
      rate = (typeof wr === 'number' && isFinite(wr) && wr >= 0) ? wr : 1.5;
    }
    // — thermal drift: SHARED rng → heat stream —
    this.conditions.temperature -= rate * heat.uniform(0.8, 1.2);
    this.conditions.temperature = Math.max(this.conditions.temperature, 25);

    // — thermal pulses: SHARED rng → heat stream, logic identical —
    const cooledFraction = 1 - (this.conditions.temperature - 25) / Math.max(this._startTemp || 400, 100);
    const pulseChance = 0.04 + cooledFraction * 0.06;
    const _pulsesOn = (this.conditions.wall?.thermal_pulses !== false);
    if (heat.random() < pulseChance && this.conditions.temperature < (this._startTemp || 400) * 0.8 && _pulsesOn) {
      const spike = heat.uniform(30, 150);
      const newTemp = Math.min(this.conditions.temperature + spike, (this._startTemp || 400) * 0.95);
      const actualSpike = newTemp - this.conditions.temperature;
      if (actualSpike > 15) {
        this.conditions.temperature = newTemp;
        this.conditions.fluid.SiO2 += heat.uniform(50, 300);
        this.conditions.fluid.Fe += heat.uniform(2, 15);
        this.conditions.fluid.Mn += heat.uniform(1, 5);
        this.conditions.flow_rate = heat.uniform(1.5, 3.0);
        this.conditions.fluid.pH = Math.max(4.0, this.conditions.fluid.pH - heat.uniform(0.3, 1.0));
        this.log.push(`  🌡️ THERMAL PULSE: +${actualSpike.toFixed(0)}°C — hot fluid injection through fracture! T=${newTemp.toFixed(0)}°C`);
        this.log.push(`     Fresh fluid: SiO₂↑, Fe↑, Mn↑, pH↓ — new growth expected`);
      }
    }

    // — deterministic feedback tail (NOT part of the move; replicated so the
    //   patch is a drop-in). Zero rng draws in this block, live or shadow. —
    if (this.conditions.fluid.pH < 6.5) {
      const recovery = 0.1 * Math.min(this.conditions.flow_rate / 1.0, 2.0);
      this.conditions.fluid.pH += recovery;
    }
    if (this.conditions.flow_rate > 1.0) this.conditions.flow_rate *= 0.9;
    const active_quartz = this.crystals.filter(c => c.mineral === 'quartz' && c.active);
    if (active_quartz.length) {
      const depletion = active_quartz.reduce((s, c) => s + (c.zones.length ? c.zones[c.zones.length - 1].thickness_um : 0), 0) * 0.1;
      this.conditions.fluid.SiO2 = Math.max(this.conditions.fluid.SiO2 - depletion, 10);
    }
    const active_sulfides = this.crystals.filter(c => (c.mineral === 'pyrite' || c.mineral === 'chalcopyrite' || c.mineral === 'sphalerite') && c.active);
    for (const c of active_sulfides) {
      if (c.zones.length) {
        const dep = c.zones[c.zones.length - 1].thickness_um * 0.05;
        this.conditions.fluid.S = Math.max(this.conditions.fluid.S - dep, 0);
        this.conditions.fluid.Fe = Math.max(this.conditions.fluid.Fe - dep * 0.5, 0);
        if (c.mineral === 'chalcopyrite') {
          this.conditions.fluid.Cu = Math.max(this.conditions.fluid.Cu - dep * 0.8, 0);
        }
        if (c.mineral === 'sphalerite') {
          this.conditions.fluid.Zn = Math.max(this.conditions.fluid.Zn - dep * 0.8, 0);
        }
      }
    }
  };
}

// ---------------------------------------------------------------
// Run one scenario, one variant. Returns trajectory + outcome stats.
// loadSimBundle exposes the bundle's mutable `rng` indirectly: the
// shadow's heat seed is captured from a fresh throwaway SeededRandom
// of the run seed — same lineage the engine change will use
// ((rng.state at constructor) ^ HEAT_SALT); the probe approximates
// with (seed ^ HEAT_SALT) since rng.state at construction is a pure
// function of the seed for this pipeline. Realization differs from
// the eventual engine either way; statistics are what we compare.
// ---------------------------------------------------------------
// Heat-stream seeding needs a SCRAMBLE, not a bare XOR: nearby run seeds
// XOR a constant give nearby mulberry32 states whose early outputs
// correlate — observed as collapsed cross-seed variance (tutorial pulses
// ±0.00, cooling meanT σ 10.8→2.7) with `(seed ^ SALT)`. One throwaway
// SeededRandom draw avalanches the state apart. The engine change must
// do the same.
function heatStreamFor(seed) {
  const scramble = new SeededRandom(((seed | 0) ^ HEAT_SALT) >>> 0);
  return new SeededRandom(Math.floor(scramble.next() * 4294967296) >>> 0);
}

function runOne(name, seed, shadow) {
  setSeed(seed);
  const { conditions, events, defaultSteps } = SCENARIOS[name]();
  const sim = new VugSimulator(conditions, events);
  if (shadow) patchShadow(sim, heatStreamFor(seed));
  const steps = defaultSteps ?? 160;
  let sumT = 0, minT = Infinity, pulses = 0;
  for (let i = 0; i < steps; i++) {
    const log = sim.run_step();
    for (const line of log) if (line.includes('THERMAL PULSE')) pulses++;
    const T = sim.conditions.temperature;
    sumT += T; if (T < minT) minT = T;
  }
  const species = new Set(sim.crystals.map(c => c.mineral));
  return {
    meanT: sumT / steps, finalT: sim.conditions.temperature, minT, pulses,
    species, crystals: sim.crystals.length, steps,
  };
}

function jaccard(a, b) {
  if (!a.size && !b.size) return 1;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

// ---------------------------------------------------------------
// Part 1 — fleet sweep, seed 42: LIVE vs SHADOW per scenario.
// ---------------------------------------------------------------
console.log('— fleet sweep (seed 42): LIVE vs SHADOW —');
console.log('                              meanT(L→S)      finalT(L→S)     pulses  spJac  crys(L→S)');
console.log('-'.repeat(96));

let worstJac = 1, worstJacAt = '', worstDT = 0, worstDTAt = '';
const names = Object.keys(SCENARIOS);
for (const name of names) {
  const L = runOne(name, 42, false);
  const S = runOne(name, 42, true);
  const dMean = Math.abs(L.meanT - S.meanT);
  const jac = jaccard(L.species, S.species);
  if (jac < worstJac) { worstJac = jac; worstJacAt = name; }
  if (dMean > worstDT) { worstDT = dMean; worstDTAt = name; }
  console.log(
    `${name.padEnd(28)} ${L.meanT.toFixed(0).padStart(5)}→${S.meanT.toFixed(0).padEnd(5)}` +
    `   ${L.finalT.toFixed(0).padStart(5)}→${S.finalT.toFixed(0).padEnd(5)}` +
    `   ${String(L.pulses).padStart(2)}→${String(S.pulses).padEnd(2)}` +
    `  ${jac.toFixed(2)}` +
    `   ${String(L.crystals).padStart(3)}→${String(S.crystals).padEnd(3)}`
  );
}
console.log('-'.repeat(96));
console.log(`worst species Jaccard ${worstJac.toFixed(2)} (${worstJacAt}); worst |ΔmeanT| ${worstDT.toFixed(1)}°C (${worstDTAt})`);
console.log('NB: species/crystal drift at fixed seed is the EXPECTED rebake shift (different');
console.log('realization), not an error signal. The mechanic-preservation signals are meanT/pulses.');

// ---------------------------------------------------------------
// Part 2 (opt-in) — multi-seed distributions on sentinel scenarios.
// Same law ⇒ LIVE and SHADOW distributions should be indistinguishable.
// ---------------------------------------------------------------
if (nSeeds) {
  console.log(`\n— multi-seed (n=${nSeeds}) distribution check: ${seedScens.join(', ')} —`);
  for (const name of seedScens) {
    if (!SCENARIOS[name]) { console.log(`  (no scenario '${name}' — skipped)`); continue; }
    const stats = { L: { mT: [], p: [] }, S: { mT: [], p: [] } };
    for (let s = 1; s <= nSeeds; s++) {
      const L = runOne(name, s * 1009, false);
      const S = runOne(name, s * 1009, true);
      stats.L.mT.push(L.meanT); stats.L.p.push(L.pulses);
      stats.S.mT.push(S.meanT); stats.S.p.push(S.pulses);
    }
    const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
    const sd = a => { const m = mean(a); return Math.sqrt(mean(a.map(x => (x - m) * (x - m)))); };
    console.log(`  ${name}:`);
    console.log(`    meanT   LIVE ${mean(stats.L.mT).toFixed(1)}±${sd(stats.L.mT).toFixed(1)}   SHADOW ${mean(stats.S.mT).toFixed(1)}±${sd(stats.S.mT).toFixed(1)}`);
    console.log(`    pulses  LIVE ${mean(stats.L.p).toFixed(2)}±${sd(stats.L.p).toFixed(2)}   SHADOW ${mean(stats.S.p).toFixed(2)}±${sd(stats.S.p).toFixed(2)}`);
  }
}
