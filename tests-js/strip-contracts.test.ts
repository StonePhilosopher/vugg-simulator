// tests-js/strip-contracts.test.ts — "chemistry contract" tests built on the
// strip-view recorder (helicoid-as-recorder) via tests-js/strip-helpers.ts.
//
// WHAT THESE ARE. Each test records a scenario through the strip recorder and
// asserts on the spatiotemporal chemistry trajectory it captures
// ([step][angle][height][depth][chip]). They PIN OBSERVED per-cell behavior —
// they are regression guards on what the simulator actually does, not
// re-derivations of the underlying science.
//
// DATA SOURCE. The recorder reads mesh.cells (and, at depth>0, the
// CavityVoxelGrid interior slices) — the PER-CELL / per-voxel store, NOT the
// ring-bulk `ring_fluids[equator]` that the bespoke Week 7/8 probes sample.
// The two stores legitimately differ (the bulk view isn't debited by mass
// balance; the mesh cells are). So these tests CORROBORATE the validated
// bulk-probe findings on a second instrument — they do not duplicate them,
// and a divergence between strip and bulk is a real signal, not a bug.
//
// SCENARIO PICK. Anchored on the best-grounded scenarios, best-data-first:
//   - sabkha_dolomitization → Kim et al. 2023 (Science 382:915) cyclic-Ω
//     dolomitization, validated in tests-js/carbonate-week8-* and the
//     calibration sweep.
//   - reactive_wall → PWP (Plummer-Wigley-Parkhurst 1978) kinetics, validated
//     in tests-js/carbonate-week7-reactive-wall.
//   - tutorial_travertine / cooling / mvt → open-system degassing, calcite
//     retrograde solubility, and hot dolomite-favored MVT starts.
//   - searles_lake → Smith 1979 (USGS PP 1043) closed-basin alkaline-saline
//     evaporite. Pins the evaporative `concentration` cycle (the v161
//     rewetting fix: ramp ×3 on drying, reset to 1.0 on the fresh_pulse flood)
//     plus the soda-lake signatures (alkaline pH, dolomite-favored carbonate).
// The all-scenarios sweep is intentionally a separate effort (each scenario's
// contract needs its data re-checked).
//
// THRESHOLDS are conservative lower/upper bounds well clear of the observed
// values (noted inline), so uint8 quantization granularity (~range/254) and
// minor RNG-cadence shifts don't make them flaky.

import { beforeAll, describe, expect, it } from 'vitest';
import { recordScenario, chipSeries, series } from './strip-helpers';

declare const SCENARIOS: any;

describe('strip chemistry contract — sabkha_dolomitization (Kim 2023)', () => {
  let ds: any;
  beforeAll(() => { ds = recordScenario('sabkha_dolomitization'); }, 60000);

  it('f_ord accumulates toward ordered dolomite (corroborates Week 8 ~0.82)', () => {
    if (!ds) return; // scenario not registered → skip
    const f = chipSeries(ds, 'f_ord', { depth: 'wall' });
    // Observed: first ~0.000, last ~0.819. f_ord = 1 - exp(-N/N0) with N
    // (the dol_cycle_count) monotonically non-decreasing → the trail only
    // rises. Week 8's ordered-dolomite threshold is f_ord ≥ 0.7.
    expect(series.first(f)).toBeLessThan(0.05);
    expect(series.last(f)!).toBeGreaterThan(0.7);
    // Strictly an accumulation, not noise.
    expect(series.last(f)! - series.first(f)!).toBeGreaterThan(0.5);
  });

  it('SI_dolomite cycles (the Kim Ω-modulation) at the wall', () => {
    if (!ds) return;
    const si = chipSeries(ds, 'SI_dolomite', { depth: 'wall' });
    // Observed (wall): oscillates ~0.59 ↔ 3.0 (clamped peak), ~12 cycles.
    // Peak rides the supersaturated clamp; multiple up-crossings of a
    // mid-threshold prove the cycling is real (not a single excursion).
    expect(series.peak(si)).toBeGreaterThan(2.5);
    expect(series.crossings(si, 2.0)).toBeGreaterThanOrEqual(3);
  });

  it('wall stays cycling while the deep interior depletes (v160 diffusion signature)', () => {
    if (!ds) return;
    // Observed late-run: wall SI_dolomite ~+3 (still supersaturated), center
    // ~−3 (depleted). This wall→center gradient is what v160 per-voxel
    // diffusion + the strangulation gate produce; nothing else guards it.
    const wall = chipSeries(ds, 'SI_dolomite', { depth: 'wall' });
    const center = chipSeries(ds, 'SI_dolomite', { depth: 'center' });
    const D = ds.manifest.axes.depth_positions || 1;
    if (D < 2) return; // depth-collapsed recording (no voxel grid) → no gradient to test
    expect(series.last(wall)! - series.last(center)!).toBeGreaterThan(2);
  });
});

