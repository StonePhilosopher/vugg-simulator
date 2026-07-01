#!/usr/bin/env node
// tools/erythrite-wulff-probe.mjs — verify rung 4a.7 (erythrite, the SECOND monoclinic tenant:
// vivianite-group Co3(AsO4)2·8H2O) has a live render target BEFORE porting. Runs a scenario (default
// schneeberg — the "Saxon blue" cobalt-bloom locality, cold supergene stages within erythrite's T<=50C
// gate) at seed 42, then reports every erythrite at the final frame: size, twinned/dissolved, habit, and
// the render TOKEN that habit maps to via js/99i _habitGeomToken. grow_erythrite emits FOUR habits:
//   bladed_crystal   (excess>1.2, free crimson blades)  -> token 'tablet'  <-- THE Wulff-blade target
//   radiating_fibrous (nucleated on arsenides, on_primary) -> 'spike'  (spray of needles — NOT a blade)
//   botryoidal_crust  (excess>0.5)                       -> 'botryoidal'  (crust)
//   cobalt_bloom      (else, low excess)                 -> 'prism'  (earthy bloom, default)
// UNLIKE titanite (all habits were single crystals), only bladed_crystal is a faceted single blade — the
// sprays/crusts/blooms are genuine aggregates and must stay as-is. So the render target = display-size,
// untwinned, LIVE, habit='bladed_crystal' erythrite at the last frame. If none survive, this scenario is
// NOT a viable erythrite Wulff tenant (the probe discipline — don't clone a dead flag). SIM-neutral, read-only.
import { loadSimBundle } from './_harness.mjs';
const { SCENARIOS, VugSimulator, setSeed } = await loadSimBundle({ toolName: 'erythrite-wulff-probe' });
const SEED = Number(process.env.SEED || 42);
const SCEN = process.argv[2] || 'schneeberg';

// mirror of js/99i _habitGeomToken for the erythrite-relevant habits
function token(habit) {
  const h = String(habit || 'prismatic').toLowerCase();
  if (h.includes('botryoidal') || h.includes('reniform') || h.includes('mammillary') || h.includes('globular')) return 'botryoidal';
  if (h.includes('tabular') || h === 'platy' || h === 'foliated' || h.includes('blade')) return 'tablet';
  if (h.includes('acicular') || h.includes('capillary') || h.includes('fibrous') || h.includes('satin')) return 'spike';
  if (h.includes('plumose')) return 'spike';
  if (h.includes('radiating')) return h.includes('columnar') ? 'prism' : 'spike';
  if (h === 'prismatic' || h === 'columnar' || h === 'bladed') return 'prism';
  return 'prism';
}

setSeed(SEED);
if (!SCENARIOS[SCEN]) { console.error(`unknown scenario '${SCEN}'`); process.exit(2); }
const { conditions, events, defaultSteps } = SCENARIOS[SCEN]();
conditions.wall.wulff_erythrite = true;                 // force the opt-in (no-op until the classifier branch exists)
const sim = new VugSimulator(conditions, events);
const steps = defaultSteps || 160;
for (let i = 0; i < steps; i++) sim.run_step();

const ery = sim.crystals.filter(c => c.mineral === 'erythrite');
const live = ery.filter(c => !c.dissolved);
console.log(`=== erythrite Wulff probe — ${SCEN} seed ${SEED}, ${steps} steps ===`);
console.log(`erythrite total ${ery.length}  | live ${live.length}  | dissolved ${ery.length - live.length}\n`);

const habHist = {}, tokHist = {};
for (const c of live) {
  const h = String(c.habit || '(none)'); habHist[h] = (habHist[h] || 0) + 1;
  const t = token(c.habit); tokHist[t] = (tokHist[t] || 0) + 1;
}
console.log('live habit histogram:', JSON.stringify(habHist));
console.log('live token histogram:', JSON.stringify(tokHist), '\n');

for (const c of ery.slice(0, 40)) {
  console.log(
    `  #${String(c.crystal_id).padStart(3)}  ${(c.total_growth_um || 0).toFixed(0).padStart(5)}µm` +
    `  habit=${String(c.habit).padEnd(18)}  token=${token(c.habit).padEnd(10)}` +
    `  ${c.dissolved ? 'DISSOLVED' : 'live   '}  ${c.twinned ? 'TWINNED' : '       '}  pos=${String(c.position || '').slice(0, 34)}`
  );
}

const DISPLAY = 30;
const blades = live.filter(c => token(c.habit) === 'tablet' && !c.twinned && (c.total_growth_um || 0) >= DISPLAY);
console.log(`\nSURVIVAL: ${blades.length} display-size (≥${DISPLAY}µm) untwinned bladed_crystal (token 'tablet') erythrite at the final frame.`);
console.log(blades.length
  ? `\n✓ render target EXISTS — ${SCEN} is a viable erythrite (monoclinic) Wulff tenant — the crimson vivianite-group blade.`
  : `\n✗ NO display-size untwinned bladed erythrite survives at seed ${SEED} — probe other seeds/scenarios before wiring (a tablet-gated Wulff blade would be a no-op).`);
