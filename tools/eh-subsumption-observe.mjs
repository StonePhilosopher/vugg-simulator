#!/usr/bin/env node
/**
 * tools/eh-subsumption-observe.mjs — EVENT-SUBSUMPTION dark observation
 * (commits nothing). The instrument for the bisbee/schneeberg arc.
 *
 * THE PROBLEM (master doc, "EVENT-CONFOUNDED redox"): bisbee and schneeberg
 * already have dynamic redox — but it's a STEP FUNCTION told through scripted
 * event O2 writes (bisbee: a nine-beat rollercoaster −150→+278 mV with a deep
 * reducing pulse at step 120; schneeberg: one great sigmoid −200→+290 at the
 * step-85 meteoric flood). A naive added movement would FIGHT those scripted
 * swings. SUBSUMPTION = the movement becomes the redox sentence (continuous,
 * declared, textured) and the events keep their chemistry beats (Cu/S/CO3/pH
 * for bisbee; P/As/Ca/Cu forks for schneeberg) — the naica composition
 * pattern, applied to Eh instead of T.
 *
 * WINDOW BOUNDARIES ARE GEOLOGY: a redox movement lives in GROUNDWATER, so
 * each window ends exactly at the scenario's drainage event (bisbee 305 =
 * final drying / full drain; schneeberg 110 = vadose exhumation). Past the
 * boundary, air owns redox (the vadose override's O2 floor) — and because
 * drivesFieldAt() goes false there, the Eh-canonical sync flips back to
 * O2→Eh and never clobbers the vadose boost. Vadose-clean by construction.
 *
 * Variants per scenario, multi-seed:
 *   BASE    what ships today (events only; movements forced to [])
 *   STORY   the candidate subsumption movement (events' O2 writes go dead
 *           inside the window — superseded, exactly like naica's T-drops)
 *
 * Usage:
 *   node tools/eh-subsumption-observe.mjs bisbee   [--seeds 42,1,7] [--no-texture]
 *   node tools/eh-subsumption-observe.mjs schneeberg --p at=0.75 --p soften=0.12
 *
 * --p name=value overrides a named preset parameter (listed in PRESETS below)
 * for quick shape sweeps without editing the file.
 */

import { loadSimBundle } from './_harness.mjs';

const { SCENARIOS, VugSimulator, setSeed } = await loadSimBundle({ toolName: 'eh-subsumption-observe' });

const args = process.argv.slice(2);
const SCEN = args.find((a) => !a.startsWith('--')) || 'bisbee';
const SEEDS = (args.includes('--seeds')
  ? args[args.indexOf('--seeds') + 1] : '42,1,7').split(',').map(Number);
const NO_TEXTURE = args.includes('--no-texture');
const OVERRIDES = {};
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--p' && args[i + 1] && args[i + 1].includes('=')) {
    const [k, v] = args[i + 1].split('=');
    OVERRIDES[k] = Number(v);
  }
}

if (!SCENARIOS[SCEN]) {
  console.error(`no scenario '${SCEN}'. available:`, Object.keys(SCENARIOS).sort().join(', '));
  process.exit(1);
}