describe('strip chemistry contract — reactive_wall (PWP acid pulses)', () => {
  let ds: any;
  beforeAll(() => { ds = recordScenario('reactive_wall'); }, 60000);

  it('acid pulses drive pH down and buffering brings it back (per-cell)', () => {
    if (!ds) return;
    const pH = chipSeries(ds, 'pH', { depth: 'wall' });
    // Observed (per-cell wall): pH min ~4.2 at pulses, recovers to ~7.0
    // between them. The per-cell excursions are SHARPER than the ring-bulk
    // Week 7 probe (which only asserted < 6.5) — the wall cells take the
    // full hit. Assert both the dip and the recovery happen.
    expect(series.min(pH)).toBeLessThan(5.5);
    expect(series.peak(pH)).toBeGreaterThan(6.8);
  });

  it('SI_calcite tracks the pulses below saturation (per-cell)', () => {
    if (!ds) return;
    const si = chipSeries(ds, 'SI_calcite', { depth: 'wall' });
    // Observed: starts ~+0.4 (supersaturated), pulses drive it well below 0.
    expect(series.first(si)!).toBeGreaterThan(0);   // starts supersaturated
    expect(series.min(si)).toBeLessThan(0);         // pulses cross into undersaturation
  });
});

describe('strip chemistry contract — tutorial_travertine (CO2 degassing)', () => {
  let ds: any;
  beforeAll(() => { ds = recordScenario('tutorial_travertine'); }, 60000);

  it('CO2 degasses, pH rises, calcite supersaturates (the travertine cascade)', () => {
    if (!ds) return;
    const pCO2 = chipSeries(ds, 'pCO2', { depth: 'wall' });
    const pH = chipSeries(ds, 'pH', { depth: 'wall' });
    const si = chipSeries(ds, 'SI_calcite', { depth: 'wall' });
    const dic = chipSeries(ds, 'DIC', { depth: 'wall' });
    // Observed: pCO2 0.157→0.020 (degassing); pH 6.49→~8.0; SI_calcite ~0→1.32
    // (supersaturation onset); DIC 500→171. Textbook open-system travertine:
    // degassing raises pH → CO3 rises → calcite supersaturates → deposits,
    // drawing DIC down. The coupled cascade, not just one chip.
    expect(series.last(pCO2)!).toBeLessThan(series.first(pCO2)!); // degassing
    expect(series.last(pCO2)!).toBeLessThan(0.05);
    expect(series.peak(pH)).toBeGreaterThan(7.5);                 // pH rises
    expect(series.first(si)!).toBeLessThan(0.3);                  // starts near equilibrium
    expect(series.peak(si)).toBeGreaterThan(1.0);                 // supersaturates
    expect(series.last(dic)!).toBeLessThan(series.first(dic)!);   // DIC drawn down
  });
});

describe('strip chemistry contract — cooling (calcite retrograde solubility)', () => {
  let ds: any;
  beforeAll(() => { ds = recordScenario('cooling'); }, 60000);

  it('calcite does NOT supersaturate on cooling (retrograde solubility)', () => {
    if (!ds) return;
    const T = chipSeries(ds, 'T', { depth: 'wall' });
    const si = chipSeries(ds, 'SI_calcite', { depth: 'wall' });
    // Observed: T 178→112°C; SI_calcite −0.78→−1.35, peak −0.78. Calcite has
    // RETROGRADE solubility (less soluble hot), so COOLING makes it MORE
    // soluble → SI drops, never reaching saturation. A regression that flipped
    // the Ksp(T) sign would show as SI RISING on cooling — this guards it.
    expect(series.last(T)!).toBeLessThan(series.first(T)!);  // it cools
    expect(series.peak(si)).toBeLessThan(0);                 // calcite never reaches saturation
  });
});

