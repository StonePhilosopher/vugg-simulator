// tools/amethyst-sceptre-probe.mjs — calibration probe for the Brazilian
// amethyst geode (the masking-sceptre showcase, commit 2 of the arc).
//
// Runs `amethyst_geode` at seed 42 and reports, for every quartz crystal, the
// three things the showcase must land:
//   1. THE MASKING SCEPTRE — a prism-dominant masked_horizon that classifyQuartz-
//      Sceptre (js/45) tagged route='masking', with stem/cap ≥ 200µm; capFrac
//      small enough to read as a narrow stem + wider head (the specimen).
//   2. AMETHYST COLOUR — avgFe>3 AND radiation_damage in (0.1, 0.3] (js/12: below
//      0.1 = clear, above 0.3 = smoky). gamma_host (js/59) drives the dose.
//   3. THE FILMS — celadonite (prism-dominant) + goethite (uniform) recorded.
//
// Re-run while tuning fluid.Fe / wall.gamma_host / the film phi / the pulse until
// the targets hit, THEN lock the baseline. Pure read; no mutation.
//
// Usage: node tools/amethyst-sceptre-probe.mjs [--seed N]

import { loadSimBundle } from './_harness.mjs';

const seedArg = process.argv.indexOf('--seed');
const SEED = seedArg >= 0 ? (parseInt(process.argv[seedArg + 1], 10) | 0) : 42;

const bundle = await loadSimBundle({ toolName: 'amethyst-sceptre-probe' });
const { SCENARIOS, VugSimulator, setSeed, resolveBodyColour, MINERAL_SPEC } = bundle;

// The AUTHORITATIVE render colour — call the D1b resolver the Three renderer uses
// (js/12a resolveBodyColour), so the probe verdict == what the eye will see.
// Falls back to a local replica of the D1b amethyst gate if the export is absent.
const AMETHYST_HEX = '#9966cc';
function growthWeightedFe(c) {
  let acc = 0, G = 0;
  for (const z of (c.zones || [])) { const w = z.thickness_um; if (!(w > 0)) continue; acc += (z.trace_Fe || 0) * w; G += w; }
  return G > 0 ? acc / G : 0;
}
function quartzColour(c) {
  const gwFe = growthWeightedFe(c);
  const radDmg = c.radiation_damage || 0;
  let hex = null;
  if (typeof resolveBodyColour === 'function') {
    const spec = (MINERAL_SPEC && MINERAL_SPEC.quartz) || null;
    try { hex = resolveBodyColour(c, spec); } catch { hex = null; }
  }
  let name;
  if (hex === AMETHYST_HEX) name = 'AMETHYST';
  else if (hex) name = `render ${hex}`;
  else if (radDmg > 0.3) name = 'smoky';                       // fallback replica
  else if (gwFe > 0.2 && radDmg > 0.1 && radDmg <= 0.3) name = 'AMETHYST';
  else name = 'clear';
  return { name, gwFe: +gwFe.toFixed(3), radDmg: +radDmg.toFixed(3), hex };
}

setSeed(SEED);
const scen = SCENARIOS['amethyst_geode']();
const sim = new VugSimulator(scen.conditions, scen.events);
const steps = scen.duration_steps ?? scen.defaultSteps ?? 110;
for (let i = 0; i < steps; i++) sim.run_step();

const quartz = sim.crystals.filter((c) => c && c.mineral === 'quartz');

console.log(`\nAMETHYST GEODE PROBE — seed ${SEED}, ${steps} steps`);
console.log('='.repeat(80));
console.log(`crystals total: ${sim.crystals.length}   quartz: ${quartz.length}`);

let sceptres = 0, amethysts = 0;
for (const c of quartz) {
  const col = quartzColour(c);
  const zones = c.zones || [];
  const mh = zones.filter((z) => z.masked_horizon);
  const sc = c._sceptre;
  if (sc) sceptres++;
  if (col.name === 'AMETHYST') amethysts++;
  console.log(`\n#${c.crystal_id}  c_len ${(c.c_length_mm || 0).toFixed(2)}mm  zones ${zones.length}  habit ${c.habit}`);
  console.log(`   colour: ${col.name}  (avgFe ${col.avgFe}, radDmg ${col.radDmg})`);
  if (sc) {
    console.log(`   SCEPTRE route=${sc.route}  stem ${Math.round(sc.stemUm)}µm  cap ${Math.round(sc.capUm)}µm  capFrac ${(sc.capFrac || 0).toFixed(2)}  @step ${sc.boundaryStep}`);
  } else {
    console.log(`   sceptre: none`);
  }
  for (const z of mh) {
    console.log(`   masked_horizon @step ${z.step}: film=${z.film_mineral}  φprism ${z.masked_phi_prism} φterm ${z.masked_phi_term}  ${(z.masked_phi_prism || 0) > (z.masked_phi_term || 0) ? '(PRISM-dominant → sceptre trigger)' : '(uniform/term → buried horizon)'}`);
  }
}

console.log('\n' + '-'.repeat(80));
console.log(`TARGETS: masking sceptres ${sceptres} (want ≥1 route=masking)   amethyst-coloured ${amethysts} (want ≥1)`);
const win = quartz.find((c) => c._sceptre && c._sceptre.route === 'masking' && quartzColour(c).name === 'AMETHYST');
console.log(win
  ? `✓ SHOWCASE MET: quartz #${win.crystal_id} is an AMETHYST masking sceptre (capFrac ${(win._sceptre.capFrac).toFixed(2)}).`
  : `✗ not yet — tune fluid.Fe / wall.gamma_host / film phi / pulse timing and re-run.`);
console.log('');
