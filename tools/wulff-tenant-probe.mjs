#!/usr/bin/env node
// tools/wulff-tenant-probe.mjs — GENERAL render-target survival probe for a candidate Wulff tenant
// (build-tools-to-verify). Runs `<scenario>` at seed 42 (override with SEED=) and, for `<mineral>`,
// reports the live habit + render-token histograms and a per-habit survival table (count / live /
// display-size-untwinned-live). The Wulff render path only fires for single-crystal geom TOKENS
// (prism, tablet, cube, octahedron, rhomb, scalene) — NOT crusts/sprays/blooms (botryoidal, spike,
// snowball) — so a tenant is viable ONLY if a FACETED-single-crystal habit survives display-size,
// untwinned, at the final frame. Reports the token so you can tell a real crystal from an aggregate
// that happens to share a token (e.g. erythrite 'cobalt_bloom'->prism is an EARTHY bloom, not a prism).
// SIM-neutral, read-only.  Usage: node tools/wulff-tenant-probe.mjs <mineral> <scenario>
import { loadSimBundle } from './_harness.mjs';
const { SCENARIOS, VugSimulator, setSeed } = await loadSimBundle({ toolName: 'wulff-tenant-probe' });
const SEED = Number(process.env.SEED || 42);
const MIN = process.argv[2];
const SCEN = process.argv[3];
if (!MIN || !SCEN) { console.error('usage: node tools/wulff-tenant-probe.mjs <mineral> <scenario>'); process.exit(2); }

// faithful subset of js/99i _habitGeomToken (the routing that decides the render primitive)
function token(habit) {
  const h = String(habit || 'prismatic').toLowerCase();
  if (h.startsWith('dendritic_')) return 'spike';
  if (h.includes('rhombic dodec') || h === 'garnet' || h === 'trapezohedral') return 'rhombic_dodec';
  if (h === 'dodecahedral' || h === 'dodecahedron') return 'dodecahedron';
  if (h === 'cubic' || h === 'cuboid' || h === 'cube' || h === 'stepped_cube' || h === 'hopper_cube' || h === 'hopper_growth' || h === 'striated_cubic') return 'cube';
  if (h.includes('pyritohedral')) return 'dodecahedron';
  if (h.includes('octahedral_ree') || h === 'octahedral' || h === 'octahedron') return 'octahedron';
  if (h.includes('rhombohedral')) return 'rhomb';
  if (h.includes('scalenohedral')) return 'scalene';
  if (h.includes('chalcedony')) return 'botryoidal';
  if (h.includes('botryoidal') || h.includes('reniform') || h.includes('mammillary') || h.includes('globular')) return 'botryoidal';
  if (h.includes('banded') || h === 'massive' || h.includes('massive')) return 'botryoidal';
  if (h.includes('tabular') || h === 'platy' || h === 'foliated' || h.includes('blade')) return 'tablet';
  if (h.includes('acicular') || h.includes('capillary') || h.includes('fibrous') || h.includes('satin')) return 'spike';
  if (h.includes('dendritic') || h.includes('arborescent')) return 'spike';
  if (h.includes('plumose')) return 'spike';
  if (h.includes('radiating')) return h.includes('columnar') ? 'prism' : 'spike';
  if (h === 'prismatic' || h === 'columnar' || h === 'bladed') return 'prism';
  return 'prism';
}
const FACETED = new Set(['prism', 'tablet', 'cube', 'octahedron', 'rhomb', 'scalene', 'rhombic_dodec', 'dodecahedron']);

setSeed(SEED);
if (!SCENARIOS[SCEN]) { console.error(`unknown scenario '${SCEN}'`); process.exit(2); }
const { conditions, events, defaultSteps } = SCENARIOS[SCEN]();
const sim = new VugSimulator(conditions, events);
const steps = defaultSteps || 160;
for (let i = 0; i < steps; i++) sim.run_step();

const xs = sim.crystals.filter(c => c.mineral === MIN);
const live = xs.filter(c => !c.dissolved);
console.log(`=== Wulff-tenant probe — ${MIN} in ${SCEN} seed ${SEED}, ${steps} steps ===`);
console.log(`${MIN}: total ${xs.length}  live ${live.length}  dissolved ${xs.length - live.length}\n`);

const DISPLAY = 30;
const perHabit = {};
for (const c of xs) {
  const h = String(c.habit || '(none)');
  const r = perHabit[h] || (perHabit[h] = { tok: token(h), n: 0, live: 0, disp: 0 });
  r.n++;
  if (!c.dissolved) { r.live++; if (!c.twinned && (c.total_growth_um || 0) >= DISPLAY) r.disp++; }
}
console.log('per-habit  (habit -> token | total / live / display-size-untwinned-live):');
let viable = 0;
for (const [h, r] of Object.entries(perHabit).sort((a, b) => b[1].disp - a[1].disp)) {
  const face = FACETED.has(r.tok);
  if (face) viable += r.disp;
  console.log(`  ${h.padEnd(24)} -> ${r.tok.padEnd(11)} ${face ? 'FACETED' : 'aggreg.'}  ${String(r.n).padStart(3)} / ${String(r.live).padStart(3)} / ${String(r.disp).padStart(3)}`);
}
console.log(`\nsizes (live): ${live.map(c => (c.total_growth_um || 0).toFixed(0)).sort((a, b) => b - a).slice(0, 12).join(', ')}µm ...`);
console.log(`\n${viable > 0 ? '✓' : '✗'} ${viable} display-size (≥${DISPLAY}µm) untwinned FACETED-single-crystal ${MIN} survive — ${viable > 0 ? `${SCEN} is a viable Wulff tenant.` : 'no faceted render target (a Wulff opt-in would be a no-op or an aggregate mis-render).'}`);