describe('strip chemistry contract — mvt (hot carbonate-supersaturated start)', () => {
  let ds: any;
  beforeAll(() => { ds = recordScenario('mvt'); }, 60000);

  it('starts carbonate-supersaturated (dolomite > calcite), SI declines on cooling', () => {
    if (!ds) return;
    const cal = chipSeries(ds, 'SI_calcite', { depth: 'wall' });
    const dol = chipSeries(ds, 'SI_dolomite', { depth: 'wall' });
    // Observed start: SI_calcite +0.99, SI_dolomite +1.75 — dolomite favored at
    // the hot MVT start (early carbonate gangue + dolomitization). Both decline
    // as the fluid cools (retrograde solubility); last SI_calcite ~0.19.
    expect(series.first(cal)!).toBeGreaterThan(0);                  // starts supersaturated
    expect(series.first(dol)!).toBeGreaterThan(series.first(cal)!); // dolomite favored early
    expect(series.last(cal)!).toBeLessThan(series.first(cal)!);     // declines on cooling
  });
});

describe('strip chemistry contract — searles_lake (evaporite concentration cycle)', () => {
  let ds: any;
  beforeAll(() => { ds = recordScenario('searles_lake'); }, 60000);

  it('evaporative concentration CYCLES — ramps on drying, resets on the flood (v161 ratchet fix)', () => {
    if (!ds) return;
    const conc = chipSeries(ds, 'concentration', { depth: 'wall' });
    // Observed (wall): 1.0 → ~3.0 across each dry window (×EVAPORATIVE_
    // CONCENTRATION_FACTOR=3 in 85c _applyVadoseOxidationOverride), then RESET
    // to ~1.0 at each fresh_pulse flood (steps 75/135/195/255). This is the
    // v161 fix: pre-fix the boost was a ONE-WAY RATCHET (1→3→9→clamp@10, never
    // returning) because the override early-returned on rising water. The
    // min<1.5 assertion is the regression guard — the old ratchet pinned min
    // at ≥3 once the first dry cycle fired; only the rewetting reset brings it
    // back to baseline. crossings prove it's a real cycle, not one excursion.
    expect(series.peak(conc)).toBeGreaterThan(2.5);          // the ×3 dry-window boost
    expect(series.min(conc)).toBeLessThan(1.5);              // resets to baseline on the flood (NOT a ratchet)
    expect(series.crossings(conc, 2.0)).toBeGreaterThanOrEqual(2); // multiple dry cycles
  });

  it('the cavity interior never evaporatively concentrates (spatial signature)', () => {
    if (!ds) return;
    const D = ds.manifest.axes.depth_positions || 1;
    if (D < 2) return; // depth-collapsed recording → no wall/interior contrast
    const center = chipSeries(ds, 'concentration', { depth: 'center' });
    // Observed: center stays flat at ~1.0 the entire run. Only wall rings
    // transition wet→vadose (the playa surface dries); the interior voxel
    // store never dries, so the evaporative boost never touches it. The
    // evaporite action is a wall phenomenon.
    expect(series.peak(center)).toBeLessThan(1.5);
  });

  it('soda-lake brine: alkaline pH, dolomite-favored carbonate supersaturation', () => {
    if (!ds) return;
    const pH = chipSeries(ds, 'pH', { depth: 'wall' });
    const cal = chipSeries(ds, 'SI_calcite', { depth: 'wall' });
    const dol = chipSeries(ds, 'SI_dolomite', { depth: 'wall' });
    const arg = chipSeries(ds, 'SI_aragonite', { depth: 'wall' });
    // Observed (wall, first): pH ~9.48 (held alkaline — Searles keeps borate as
    // B(OH)4⁻); SI_dolomite +1.89 > SI_calcite +0.69 > SI_aragonite +0.50. The
    // Mg-bearing alkaline brine favors dolomite over the CaCO3 polymorphs.
    expect(series.min(pH)).toBeGreaterThan(9);                       // stays alkaline
    expect(series.first(dol)!).toBeGreaterThan(series.first(cal)!);  // dolomite favored
    expect(series.first(cal)!).toBeGreaterThan(series.first(arg)!);  // calcite over aragonite
    expect(series.first(arg)!).toBeGreaterThan(0);                   // all carbonate supersaturated
  });

  it('temperature cycles into the summer-bake range', () => {
    if (!ds) return;
    const T = chipSeries(ds, 'T', { depth: 'wall' });
    // Observed (wall ring): baseline ~24°C with spikes to ~53°C on the four
    // summer_bake events (T=55 set globally). Pin the heat excursions + that
    // there are several of them — the seasonal cycling, not a single ramp.
    expect(series.peak(T)).toBeGreaterThan(50);
    expect(series.crossings(T, 40)).toBeGreaterThanOrEqual(2);
  });
});

