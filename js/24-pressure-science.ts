// ============================================================
// js/24-pressure-science.ts — pressure/stress scientific primitives
// ============================================================
// Sources and validity ledger:
// research/arcs/research-pressure-science-2026-08-05.md
//
// The scalar on VugConditions is FLUID pressure in kbar. It is not depth,
// lithostatic pressure, or differential stress. Those variables may correlate
// in a particular geological history but are not interchangeable causes.

const FLUID_PRESSURE_MIN_KBAR = 0.01;
const FLUID_PRESSURE_MAX_KBAR = 4.4;

function clampFluidPressureKbar(value: number): number {
  if (!Number.isFinite(value)) return 1.0;
  return Math.max(FLUID_PRESSURE_MIN_KBAR, Math.min(FLUID_PRESSURE_MAX_KBAR, value));
}

// Hacker et al. (2005) calcite/aragonite reversal fit, transcribed exactly
// from the primary paper. The earlier positive-linear reconstruction was an
// un-reproduced hypothesis, not the published Hacker equation. Returns kbar.
function calciteAragoniteBoundaryKbar(temperatureC: number): number {
  const dT = (temperatureC + 273.15) - 298.0;
  return 10 * (0.299 - 7.4e-4 * dT + 2.4e-6 * dT * dT);
}

function aragoniteIsPressureStable(temperatureC: number, fluidPressureKbar: number): boolean {
  const boundary = calciteAragoniteBoundaryKbar(temperatureC);
  // Hacker et al. report about +/-0.1 GPa (= +/-1 kbar) boundary
  // uncertainty. Only claim the deep aragonite field above that band.
  return fluidPressureKbar >= 3.0 && fluidPressureKbar > boundary + 1.0;
}

type Al2SiO5Polymorph = 'kyanite' | 'andalusite' | 'sillimanite';
type Al2SiO5Assessment = {
  phase: Al2SiO5Polymorph | 'uncertain' | 'unconstrained';
  nominalPhase: Al2SiO5Polymorph | null;
  confiningPressureKbar: number | null;
  uncertaintyKbar: number | null;
  note: string;
};

// Pattison (1992) natural-aureole anchor: 550°C / 4.5 kbar. The And/Sil
// slope uses the reported -16 +/- 3 bar/°C; the uncertainty band below also
// propagates the reported triple-point temperature and pressure bounds.
function al2sio5PhaseAssessment(
  temperatureC: number,
  confiningPressureKbar: number | null | undefined,
): Al2SiO5Assessment {
  const pressure = confiningPressureKbar == null ? NaN : Number(confiningPressureKbar);
  if (!Number.isFinite(temperatureC) || !Number.isFinite(pressure)) {
    return {
      phase: 'unconstrained', nominalPhase: null, confiningPressureKbar: null,
      uncertaintyKbar: null,
      note: 'Rock/confining pressure is not specified; fluid pressure cannot substitute for it.',
    };
  }
  if (temperatureC < 400 || temperatureC > 700) {
    return {
      phase: 'unconstrained', nominalPhase: null, confiningPressureKbar: pressure,
      uncertaintyKbar: null,
      note: 'Outside the 400-700 C validity envelope of this linearized Pattison grid.',
    };
  }

  const kyAndKbar = 4.5 - 0.0129 * (550 - temperatureC);
  if (temperatureC <= 550) {
    const nominalPhase: Al2SiO5Polymorph = pressure >= kyAndKbar ? 'kyanite' : 'andalusite';
    const uncertaintyKbar = Math.hypot(0.5, 0.0129 * 35);
    return {
      phase: Math.abs(pressure - kyAndKbar) <= uncertaintyKbar ? 'uncertain' : nominalPhase,
      nominalPhase, confiningPressureKbar: pressure, uncertaintyKbar,
      note: 'Ky-And line; uncertainty propagates Pattison triple-point T and P bounds.',
    };
  }
  const kySilKbar = 4.5 + 0.0200 * (temperatureC - 550);
  const andSilKbar = 4.5 - 0.0160 * (temperatureC - 550);
  const nominalPhase: Al2SiO5Polymorph = pressure >= kySilKbar
    ? 'kyanite'
    : pressure <= andSilKbar ? 'andalusite' : 'sillimanite';
  const kySilUncertainty = Math.hypot(0.5, 0.0200 * 35);
  const andSilUncertainty = Math.hypot(
    0.5,
    0.0160 * 35,
    0.0030 * Math.abs(temperatureC - 550),
  );
  const nearKySil = Math.abs(pressure - kySilKbar) <= kySilUncertainty;
  const nearAndSil = Math.abs(pressure - andSilKbar) <= andSilUncertainty;
  const uncertaintyKbar = nearAndSil ? andSilUncertainty : nearKySil ? kySilUncertainty : null;
  return {
    phase: nearKySil || nearAndSil ? 'uncertain' : nominalPhase,
    nominalPhase, confiningPressureKbar: pressure, uncertaintyKbar,
    note: nearAndSil
      ? 'And-Sil line; includes the published/packet slope uncertainty.'
      : 'Ky-Sil line; uncertainty propagates Pattison triple-point T and P bounds.',
  };
}

function al2sio5StablePolymorph(
  temperatureC: number,
  confiningPressureKbar: number | null | undefined,
): Al2SiO5Assessment['phase'] {
  return al2sio5PhaseAssessment(temperatureC, confiningPressureKbar).phase;
}

// Hardie (1967) pure-water reversal plus the fluid-pressure Clapeyron
// correction. This is an EQUILIBRIUM observation, not a direct-nucleation
// gate: gypsum can nucleate metastably and anhydrite has a separate ~100°C
// kinetic floor in the sulfate engine.
function gypsumAnhydriteBoundaryC(fluidPressureKbar: number): number {
  return 58 + 14.7 * clampFluidPressureKbar(fluidPressureKbar);
}