// ---------------------------------------------------------------------------
// PRESETS — the candidate subsumption movement per scenario. All u-space
// params are expressed in STEPS here and converted, so they read like the
// event table. Values are designed from the measured BASE trace (this tool's
// own --trace output) + the event handlers' O2 setpoints via ehFromO2 anchors:
// (0.05,−150) (0.5,+100) (5,+500), floor −200 at O2=0.
// ---------------------------------------------------------------------------
const PRESETS = {
  bisbee: {
    window: [0, 305],          // 305 = final_drying (full drain) — air owns redox after
    base: -150,                // O2 0.05, primary chalcopyrite/bornite-stable brine
    params: {
      stepAt: 71,              // front MIDPOINT: oxidation rises FROM the step-65
      stepSoften: 12,          //   uplift event (ramp 65→77). Never precede the event;
      stepAmp: 330,            //   but a 22-step ramp starved brochantite's acid-flush
                               //   window (O2≥0.5 too late, blanket sulfides ate the S).
      sagCenter: 107,          // enrichment-blanket POISE (BASE sits +131 here, not
      sagWidth: 12,            //   +180): the pocket rides the redox interface where
      sagAmp: -60,             //   chalcocite replaces chalcopyrite
      pulseCenter: 133,        // the barren deep reducing pulse (native copper window;
      pulseWidth: 9,           //   event at 120 narrates arrival, gaussian keeps the
      pulseAmp: -400,          //   onset from running ahead of it; −400 → floor −185,
                               //   ~13 deep steps — amp −330's −110 floor lost
                               //   native_copper 5/8→below; −400 holds it at 5/5)
      trendAmp: 100,           // the long late oxidation climb → +280 plateau (azurite era)
      sigma: 0,                // DETERMINISTIC — texture re-rolls 1-crystal marginals;
                               //   the monsoon story is told by the EVENTS (azurite_peak)
    },
    ops: (p, span) => [
      { kind: 'step',  amp: p.stepAmp,  at: p.stepAt / span,       soften: p.stepSoften / span },
      { kind: 'pulse', amp: p.sagAmp,   center: p.sagCenter / span,   width: p.sagWidth / span },
      { kind: 'pulse', amp: p.pulseAmp, center: p.pulseCenter / span, width: p.pulseWidth / span },
      { kind: 'trend', amp: p.trendAmp, ease: true },
    ],
    headline: ['chalcopyrite', 'bornite', 'chalcocite', 'covellite', 'native_copper',
      'cuprite', 'azurite', 'malachite', 'chrysocolla', 'brochantite', 'jarosite'],
    // The cascade's soul isn't all in expects_species — the survival gate
    // must also defend these (vs that-seed BASE, so seeds where BASE lacks
    // one are unaffected).
    honorary: ['azurite', 'native_copper', 'cuprite', 'chalcocite', 'covellite'],
  },
  schneeberg: {
    window: [0, 110],          // 110 = vadose_exhumation — the phreatic story ends here
    base: -200,                // O2 0.0 floor — uraninite/sulfide-stable pegmatitic fluid
    params: {
      stepAt: 88,              // front midpoint: oxidation rises FROM the step-85
      stepSoften: 8,           //   meteoric flood (ramp 84→92); the ~8-step swing is
      stepAmp: 490,            //   sulfide-buffer exhaustion. −200 → +290 (O2 ~1.5).
      sigma: 0,                // DETERMINISTIC — see below
    },
    // SINGLE deterministic movement — the shipping shape. Measured findings
    // that led here (keep for the record):
    //   * front centered at 80 (oxidation BEFORE the meteoric arrival —
    //     scientifically backwards) trimmed the reducing era's tail and cost
    //     naumannite 7/8→5/8 + torbernite-lineage 8/8→7/8.
    //   * the canon-true front (at=88) keeps every reducing-era nucleation
    //     step IDENTICAL to BASE and the full gate at BASE rates, 8/8 seeds.
    //   * OU texture ANYWHERE re-rolled 1-crystal marginals (naumannite,
    //     metazeunerite): the buffered plateau doesn't flutter, the 16-step
    //     flood-buffered hold is below recorded flutter resolution, and the
    //     As-pulse EVENTS are the real punctuation. Naica no-noise precedent.
    build: (p) => [
      { field: 'fluid.Eh', startStep: 0, endStep: 110, base: -200,
        ops: [{ kind: 'step', amp: p.stepAmp, at: p.stepAt / 110, soften: p.stepSoften / 110 }],
        ...(p.sigma > 0 ? { texture: { theta: 0.3, sigma: p.sigma } } : {}) },
    ],
    // torbernite/zeunerite/autunite live as their meta- forms by run end (the
    // step-110 vadose dehydration RENAMES the crystal), so the headline list
    // carries both names; native_silver + naumannite watch the five-element/
    // selenide fringe the redox shape can move.
    headline: ['uraninite', 'torbernite', 'metatorbernite', 'zeunerite', 'metazeunerite',
      'autunite', 'meta-autunite', 'uranospinite',
      'native_bismuth', 'native_arsenic', 'native_silver', 'naumannite',
      'erythrite', 'annabergite', 'cobaltite', 'nickeline', 'cassiterite',
      'pharmacolite', 'haidingerite'],
    // expects_species names the PRE-dehydration species; by run end they live
    // as meta- forms (the step-110 vadose dehydration renames the crystal),
    // so the raw expects gate is BLIND to them — measured: a no-texture front
    // killed metatorbernite at seed 42 while the expects check still read ✓.
    // The type-locality species' living forms gate here. naumannite defends
    // the documented Erzgebirge selenide fringe.
    honorary: ['metatorbernite', 'metazeunerite', 'meta-autunite', 'naumannite'],
    // A LINEAGE is whole if EITHER form grew: which ring a uranyl mica lands
    // on (and hence whether the step-110 vadose front renames it) is a
    // placement coin flip orthogonal to the redox story being judged here.
    lineages: {
      torbernite: ['torbernite', 'metatorbernite'],
      metatorbernite: ['torbernite', 'metatorbernite'],
      zeunerite: ['zeunerite', 'metazeunerite'],
      metazeunerite: ['zeunerite', 'metazeunerite'],
      autunite: ['autunite', 'meta-autunite'],
      'meta-autunite': ['autunite', 'meta-autunite'],
    },
  },
};

