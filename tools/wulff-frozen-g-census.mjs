#!/usr/bin/env node
// tools/wulff-frozen-g-census.mjs — measure the FROZEN-g population across the Wulff tenants
// (growth-geometry handoff 2026-07-01, "what I'd do next" #2 precondition: "measure each tenant's
// frozen-g population before claiming the payoff").
//
// The tag-time freeze: classifyWulffForm computes growthFrac = clamp(total_growth_um/250, .15, 1)
// ONCE when a crystal first qualifies (~the 30µm crossing) and never again (js/45 `if (c._wulffForm)
// continue`), so a hero that grows on to 200µm renders at its tag-step g forever. Rung 4a.7 retired
// the freeze for WULFENITE only (per-step re-derivation). This probe reports, per tenant on its
// canonical scenario at seed 42: every tagged crystal's frozen growthFrac vs the live g it has
// actually earned, the population's delta stats, and the hero (largest crystal) — the case the eye
// lands on. Wulfenite runs as the CONTROL (expect delta ≈ 0, the unfrozen tenant).
//
// SIM-neutral, read-only: forces nothing, mutates nothing, draws no rng beyond the runs themselves.
import { loadSimBundle } from './_harness.mjs';
const { SCENARIOS, VugSimulator, setSeed } = await loadSimBundle({ toolName: 'wulff-frozen-g-census' });
const SEED = 42;

// tenant → its shipped scenario (data/scenarios.json5 wall.wulff_* opt-ins; mvt carries two)
const RUNS = [
  { scen: 'sunnyside_american_tunnel', tenants: ['fluorite'] },
  { scen: 'mvt',                       tenants: ['calcite', 'galena'] },
  { scen: 'supergene_oxidation',       tenants: ['wulfenite'] },   // CONTROL — unfrozen since 4a.7
  { scen: 'wittichen',                 tenants: ['barite'] },
  { scen: 'grimsel_alpine_cleft',      tenants: ['titanite'] },
];

const liveG = (c) => Math.max(0.15, Math.min(1.0, (c.total_growth_um || 0) / 250));
const fmt = (x, n = 2) => (x == null || !isFinite(x)) ? '  —  ' : x.toFixed(n);

console.log(`=== Wulff frozen-g census — seed ${SEED}, canonical scenarios, final frame ===\n`);
const summary = [];
for (const { scen, tenants } of RUNS) {
  if (!SCENARIOS[scen]) { console.log(`!! scenario ${scen} missing — skipped`); continue; }
  setSeed(SEED);
  const { conditions, events, defaultSteps } = SCENARIOS[scen]();
  const sim = new VugSimulator(conditions, events);
  const steps = defaultSteps || 200;
  for (let i = 0; i < steps; i++) sim.run_step();

  for (const tenant of tenants) {
    const flag = conditions.wall && conditions.wall['wulff_' + tenant];
    const tagged = sim.crystals.filter(c => c && !c.dissolved && c.mineral === tenant && c._wulffForm);
    console.log(`--- ${tenant} @ ${scen} (${steps} steps, wall.wulff_${tenant}=${!!flag}) — ${tagged.length} tagged ---`);
    if (!tagged.length) { summary.push({ tenant, scen, n: 0 }); console.log(''); continue; }

    const rows = tagged.map(c => ({
      id: c.crystal_id, um: c.total_growth_um || 0,
      frozen: c._wulffForm.growthFrac, live: liveG(c),
    })).map(r => ({ ...r, delta: r.live - r.frozen }));
    rows.sort((a, b) => b.um - a.um);

    for (const r of rows.slice(0, 8)) {
      console.log(`  #${String(r.id).padStart(4)}  ${r.um.toFixed(0).padStart(5)}µm` +
        `  frozen g=${fmt(r.frozen)}  live g=${fmt(r.live)}  Δ=${fmt(r.delta)}` +
        (r === rows[0] ? '   ← HERO' : ''));
    }
    if (rows.length > 8) console.log(`  … ${rows.length - 8} more`);

    const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
    const understated = rows.filter(r => r.delta > 0.05);
    const hero = rows[0];
    console.log(`  population: mean frozen ${fmt(mean(rows.map(r => r.frozen)))} → mean live ${fmt(mean(rows.map(r => r.live)))}` +
      `  | Δ>0.05: ${understated.length}/${rows.length}` +
      `  | hero Δ=${fmt(hero.delta)} (renders g=${fmt(hero.frozen)}, earned g=${fmt(hero.live)})`);
    console.log('');
    summary.push({ tenant, scen, n: rows.length, heroFrozen: hero.frozen, heroLive: hero.live,
      understated: understated.length });
  }
}

console.log('=== verdict ===');
for (const s of summary) {
  if (!s.n) { console.log(`  ${s.tenant.padEnd(10)} @ ${s.scen.padEnd(26)} NO TAGGED POPULATION`); continue; }
  const payoff = (s.heroLive - s.heroFrozen) > 0.05 || s.understated > 0;
  console.log(`  ${s.tenant.padEnd(10)} @ ${s.scen.padEnd(26)} n=${String(s.n).padStart(3)}` +
    `  hero ${fmt(s.heroFrozen)}→${fmt(s.heroLive)}  understated ${s.understated}/${s.n}` +
    `  ${payoff ? 'UN-FREEZE PAYS' : 'already honest (no visible payoff)'}`);
}
