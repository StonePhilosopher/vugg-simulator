// tools/uv-zone-census.mjs — DOOR 2 instrument (UV fluorescence scale audit).
//
// The seed finding (223a96b): calcite's 98c quench gate read `Fe < 5.0` — a
// broth-scale number tested against ZONE-scale traces (lattice partition
// ~0.08× for Fe in calcite), so no calcite ever quenched and Tutorial 2's
// dim-early-zones story rendered as a uniformly glowing bar. The rest of the
// UV palette is presumed sick the same way, in BOTH tables:
//   - js/98c zoneFluorescence (the UV bar, per-zone, render-only)
//   - js/27 Crystal.predict_fluorescence (the narrator string, per-crystal
//     avg — feeds 85a/85e → the story archive → SIM-ADJACENT)
//
// This census measures, over the canonical seed-42 fleet, per mineral:
//   1. zone-trace percentile distributions (Fe/Mn/Al/Cu/Cr) + radiation_damage
//      — the empirical zone-scale each gate must be calibrated against;
//   2. which 98c branches fire today vs never/always (per-zone tally, using
//      the REAL zoneFluorescence from the bundle, not a replica);
//   3. which js/27 verdict strings each crystal narrates (REAL method);
//   4. bar-vs-narrator DIVERGENCE (one table glows, the other doesn't);
//   5. the t0 fluid traces of each hosting scenario (rough empirical
//      partition = zone_p50 / fluid_t0, corroborating engine factors).
//
// The census IS the calibration table: commit 2 (98c recalibration) sets each
// threshold at the zone-scale image of its literature intent and cites these
// numbers per rule. PASSIVE instrument — reports and exits 0, never gates.
//
// Usage: node tools/uv-zone-census.mjs [--seed N] [--verbose]
//        node tools/uv-zone-census.mjs --detail calcite,sphalerite
//          (per-scenario per-crystal zone stats + sample notes — the
//           resolution the recalibration table is actually set from)

import { loadSimBundle } from './_harness.mjs';

const seedArg = process.argv.indexOf('--seed');
const SEED = seedArg >= 0 ? (parseInt(process.argv[seedArg + 1], 10) | 0) : 42;
const VERBOSE = process.argv.includes('--verbose');
const detailArg = process.argv.indexOf('--detail');
const DETAIL = detailArg >= 0 ? String(process.argv[detailArg + 1] || '').split(',').filter(Boolean) : [];

const bundle = await loadSimBundle({
  toolName: 'uv-zone-census',
  extraExports: ['zoneFluorescence'],
});
const { SCENARIOS, VugSimulator, setSeed, zoneFluorescence } = bundle;

if (typeof zoneFluorescence !== 'function') {
  console.error('[uv-zone-census] zoneFluorescence not exported from bundle — harness capture failed');
  process.exit(1); // instrument BROKEN (not a finding) — the one legitimate non-zero exit
}

// Minerals carrying a gated or fixed rule in either table. Opaque honest-nulls
// (pyrite/galena/hematite/…) are tallied under predict_fluorescence coverage
// but not trace-profiled — their branch needs no calibration.
const RULED = [
  'calcite', 'aragonite', 'ruby', 'corundum', 'sapphire', 'fluorite',
  'scheelite', 'adamite', 'willemite', 'autunite', 'uraninite', 'wulfenite',
  'apophyllite', 'emerald', 'quartz', 'sphalerite', 'wurtzite', 'smithsonite',
  'mimetite', 'feldspar', 'selenite', 'malachite',
  // uranyl family beyond autunite/uraninite — engine notes declare UV verdicts
  // (js/59 uranophane 💛) and the field-classic Cu²⁺ quench splits the family
  // (autunite blazes, torbernite family dark); none of these carry a 98c case.
  'uranophane', 'torbernite', 'metatorbernite', 'metazeunerite', 'uranospinite',
];
const TRACES = ['trace_Fe', 'trace_Mn', 'trace_Al', 'trace_Cu', 'trace_Cr', 'trace_Y', 'trace_Pb'];

