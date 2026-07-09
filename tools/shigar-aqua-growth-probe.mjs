// tools/shigar-aqua-growth-probe.mjs — Door 1 instrument (PASSIVE).
//
// Measures the shigar_pegmatite aquamarine growth system CLOSED-LOOP,
// with every feedback live: per-cell fluid drain, neighbor/voxel refill,
// competition, nucleation response, O3 geometric selection, the etch.
//
// What the first cut of this instrument taught (2026-07-08, all three
// now baked into the design):
//   1. Growth engines read the crystal's CELL fluid, not conditions.fluid
//      (_runEngineForCrystal swaps it in). Holding bulk Be out-of-band
//      moves σ(bulk) and changes NOTHING — dGrowth/dσ measured 0.00 flat.
//      Deliveries only reach cells through the event broadcast
//      (_snapshotGlobal → mutate → _propagateGlobalDelta), so that is
//      the only honest way to emulate a bigger delivery. Grep-the-tree
//      law, 4th landing: the consumer reads a different SOURCE.
//   2. The law is rate = BERYL_FAMILY_GROWTH_K × (σ_cell − 1) × U(0.8,1.2),
//      ×timeScale(5) in add_zone. K alone can't be swept from outside the
//      bundle, hence the setBerylFamilyGrowthK dev hook (js/59).
//   3. _beryl_base_sigma caps every factor (be_f ≤ 2.5 at Be 37.5,
//      al_f ≤ 1.5, si_f ≤ 1.5, fe_f ≤ 1.8) → σ_aquamarine ceilings ≈ 9.
//      Delivery alone therefore tops the star out ≈ 2 mm; the 20 mm
//      acceptance NEEDS the family K (the door's census-gated lever 2).
//
// Sections:
//   A. BASELINE — seed-42 story at shipped constants: star-CELL σ/Be
//      through the window, final aqua distribution, etch %, the
//      quartz/albite comparators, species census. Doubles as the
//      byte-identity check for the K hoist (star must read 0.60 mm at
//      K = 2.2 while the refactor is unshipped).
//   B. σ-RESPONSE — empirical σ(Be) and σ(Fe) curves + the measured
//      ceiling, so the caps stay data instead of folklore.
//   C. (K × DELIVERY) GRID — full 70-step reruns at seed 42. Delivery
//      is applied at step 32 through the real propagate-delta broadcast
//      (identical mechanism to a larger event pulse). Reports star/fry
//      sizes, counts, etch %, window σ trajectory at the star's cell,
//      and the non-beryl census so blast radius inside the scenario is
//      visible per run.
//
// Passive instrument (the vugg convention): prints JSON, exit 0 always.
// Run AFTER `npm run build` — this evals dist/, not js/ source.
//
//   node tools/shigar-aqua-growth-probe.mjs
//
import { loadSimBundle } from './_harness.mjs';

const { SCENARIOS, VugSimulator, setSeed, setBerylFamilyGrowthK, BERYL_FAMILY_GROWTH_K } =
  await loadSimBundle({ toolName: 'shigar-aqua-growth-probe', extraExports: ['setBerylFamilyGrowthK', 'BERYL_FAMILY_GROWTH_K'] });

const SCEN = 'shigar_pegmatite';
// Read the SHIPPED default — never pin it here. The first cut of this
// probe hard-coded 2.2 and silently overrode the SIM 219 tune in its
// own baseline section: the frozen-parameter converse (4a.8), biting
// the instrument itself. Section A must measure the game as shipped.
const K_DEFAULT = (typeof BERYL_FAMILY_GROWTH_K === 'number') ? BERYL_FAMILY_GROWTH_K : 2.2;
const EVENT_STEP = 32;        // shigar_aqua_saturation fires here
const WINDOW = { start: 33, end: 56 };   // growth window; hf_etch at 58 stays honest

function starCellSigma(sim) {
  // σ as the ENGINE sees it: the star's cell fluid, swapped in the same
  // way _runEngineForCrystal does it.
  const star = sim.crystals.filter(c => c.mineral === 'aquamarine')
    .sort((a, b) => b.c_length_mm - a.c_length_mm)[0];
  if (!star) return { sigma: null, Be: null };
  const mesh = sim.wall_state.meshFor(sim);
  const cell = mesh.cellOf(star, sim.wall_state);
  if (!cell || !cell.fluid) return { sigma: null, Be: null };
  const saveF = sim.conditions.fluid, saveT = sim.conditions.temperature;
  sim.conditions.fluid = cell.fluid;
  let sigma = null;
  try { sigma = +sim.conditions.supersaturation_aquamarine().toFixed(2); } catch { sigma = -1; }
  sim.conditions.fluid = saveF; sim.conditions.temperature = saveT;
  return { sigma, Be: +cell.fluid.Be.toFixed(1) };
}

function aquaSummary(sim) {
  const detail = sim.crystals.filter(c => c.mineral === 'aquamarine').map(c => {
    const grown = c.zones.filter(z => z.thickness_um > 0).reduce((a, z) => a + z.thickness_um, 0);
    const etched = c.zones.filter(z => z.thickness_um < 0).reduce((a, z) => a + Math.abs(z.thickness_um), 0);
    const zs = c.zones.filter(z => z.thickness_um > 0);
    return {
      id: c.crystal_id, nuc: c.nucleation_step, final_mm: +c.c_length_mm.toFixed(2),
      grown_um: +grown.toFixed(0), etchedPct: +(100 * etched / (grown || 1)).toFixed(1),
      meanZone_um: +(zs.reduce((a, z) => a + z.thickness_um, 0) / (zs.length || 1)).toFixed(1),
    };
  }).sort((a, b) => b.final_mm - a.final_mm);
  const sizes = detail.map(d => d.final_mm);
  return { n: detail.length, star_mm: sizes[0] ?? 0, fry_mm: sizes[sizes.length - 1] ?? 0, detail };
}