const preset = PRESETS[SCEN];
if (!preset) {
  console.error(`no subsumption preset for '${SCEN}' — this tool covers: ${Object.keys(PRESETS).join(', ')}`);
  process.exit(1);
}
const P = { ...preset.params, ...OVERRIDES };
const [START, END] = preset.window;

const spec = SCENARIOS[SCEN]._json5_spec || {};
const EXPECTS = Array.isArray(spec.expects_species) ? spec.expects_species : [];
const STEPS = SCENARIOS[SCEN]().defaultSteps ?? 120;
const EVENT_STEPS = (spec.events || []).map((e) => e.step);

function storyMovement() {
  let ms;
  if (preset.build) {
    ms = preset.build(P);
  } else {
    const span = END - START;
    const m = {
      field: 'fluid.Eh', startStep: START, endStep: END, base: preset.base,
      ops: preset.ops(P, span),
    };
    if (P.sigma > 0) m.texture = { theta: 0.3, sigma: P.sigma };
    ms = [m];
  }
  if (NO_TEXTURE) for (const m of ms) delete m.texture;
  return ms;
}

function run(movements, seed) {
  setSeed(seed);
  const { conditions, events } = SCENARIOS[SCEN]();
  const sim = new VugSimulator(conditions, events);
  if (!sim.conditions._scenario) sim.conditions._scenario = {};
  sim.conditions._scenario.movements = movements;
  const eh = [], o2 = [];
  for (let s = 0; s < STEPS; s++) {
    sim.run_step();
    eh.push(sim.conditions.fluid.Eh);
    o2.push(sim.conditions.fluid.O2);
  }
  const counts = {};
  for (const c of sim.crystals) {
    counts[c.mineral] = counts[c.mineral] || { n: 0, max: 0, nuc: [] };
    counts[c.mineral].n++;
    counts[c.mineral].nuc.push(c.nucleation_step);
    if (c.total_growth_um > counts[c.mineral].max) counts[c.mineral].max = Math.round(c.total_growth_um);
  }
  return { eh, o2, counts, fill: sim.get_vug_fill ? sim.get_vug_fill() : NaN };
}

// Segment the trace at event boundaries so the table reads like the event list.
function segments(trace) {
  const bounds = [0, ...EVENT_STEPS.filter((s) => s > 0 && s < STEPS), STEPS];
  const out = [];
  for (let i = 0; i < bounds.length - 1; i++) {
    const seg = trace.slice(bounds[i], bounds[i + 1]);
    if (!seg.length) continue;
    const mean = seg.reduce((s, x) => s + x, 0) / seg.length;
    out.push({ from: bounds[i], to: bounds[i + 1], mean, min: Math.min(...seg), max: Math.max(...seg) });
  }
  return out;
}

const fmtC = (c) => (c
  ? `${c.n}×${c.max}µm @${c.nuc.sort((a, b) => a - b).join(',')}`.padEnd(24)
  : '— GONE —'.padEnd(24));

console.log(`\n### EH-SUBSUMPTION OBSERVATION — ${SCEN} (${STEPS} steps)`);
console.log(`    window ${START}→${END}, base ${preset.base} mV, params ${JSON.stringify(P)}${NO_TEXTURE ? ' (texture OFF)' : ''}`);
console.log(`    expects_species (${EXPECTS.length}): ${EXPECTS.join(', ')}`);

const detailSeed = SEEDS[0];
const baseDetail = run([], detailSeed);
const storyDetail = run(storyMovement(), detailSeed);

console.log(`\n  === Eh trace by event segment (seed ${detailSeed}) — BASE vs STORY ===`);
console.log('  steps        BASE: mean (min..max)        STORY: mean (min..max)');
console.log('  ---------------------------------------------------------------------');
const segB = segments(baseDetail.eh), segS = segments(storyDetail.eh);
for (let i = 0; i < segB.length; i++) {
  const b = segB[i], s = segS[i];
  console.log(`  ${`${b.from}-${b.to}`.padEnd(10)} ${b.mean.toFixed(0).padStart(8)} (${b.min.toFixed(0)}..${b.max.toFixed(0)})`.padEnd(42)
    + `${s.mean.toFixed(0).padStart(8)} (${s.min.toFixed(0)}..${s.max.toFixed(0)})`);
}