// No experimental P–T stability diagram exists for apophyllite. Verified
// skarn/alpine occurrences disprove the old 0.5-kbar hard cutoff. Preserve the
// occurrence-based recommendation as an explicitly soft INFERENCE: no penalty
// through 1.5 kbar, then an exponential rarity weighting that never forbids it.
function apophyllitePressureFactor(fluidPressureKbar: number): number {
  const pressure = clampFluidPressureKbar(fluidPressureKbar);
  return pressure <= 1.5 ? 1 : Math.exp(-0.7 * (pressure - 1.5));
}

const STRESS_TWIN_CRSS_MPA: Record<string, number> = {
  calcite: 10,
  dolomite: 100,
};

function _stressOrientationUnit(seed: number, crystalId: number): number {
  // A grain's orientation is intrinsic to that grain. Sample the unresolved
  // crystallographic orientation from run seed + crystal identity only; the
  // simulation clock must never rotate an existing crystal.
  let x = ((seed >>> 0) ^ Math.imul((crystalId + 1) >>> 0, 0x9e3779b1)) >>> 0;
  x ^= x >>> 16;
  x = Math.imul(x, 0x7feb352d) >>> 0;
  x ^= x >>> 15;
  x = Math.imul(x, 0x846ca68b) >>> 0;
  x ^= x >>> 16;
  return (x >>> 0) / 0x100000000;
}

function _ferrillCalciteTwinType(temperatureC: number): string {
  if (temperatureC < 150) return 'I — thin/straight';
  if (temperatureC < 200) return 'II — lensoid';
  if (temperatureC < 250) return 'III — curved';
  return 'IV — patchy/recrystallized';
}

// A transient differential-stress event. It does not change fluid pressure.
// Resolved shear is Schmid×sigma_diff with Schmid sampled deterministically in
// [0,0.5]. Only minerals with measured CRSS values are mechanically twinned;
// quartz Dauphiné and the other catalogued growth twins are deliberately absent.
function applyDifferentialStressPulse(sim: any, sigmaDiffMpa: number) {
  const sigma = Math.max(0, Number(sigmaDiffMpa) || 0);
  const seed = Number(sim?._nucSharedState ?? sim?.conditions?.wall?.shape_seed ?? 0) >>> 0;
  const step = Number(sim?.step ?? 0);
  const twinned: any[] = [];
  const evaluated: any[] = [];

  for (const crystal of (sim?.crystals || [])) {
    const crss = STRESS_TWIN_CRSS_MPA[crystal.mineral];
    // A zero-size nucleation record has no material in which to form a
    // lamella. One positive growth zone is sufficient; zone COUNT is not a
    // physical eligibility proxy.
    if (!crss || !(Number(crystal.total_growth_um) > 0)) continue;
    const storedUnit = Number(crystal._stress_orientation_unit);
    const unit = Number.isFinite(storedUnit)
      ? Math.max(0, Math.min(1, storedUnit))
      : _stressOrientationUnit(seed, Number(crystal.crystal_id || 0));
    crystal._stress_orientation_unit = unit; // backfill old saves/test fixtures
    const schmid = 0.5 * unit;
    const resolvedShearMpa = schmid * sigma;
    const outcome = crystal._mechanical_twinned
      ? 'already_twinned'
      : resolvedShearMpa >= crss ? 'twinned' : 'below_crss';
    evaluated.push({
      crystal_id: crystal.crystal_id,
      mineral: crystal.mineral,
      schmid_factor: schmid,
      resolved_shear_mpa: resolvedShearMpa,
      crss_mpa: crss,
      outcome,
    });
    if (outcome !== 'twinned') continue;

    // Mechanical twin lamellae are an internal deformation overprint, not a
    // second growth individual. Keep `twinned`/`twin_law` reserved for growth
    // twins whose external geometry is dispatched elsewhere in the renderer.
    // Conflating the two erased valid Wulff forms after a stress pulse.
    crystal._mechanical_twinned = true;
    crystal._mechanical_twin_law = crystal.mineral === 'calcite'
      ? 'mechanical e-twin {01-12}'
      : 'mechanical f-twin';
    crystal._peak_differential_stress_mpa = Math.max(
      Number(crystal._peak_differential_stress_mpa || 0), sigma,
    );
    crystal._resolved_shear_mpa = resolvedShearMpa;
    if (crystal.mineral === 'calcite') {
      // Rybacki et al. (2011) calcite piezometer. Do not silently apply the
      // calibration to dolomite merely because both minerals can twin.
      crystal._twin_density_per_mm = Math.pow(sigma / 19.5, 2);
      crystal._mechanical_twin_type = _ferrillCalciteTwinType(sim.conditions.temperature);
      // Reuse the existing, replay-aware calcite lamella renderer. `amount`
      // is a bounded visual density derived from the cited piezometer; the
      // physical density remains available in _twin_density_per_mm.
      crystal._deformation = {
        kind: 'etwin',
        amount: Math.max(0.15, Math.min(1, crystal._twin_density_per_mm / 25)),
        atStep: step,
        source: 'instantaneous differential-stress pulse',
      };
    }
    twinned.push(crystal);
  }

  sim._stressEvents ||= [];
  sim._stressEvents.push({
    event_id: `stress-${step}-${sim._stressEvents.length + 1}`,
    step,
    sigma_diff_mpa: sigma,
    timescale: 'instantaneous threshold evaluation',
    twinned_crystal_ids: twinned.map(crystal => crystal.crystal_id),
    evaluated_crystals: evaluated,
  });
  return { sigma_diff_mpa: sigma, timescale: 'instantaneous threshold evaluation', twinned };
}