describe('strip chemistry contract — bisbee (supergene copper paragenesis)', () => {
  let ds: any;
  beforeAll(() => { ds = recordScenario('bisbee'); }, 60000);

  // NOTE ON TEMPERATURE. bisbee's T is deliberately NOT pinned here. The
  // scenario's events stop setting T after the oxidation_zone (step 145, T=25)
  // until final_drying (step 305, T=20), and the unconditional ambient_cooling
  // thermal-pulse mechanic (85d) injects random +30–150°C hydrothermal spikes
  // through that 160-step cold supergene window (observed: T spiking to ~357°C
  // during the azurite/malachite/chrysocolla cascade, which is a ~25°C
  // near-surface process). That T noise is flagged for review, not pinned as a
  // contract. These assertions pin the EVENT-DRIVEN chemistry that drives the
  // paragenesis regardless of the T excursions.

  it('redox evolves from reducing primary ore to oxidizing supergene zone (O2)', () => {
    if (!ds) return;
    const o2 = chipSeries(ds, 'O2', { depth: 'wall' });
    // Observed (wall): O2 0.039 (very reducing — chalcopyrite/bornite stable
    // primary porphyry) → 1.77 peak (oxidizing supergene). The redox story is
    // carried by O2, not Eh (Eh is an un-driven input here, flat at the 200 mV
    // default — the ehFromO2 derivation is flag-gated off).
    expect(series.first(o2)!).toBeLessThan(0.1);   // reducing primary
    expect(series.peak(o2)).toBeGreaterThan(1.0);  // oxidizing supergene
  });

  it('pH crashes acid on pyrite weathering, limestone buffers it back toward neutral', () => {
    if (!ds) return;
    const pH = chipSeries(ds, 'pH', { depth: 'wall' });
    // Observed (wall): sawtooth ~4.6 ↔ 7.0. Sulfuric acid from pyrite
    // oxidation drives pH down; the limestone wall buffers it back up, peaking
    // at the azurite_peak monsoon (pH 7.0). Multiple crossings = the cyclic
    // acid-pulse / buffer-recovery supergene rhythm.
    expect(series.min(pH)).toBeLessThan(5);
    expect(series.peak(pH)).toBeGreaterThan(6.8);
    expect(series.crossings(pH, 6)).toBeGreaterThanOrEqual(2);
  });

  it('DIC spikes at the azurite-peak monsoon (the Bisbee-blue window)', () => {
    if (!ds) return;
    const dic = chipSeries(ds, 'DIC', { depth: 'wall' });
    // Observed (wall): DIC baseline ~35 ppm, spiking to ~177 at azurite_peak
    // (CO3+80 monsoon infiltration) then falling at co2_drop. The high-pCO2
    // window that nucleates azurite — the showpiece "Bisbee Blue".
    expect(series.first(dic)!).toBeLessThan(60);
    expect(series.peak(dic)).toBeGreaterThan(150);
  });

  it('calcite stays undersaturated — the limestone wall is a CO3 SOURCE, not a sink', () => {
    if (!ds) return;
    const si = chipSeries(ds, 'SI_calcite', { depth: 'wall' });
    // Observed (wall): SI_calcite −5 … −0.13, never reaching saturation. The
    // acidic/CO2-charged supergene fluids aggressively DISSOLVE the limestone
    // walls, feeding CO3 to the copper carbonates (azurite/malachite) rather
    // than precipitating calcite. peak < 0 guards that the wall keeps dissolving.
    expect(series.peak(si)).toBeLessThan(0);
  });

  it('evaporative concentration fires only at the terminal drying (no spurious reflood)', () => {
    if (!ds) return;
    const conc = chipSeries(ds, 'concentration', { depth: 'wall' });
    // Observed (wall): flat 1.0 until final_drying (step 305, fluid_surface_ring
    // → 0, every ring vadose) boosts it ×3 to ~3.0; no refill follows, so it
    // holds. bisbee has no rewetting event, which is why the v161 rewetting fix
    // left its baseline byte-identical — this pins that (first ~1.0, peak ~3.0).
    expect(series.first(conc)!).toBeLessThan(1.5);
    expect(series.peak(conc)).toBeGreaterThan(2.5);
  });
});