const pct = (sorted, p) => sorted.length
  ? sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))]
  : null;
const fmt = (v) => (v == null ? '—' : (v >= 100 ? v.toFixed(0) : v >= 1 ? v.toFixed(2) : v.toFixed(3)));

// per-mineral accumulators
const acc = {}; // mineral -> { zones, traces:{f:[]}, radDmg:[], bar:{branch:count}, narr:{str:count}, hosts:{scen:{fluid,crystals}}, diverge:[] }
const bag = (m) => acc[m] || (acc[m] = {
  zones: 0, crystals: 0,
  traces: Object.fromEntries(TRACES.map((t) => [t, []])),
  radDmg: [], bar: {}, narr: {}, hosts: {}, diverge: [],
});

let fleetCrystals = 0, unknownNarr = 0, narrTotal = 0;

for (const name of Object.keys(SCENARIOS).sort()) {
  setSeed(SEED);
  let scen; try { scen = SCENARIOS[name](); } catch { continue; }
  const sim = new VugSimulator(scen.conditions, scen.events);
  const steps = scen.defaultSteps ?? 100;
  for (let i = 0; i < steps; i++) sim.run_step();

  for (const c of sim.crystals) {
    if (!c || !c.zones || !c.zones.length) continue;
    fleetCrystals++;

    // js/27 coverage stat over the WHOLE fleet (how much narrates 'unknown')
    let narrStr = null;
    if (typeof c.predict_fluorescence === 'function') {
      try { narrStr = c.predict_fluorescence(); } catch { narrStr = '(threw)'; }
      narrTotal++;
      if (narrStr === 'unknown') unknownNarr++;
    }

    if (!RULED.includes(c.mineral)) continue;
    const a = bag(c.mineral);
    a.crystals++;
    a.radDmg.push(c.radiation_damage || 0);
    if (narrStr != null) a.narr[narrStr] = (a.narr[narrStr] || 0) + 1;

    const host = a.hosts[name] || (a.hosts[name] = {
      crystals: 0,
      fluid: Object.fromEntries(['Fe', 'Mn', 'Al', 'Cu', 'Cr'].map((el) => {
        const f = scen.conditions && scen.conditions.fluid;
        return [el, f && typeof f[el] === 'number' ? f[el] : 0];
      })),
    });
    host.crystals++;

    // per-zone: traces + REAL 98c verdict
    let glowZones = 0;
    for (const z of c.zones) {
      a.zones++;
      for (const t of TRACES) a.traces[t].push(z[t] || 0);
      let v = null;
      try { v = zoneFluorescence(z, c.mineral, c); } catch { v = '(threw)'; }
      const key = v || '(inert)';
      a.bar[key] = (a.bar[key] || 0) + 1;
      if (v && v !== '(threw)') glowZones++;
    }

    // divergence: narrator says fluorescent-ish but NO zone glows, or
    // narrator says non-fluorescent/unknown but zones DO glow. HEURISTIC
    // (prose-parsing) — post-v225 the two voices share gates by
    // construction, so anything listed here is a wording pattern this
    // regex doesn't know, not necessarily a physics split. Anchored at
    // the start so "…Fe-quenched zones stay dark" mid-sentence (the
    // banded verdict) doesn't false-flag.
    if (narrStr != null) {
      const narrGlows = !/^(non-fluorescent|unknown|quenched|weak\/quenched|inert|usually non-fluorescent)/.test(narrStr);
      const barGlows = glowZones > 0;
      if (narrGlows !== barGlows) {
        a.diverge.push({ scen: name, id: c.crystal_id, narr: narrStr, glowZones, zones: c.zones.length });
      }
    }

    // --detail: per-crystal zone-stat line at calibration resolution
    if (DETAIL.includes(c.mineral)) {
      const st = (t) => {
        const s = c.zones.map((z) => z[t] || 0).sort((x, y) => x - y);
        const nz = s.filter((x) => x > 0).length;
        return nz ? `${t.slice(6)} p50 ${fmt(pct(s, 50))} max ${fmt(s[s.length - 1])}` : null;
      };
      const notes = [...new Set(c.zones.map((z) => z.note).filter(Boolean))].slice(0, 2);
      (a.detail || (a.detail = [])).push(
        `    ${name} #${c.crystal_id}: ${c.zones.length}z  ` +
        TRACES.map(st).filter(Boolean).join('  ') +
        `  radDmg ${fmt(c.radiation_damage || 0)}  bar[${glowZones}/${c.zones.length} glow]  narr "${narrStr}"` +
        (notes.length ? `\n      notes: ${notes.map((s) => JSON.stringify(String(s).slice(0, 90))).join(' | ')}` : ''));
    }
  }
}