function speciesCensus(sim) {
  const by = {};
  for (const c of sim.crystals) by[c.mineral] = (by[c.mineral] || 0) + 1;
  return by;
}

function bigComparators(sim) {
  return sim.crystals
    .filter(c => ['albite', 'quartz'].includes(c.mineral))
    .sort((a, b) => b.c_length_mm - a.c_length_mm).slice(0, 2)
    .map(c => ({ mineral: c.mineral, final_mm: +c.c_length_mm.toFixed(1) }));
}

// One full run. extraBe > 0 is delivered at EVENT_STEP through the real
// event-broadcast mechanism: snapshot bulk, mutate, propagate the delta
// to every ring/cell — byte-equivalent to the scenario event having
// delivered (8 + extraBe) instead of 8.
function run(K, extraBe) {
  setBerylFamilyGrowthK(K);
  try {
    setSeed(42);
    const { conditions, events, defaultSteps } = SCENARIOS[SCEN]();
    const sim = new VugSimulator(conditions, events);
    const dur = defaultSteps ?? 70;
    const sigmaTrace = [];
    for (let s = 1; s <= dur; s++) {
      sim.run_step();
      if (s === EVENT_STEP && extraBe > 0) {
        const snap = sim._snapshotGlobal();
        sim.conditions.fluid.Be = sim.conditions.fluid.Be + extraBe;
        sim._propagateGlobalDelta(snap);
      }
      if ([33, 36, 40, 44, 48, 52, 56].includes(s)) {
        const sc = starCellSigma(sim);
        sigmaTrace.push({ s, cellSigma: sc.sigma, cellBe: sc.Be });
      }
    }
    const aq = aquaSummary(sim);
    return {
      K, extraBe,
      nAquas: aq.n, star_mm: aq.star_mm, fry_mm: aq.fry_mm,
      star_etchPct: aq.detail[0]?.etchedPct ?? null,
      fry_etchPct: aq.detail[aq.detail.length - 1]?.etchedPct ?? null,
      sigmaTrace, census: speciesCensus(sim), big: bigComparators(sim),
      aquaSizes_mm: aq.detail.map(d => d.final_mm),
      nucSteps: aq.detail.map(d => d.nuc),
    };
  } finally {
    setBerylFamilyGrowthK(K_DEFAULT);
  }
}

// ---------- A. BASELINE (as shipped) ----------
{
  const base = run(K_DEFAULT, 0);
  const sizes = base.aquaSizes_mm;
  // Door 1 acceptance, annotated honestly (passive — flags, never exit 1):
  // star ≥ 20 mm · ≥1 aqua ≤ 0.5 mm (the NH fry) · star etch ≤ 5% · 5 aquas.
  console.log(JSON.stringify({
    section: 'A_baseline_as_shipped',
    K_shipped: K_DEFAULT,
    statureCheck: {
      star_ge_20mm: sizes[0] >= 20,
      fry_le_0p5mm: sizes[sizes.length - 1] <= 0.5,
      five_aquas: base.nAquas === 5,
      star_etch_le_5pct: (base.star_etchPct ?? 0) <= 5,
    },
    ...base,
  }, null, 1));
}

// ---------- B. σ-RESPONSE ----------
{
  setSeed(42);
  const { conditions, events } = SCENARIOS[SCEN]();
  const sim = new VugSimulator(conditions, events);
  for (let s = 1; s <= WINDOW.start; s++) sim.run_step();
  const f = sim.conditions.fluid;
  const save = { Be: f.Be, Fe: f.Fe };
  const curve = (name, values, set) => values.map(v => {
    set(v);
    let sigma; try { sigma = +sim.conditions.supersaturation_aquamarine().toFixed(3); } catch { sigma = -1; }
    f.Be = save.Be; f.Fe = save.Fe;
    return { [name]: v, sigma };
  });
  const beCurve = curve('Be', [10, 15, 20, 25, 30, 37.5, 45, 60], v => { f.Be = v; });
  const feCurve = curve('Fe', [8, 12, 15, 18, 21.6, 30], v => { f.Fe = v; });
  f.Be = 100; f.Fe = 30;
  const ceiling = +sim.conditions.supersaturation_aquamarine().toFixed(2);
  f.Be = save.Be; f.Fe = save.Fe;
  console.log(JSON.stringify({
    section: 'B_sigma_response',
    at_step: WINDOW.start, T: +sim.conditions.temperature.toFixed(0),
    beCurve, feCurve, sigmaCeiling: ceiling,
  }, null, 1));
}

// ---------- C. (K × DELIVERY) GRID ----------
// Two regions: the σ-ceiling region (extraBe 22 ≈ the be_f cap) taught
// that RATE saturates at σ ≈ 9; the deep-wallet region (extraBe ≥ 60)
// probes MASS as the ceiling — the star's cell wallet is what a 20 mm
// crystal actually spends (~100 Be units at the engine's 0.025/µm
// debit, pre-timeScale). Deep wallets are Evensen/London/Wallace 1999
// territory (beryl saturation ~250 ppm Be in granitic melts at 650°C).
{
  const grid = [];
  const cases = [
    [2.2, 22], [10, 0], [10, 22], [20, 0], [20, 22], [30, 22],
    [20, 60], [20, 100], [25, 100], [30, 100], [25, 130],
  ];
  for (const [K, extraBe] of cases) grid.push(run(K, extraBe));
  console.log(JSON.stringify({ section: 'C_K_x_delivery_grid', grid }, null, 1));
}