describe('strip chemistry contract — supergene_oxidation (Tsumeb gossan)', () => {
  let ds: any;
  beforeAll(() => { ds = recordScenario('supergene_oxidation'); }, 60000);

  it('the acid window opens then the limestone buffers pH back toward neutral', () => {
    if (!ds) return;
    const pH = chipSeries(ds, 'pH', { depth: 'wall' });
    // Observed (wall): starts ~6.78; the four supergene_acidification pulses
    // (steps 5/8/12/16) sawtooth pH down to ~4.69 against the carbonate buffer
    // (the acid window where scorodite/jarosite/alunite nucleate); meteoric_flush
    // (step 20) ends it and pH recovers to ~6.5 for the rest of the run.
    expect(series.first(pH)!).toBeGreaterThan(6);   // near-neutral start
    expect(series.min(pH)).toBeLessThan(5);         // acid window
    expect(series.last(pH)!).toBeGreaterThan(6);    // buffered recovery
  });

  it('stays oxidizing throughout — a cold oxygenated gossan (never reducing)', () => {
    if (!ds) return;
    const o2 = chipSeries(ds, 'O2', { depth: 'wall' });
    // Observed (wall): O2 0.59…2.2, never crashing to the reducing regime.
    // Unlike bisbee (which STARTS reducing in the primary porphyry), Tsumeb's
    // 1st-stage gossan is oxidizing from the start.
    expect(series.min(o2)).toBeGreaterThan(0.4);
  });

  it('Pb + Mo pulse delivers the wulfenite ingredients', () => {
    if (!ds) return;
    const pb = chipSeries(ds, 'Pb', { depth: 'wall' });
    const mo = chipSeries(ds, 'Mo', { depth: 'wall' });
    // Observed (wall): Pb 60→100, Mo 15→40 at the pb_mo_pulse event. Wulfenite
    // (PbMoO4) needs both; the pulse is the step that supplies them.
    expect(series.last(pb)!).toBeGreaterThan(series.first(pb)!);
    expect(series.peak(pb)).toBeGreaterThan(90);
    expect(series.last(mo)!).toBeGreaterThan(series.first(mo)!);
    expect(series.peak(mo)).toBeGreaterThan(35);
  });

  it('carbonate availability ramps while calcite stays undersaturated (limestone CO3 source)', () => {
    if (!ds) return;
    const dic = chipSeries(ds, 'DIC', { depth: 'wall' });
    const si = chipSeries(ds, 'SI_calcite', { depth: 'wall' });
    // Observed (wall): DIC 106→212 ppm (rising carbonate for smithsonite/
    // cerussite/malachite); SI_calcite −4.5…−0.5, undersaturated throughout —
    // the dolomite/limestone wall dissolves to FEED the carbonate phases
    // rather than precipitating calcite itself.
    expect(series.last(dic)!).toBeGreaterThan(series.first(dic)!);
    expect(series.peak(si)).toBeLessThan(0);
  });
});

// =============================================================
// v166: sulfate-family contracts — naica / sicily_solfifera / sulphur_bank
// =============================================================
//
// Authored 2026-05-30 from the v165 sulfate SI chips (SI_selenite /
// SI_anhydrite / SI_barite / SI_celestine). Before v164/v165 these
// scenarios were SI-blind on their headline minerals (the strip's
// carbonate-only SI chips correctly read undersaturated, but that
// undersaturation told no story about gypsum/celestine/Hg-sulfide
// nucleation). The new chips make the sulfate paragenesis pinnable.
//
// Each scenario gets its own describe block. Assertions key off the
// per-scenario survey trajectories observed at v165, captured here as
// regression guards — not aspirational pins. Comments record the
// observed numbers so future drift is legible.