console.log(`\nUV ZONE CENSUS — seed ${SEED} (Door 2 calibration table)`);
console.log('='.repeat(78));
console.log(`fleet crystals with zones: ${fleetCrystals}; narrator 'unknown': ${unknownNarr}/${narrTotal}`);

for (const m of RULED) {
  const a = acc[m];
  if (!a) { console.log(`\n${m.toUpperCase()} — NO fleet tenant at seed ${SEED} (rule dormant-by-absence)`); continue; }
  console.log(`\n${m.toUpperCase()} — ${a.crystals} crystals / ${a.zones} zones across ${Object.keys(a.hosts).length} scenario(s)`);
  for (const t of TRACES) {
    const s = a.traces[t].slice().sort((x, y) => x - y);
    const nz = s.filter((x) => x > 0).length;
    if (!nz) continue;
    console.log(`  ${t.padEnd(9)} p50 ${fmt(pct(s, 50))}  p90 ${fmt(pct(s, 90))}  p99 ${fmt(pct(s, 99))}  max ${fmt(s[s.length - 1])}  (nonzero ${nz}/${s.length})`);
  }
  const rd = a.radDmg.slice().sort((x, y) => x - y);
  if (rd[rd.length - 1] > 0) {
    console.log(`  radDmg    p50 ${fmt(pct(rd, 50))}  max ${fmt(rd[rd.length - 1])}`);
  }
  console.log(`  98c bar : ${Object.entries(a.bar).map(([k, n]) => `${k}×${n}`).join('  ') || '—'}`);
  console.log(`  js/27   : ${Object.entries(a.narr).map(([k, n]) => `"${k}"×${n}`).join('  ') || '—'}`);
  if (a.diverge.length) {
    console.log(`  DIVERGE : ${a.diverge.length} crystal(s) where bar and narrator disagree`);
    for (const d of a.diverge.slice(0, VERBOSE ? 99 : 4)) {
      console.log(`    ${d.scen} #${d.id}: narrator "${d.narr}" vs ${d.glowZones}/${d.zones} zones glowing`);
    }
  }
  if (VERBOSE) {
    for (const [scen, h] of Object.entries(a.hosts)) {
      const f = Object.entries(h.fluid).filter(([, v]) => v > 0).map(([k, v]) => `${k}=${v}`).join(' ');
      console.log(`    host ${scen}: ${h.crystals} crystal(s), t0 fluid ${f || '(no UV-relevant traces)'}`);
    }
  }
  if (a.detail) {
    console.log(`  per-crystal detail:`);
    for (const line of a.detail) console.log(line);
  }
}

console.log(`\n${'='.repeat(78)}`);
console.log('Reading: a gated branch that never appears in "98c bar" is DEAD; a gate');
console.log('whose inert arm never appears is ALWAYS-ON-IN-PRACTICE. Calibrate each');
console.log('threshold at the zone-scale image of its literature intent (223a96b).');