console.log(`\n  === headline assemblage (seed ${detailSeed}) ===`);
console.log('  mineral           BASE           STORY');
console.log('  ---------------------------------------------');
for (const m of preset.headline) {
  console.log(`  ${m.padEnd(16)} ${fmtC(baseDetail.counts[m])}  ${fmtC(storyDetail.counts[m])}`);
}

const baseSet = new Set(Object.keys(baseDetail.counts));
const storySet = new Set(Object.keys(storyDetail.counts));
const gained = [...storySet].filter((m) => !baseSet.has(m)).sort();
const lost = [...baseSet].filter((m) => !storySet.has(m)).sort();
console.log(`\n  full assemblage seed ${detailSeed}: BASE ${baseSet.size} → STORY ${storySet.size} species`);
console.log(`    +${gained.join(',') || '—'}`);
console.log(`    -${lost.join(',') || '—'}`);
console.log(`    fill: BASE ${baseDetail.fill.toFixed(2)} → STORY ${storyDetail.fill.toFixed(2)}`);

// Gate = expects + honorary, deduped to LINEAGE keys (a lineage is whole if
// either form grew). Per-seed verdicts use lineage presence; the rate table
// across all seeds is the real judge for 1-crystal marginals (the sicily
// v135/v137 lesson: presence-at-one-seed is a coin read, the RATE is the truth).
const lineages = preset.lineages || {};
const rawGate = [...EXPECTS, ...(preset.honorary || [])];
const gateKeys = [...new Set(rawGate.map((m) => (lineages[m] ? lineages[m][0] : m)))];
const present = (counts, key) => (lineages[key] ? lineages[key] : [key]).some((f) => counts[f]);
const gateLabel = (key) => (lineages[key] ? lineages[key].join('|') : key);

console.log(`\n  === gate survival across ${SEEDS.length} seeds (${gateKeys.length} lineages) ===`);
console.log('  seed   BASE-missing                      STORY-lost (vs that seed BASE)   verdict');
console.log('  ------------------------------------------------------------------------------------');
let anyLost = false;
const rate = {};
for (const key of gateKeys) rate[key] = { base: 0, story: 0 };
for (const seed of SEEDS) {
  const b = seed === detailSeed ? baseDetail : run([], seed);
  const s = seed === detailSeed ? storyDetail : run(storyMovement(), seed);
  for (const key of gateKeys) {
    if (present(b.counts, key)) rate[key].base++;
    if (present(s.counts, key)) rate[key].story++;
  }
  const preMissing = gateKeys.filter((k) => !present(b.counts, k)).map(gateLabel);
  const storyLost = gateKeys.filter((k) => present(b.counts, k) && !present(s.counts, k)).map(gateLabel);
  if (storyLost.length) anyLost = true;
  console.log(`  ${String(seed).padEnd(6)} ${(preMissing.join(',') || '—').padEnd(33)} ${(storyLost.join(',') || '—').padEnd(32)} ${storyLost.length ? '⚠ lost here' : '✓'}`);
}

console.log(`\n  === gate fire-rate (seeds firing / ${SEEDS.length}) — the judge for marginals ===`);
console.log('  lineage                        BASE   STORY');
console.log('  ---------------------------------------------');
let rateCollapse = false;
for (const key of gateKeys) {
  const r = rate[key];
  const collapsed = r.base >= Math.ceil(SEEDS.length / 2) && r.story < Math.ceil(r.base / 2);
  if (collapsed) rateCollapse = true;
  console.log(`  ${gateLabel(key).padEnd(30)} ${String(r.base).padStart(3)}    ${String(r.story).padStart(3)}${collapsed ? '   ⚠⚠ RATE COLLAPSE' : r.story > r.base ? '   ↑' : ''}`);
}
console.log(rateCollapse
  ? '\n  ⚠⚠ a gate lineage\'s fire-rate COLLAPSED under the story — tune before shipping.'
  : anyLost
    ? '\n  ✓ no rate collapse — per-seed losses are marginal re-rolls, not a story kill. Judge the rates above.'
    : '\n  ✓ gate whole at every seed — the shape is safe to bake.');
console.log('');