describe('strip chemistry contract — naica_geothermal (selenite slow-growth chamber)', () => {
  let ds: any;
  beforeAll(() => { ds = recordScenario('naica_geothermal'); }, 60000);

  it('selenite SI hovers near saturation — the slow-growth window that grows the giant crystals', () => {
    if (!ds) return;
    const si = chipSeries(ds, 'SI_selenite', { depth: 'wall' });
    // Observed (wall): SI_selenite -0.490…-0.079 across 320 steps, ending
    // -0.227. Always slightly undersaturated; never any supersat surge.
    // This is the documented condition (Van Driessche et al. 2011) under
    // which the Cave of Crystals grew gypsum crystals to >11 m: marginal
    // saturation maintained for tens of millennia by isothermal-ish brine.
    // Surge to SI>0 would mean fast nucleation, not giant single crystals.
    expect(series.peak(si)).toBeLessThan(0);          // never supersaturated
    expect(series.peak(si)).toBeGreaterThan(-0.6);    // but ALWAYS close
  });

  it('anhydrite is more undersaturated than gypsum (right phase for T < 55°C)', () => {
    if (!ds) return;
    const gy = chipSeries(ds, 'SI_selenite',  { depth: 'wall' });
    const an = chipSeries(ds, 'SI_anhydrite', { depth: 'wall' });
    // Observed: SI_selenite peak -0.079, SI_anhydrite peak -0.193.
    // Anhydrite is the LESS-soluble phase only above ~55-60°C (Van
    // Driessche 2016). Below the phase boundary, gypsum is more stable
    // (higher SI at the same Ca·SO4 product). The chamber sits 25-55°C
    // (T cycles), squarely in the gypsum field — anhydrite stays the
    // less-saturated phase throughout, which is exactly correct.
    expect(series.peak(an)).toBeLessThan(series.peak(gy));
  });

  it('T cycles in the gypsum stability field (25–55°C) — no excursion past the anhydrite transition', () => {
    if (!ds) return;
    const T = chipSeries(ds, 'T', { depth: 'wall' });
    // Observed (wall): T 25.0…54.7, ending 35.5. The cooling-from-warm-
    // groundwater cycle. Crucially never crosses 60°C (the gypsum →
    // anhydrite phase boundary). If a future edit lets T pulse past 60,
    // SI_anhydrite would suddenly outpace SI_selenite and the wrong
    // phase would be favored — this pin guards that.
    expect(series.peak(T)).toBeLessThan(60);
    expect(series.min(T)).toBeLessThan(30);
  });

  it('Ca pinned + S cycling — naica chemistry is sulfate-driven, not Ca-driven', () => {
    if (!ds) return;
    const ca = chipSeries(ds, 'Ca', { depth: 'wall' });
    const s  = chipSeries(ds, 'S',  { depth: 'wall' });
    // Observed: Ca FLAT at 320 (groundwater equilibrium with the limestone
    // host); S 141…420, cycling with the hot-fluid pulses. So the SI_selenite
    // oscillation tracks S, not Ca — which is the geologically correct
    // mechanism for naica (sulfate brought in by ascending fluid).
    expect(series.peak(ca) - series.min(ca)).toBeLessThan(3);  // Ca pinned (tolerance 3: ΔH correction f67c75d shifts Ca modestly at high T)
    expect(series.peak(s)  - series.min(s)).toBeGreaterThan(100);  // S oscillates
  });
});

describe('strip chemistry contract — sicily_solfifera (celestine + native sulfur)', () => {
  let ds: any;
  beforeAll(() => { ds = recordScenario('sicily_solfifera'); }, 60000);

  it('celestine SI ramps from supersat to strongly supersat (continuous precipitation)', () => {
    if (!ds) return;
    const si = chipSeries(ds, 'SI_celestine', { depth: 'wall' });
    // Observed (wall): SI_celestine 0.459…0.856, MONO↑, ending 0.856. Sr is
    // ramping (30→45) AND S is ramping (400→940) as bacterial sulfate
    // reduction concentrates SO4 alongside the Sr-rich brine. The
    // monotonic SI rise IS the Sicilian solfifera signature — celestine
    // precipitates throughout, faster as the run progresses.
    expect(series.first(si)!).toBeGreaterThan(0.3);     // supersat from the start
    expect(series.peak(si)).toBeGreaterThan(0.7);       // strongly supersat by the end
    expect(series.last(si)!).toBeGreaterThan(series.first(si)!);  // climbing
  });

  it('celestine SI > selenite SI — Sr-sulfate is more saturated than Ca-sulfate despite Ca >> Sr', () => {
    if (!ds) return;
    const cel = chipSeries(ds, 'SI_celestine', { depth: 'wall' });
    const sel = chipSeries(ds, 'SI_selenite',  { depth: 'wall' });
    // Observed: SI_celestine peak 0.856 vs SI_selenite peak 0.572. Even
    // though Ca (600→1200 ppm) vastly outnumbers Sr (30→45), celestine's
    // much smaller Ksp (10^-6.63 vs 10^-4.58) keeps it more supersat at
    // the relevant concentrations. The Sicilian assemblage IS celestine
    // + sulfur (NOT gypsum-dominant), and this SI ordering confirms it.
    expect(series.peak(cel)).toBeGreaterThan(series.peak(sel));
  });

  it('Sr ramps with the brine event (the celestine cation pulse)', () => {
    if (!ds) return;
    const sr = chipSeries(ds, 'Sr', { depth: 'wall' });
    // Observed: Sr 30→45 over the run, MONO↑. The Sr step up at ~step 17
    // is the brine event that delivers the celestine ingredient.
    expect(series.first(sr)!).toBeLessThan(35);
    expect(series.peak(sr)).toBeGreaterThan(40);
  });

  it('DIC ramps too — sulfur deposits cohabit with carbonates in the Solfifera series', () => {
    if (!ds) return;
    const dic = chipSeries(ds, 'DIC', { depth: 'wall' });
    // Observed: DIC 80→200, MONO↑. The Solfifera series is sulfur within
    // a sedimentary carbonate sequence; both systems are active. Pinning
    // the DIC ramp guards the carbonate-cohabitation signature.
    expect(series.first(dic)!).toBeLessThan(100);
    expect(series.peak(dic)).toBeGreaterThan(180);
  });
});

describe('strip chemistry contract — sulphur_bank (acid sulfur springs, NOT a sulfate-precipitating system)', () => {
  let ds: any;
  beforeAll(() => { ds = recordScenario('sulphur_bank'); }, 60000);

  it('pH crashes sharply acidic (sulfuric-acid spring) and sawtooth-recovers', () => {
    if (!ds) return;
    const pH = chipSeries(ds, 'pH', { depth: 'wall' });
    // Observed (wall): pH 1.53…6.53 (HUGE range). Acid pulses from H2SO4
    // crash pH to <2 (the diagnostic sulfur-spring acid window); carbonate
    // host + ongoing buffering carry pH back up. The pH min < 2 IS the
    // sulphur_bank signature.
    expect(series.min(pH)).toBeLessThan(2.5);
    expect(series.peak(pH)).toBeGreaterThan(5.7);  // was 6; ΔH correction f67c75d shifts pH recovery modestly
    expect(series.crossings(pH, 4)).toBeGreaterThanOrEqual(2);
  });

  it('T is warm-spring (peaks > 70°C) but never magmatic-hydrothermal', () => {
    if (!ds) return;
    const T = chipSeries(ds, 'T', { depth: 'wall' });
    // Observed: T 25.0…74.96. Sulphur Bank is a hot-spring mercury deposit
    // (Clear Lake, CA); the warm-fluid pulses ARE the system (NOT spurious
    // thermal-pulse contamination — the handoff confirmed pulses here are
    // load-bearing for the native_sulfur + orpiment calibration).
    expect(series.peak(T)).toBeGreaterThan(60);
    expect(series.peak(T)).toBeLessThan(100);
  });

  it('selenite SI stays UNDERSATURATED — this is NOT a sulfate-forming system', () => {
    if (!ds) return;
    const si = chipSeries(ds, 'SI_selenite', { depth: 'wall' });
    // Observed: SI_selenite -0.645…-0.514. Always undersat. Sulphur_bank
    // produces native S + cinnabar + marcasite — not gypsum. The new SI
    // chip CORRECTLY tells us that despite high S (400-669 ppm), Ca is
    // too low (80 ppm, depleting) for gypsum to nucleate. This is the
    // instrument doing its job: it speaks AGAINST the wrong story too,
    // not just for the right one.
    expect(series.peak(si)).toBeLessThan(0);
  });

  it('Hg present + depleting (cinnabar consumption, the headline mineral)', () => {
    if (!ds) return;
    const hg = chipSeries(ds, 'Hg', { depth: 'wall' });
    // Observed: Hg MONO↓ 15→~10 (slowly depleting into cinnabar HgS).
    // The first→last drop is small (no aggressive pulse) — Hg is a
    // pre-loaded broth ingredient consumed gradually as cinnabar
    // nucleates. Pinning that the wall sees finite Hg + a net decline.
    expect(series.first(hg)!).toBeGreaterThan(10);
    expect(series.last(hg)!).toBeLessThan(series.first(hg)!);
  });
});
