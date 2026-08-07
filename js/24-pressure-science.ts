// ============================================================
// js/24-pressure-science.ts — pressure/stress scientific primitives
// ============================================================
// Sources and validity ledger:
// research/arcs/research-pressure-science-2026-08-05.md
//
// The scalar on VugConditions is FLUID pressure in kbar. It is not depth,
// lithostatic pressure, or differential stress. Those variables may correlate
// in a particular geological history but are not interchangeable causes.

// One atmosphere is about 0.001013 kbar. Keep the lower bound at 0.001 kbar
// so surface hot-spring and shallow sedimentary scenarios are representable
// without pretending they sit beneath ~100 m of water.
const FLUID_PRESSURE_MIN_KBAR = 0.001;
const FLUID_PRESSURE_MAX_KBAR = 4.4;

function clampFluidPressureKbar(value: number): number {
  if (!Number.isFinite(value)) return 1.0;
  return Math.max(FLUID_PRESSURE_MIN_KBAR, Math.min(FLUID_PRESSURE_MAX_KBAR, value));
}

// Coarse IAPWS water-density grid transcribed from the commissioned pressure
// packet (Wagner & Pruß 2002 values). Bilinear interpolation is deliberately
// limited to the measured 300-450 C, 0.5-4.4 kbar rectangle; callers outside
// that rectangle keep the existing low-temperature calibration rather than
// extrapolating through the near-critical low-density corner.
const QUARTZ_WATER_DENSITY_GRID = {
  temperaturesC: [300, 450],
  pressuresKbar: [0.5, 1.8, 3.1, 4.4],
  densityGcm3: [
    [0.77648, 0.87469, 0.93341, 0.97761],
    [0.40204, 0.72440, 0.81791, 0.87877],
  ],
};

function _linearGridValue(x: number, xs: number[], ys: number[]): number {
  if (x <= xs[0]) return ys[0];
  if (x >= xs[xs.length - 1]) return ys[ys.length - 1];
  for (let i = 0; i < xs.length - 1; i++) {
    if (x < xs[i] || x > xs[i + 1]) continue;
    const f = (x - xs[i]) / (xs[i + 1] - xs[i]);
    return ys[i] + f * (ys[i + 1] - ys[i]);
  }
  return ys[ys.length - 1];
}

function quartzWaterDensityGcm3(temperatureC: number, fluidPressureKbar: number): number | null {
  const t = Number(temperatureC);
  if (!Number.isFinite(t) || t < 300 || t > 450) return null;
  const p = Math.max(0.5, Math.min(4.4, Number(fluidPressureKbar) || 0.5));
  const lowDensity = _linearGridValue(
    p,
    QUARTZ_WATER_DENSITY_GRID.pressuresKbar,
    QUARTZ_WATER_DENSITY_GRID.densityGcm3[0],
  );
  const highDensity = _linearGridValue(
    p,
    QUARTZ_WATER_DENSITY_GRID.pressuresKbar,
    QUARTZ_WATER_DENSITY_GRID.densityGcm3[1],
  );
  const f = (t - 300) / 150;
  return lowDensity + f * (highDensity - lowDensity);
}

function manningQuartzSolubilityPpm(
  temperatureC: number,
  fluidPressureKbar: number,
): number | null {
  const density = quartzWaterDensityGcm3(temperatureC, fluidPressureKbar);
  if (!(density && density > 0)) return null;
  const T = temperatureC + 273.15;
  const a = 4.2620 - 5764.2 / T + 1.7513e6 / (T * T) - 2.2869e8 / (T * T * T);
  const b = 2.8454 - 1006.9 / T + 3.5689e5 / (T * T);
  const molality = Math.pow(10, a + b * Math.log10(density));
  return molality * 60.0843 * 1000;
}

function quartzPressureSolubilityAssessment(temperatureC: number, fluidPressureKbar: number) {
  const pressure = clampFluidPressureKbar(fluidPressureKbar);
  const equilibriumPpm = manningQuartzSolubilityPpm(temperatureC, pressure);
  if (equilibriumPpm == null) {
    return {
      active: false, equilibriumPpm: null, waterDensityGcm3: null,
      referencePpm: null, pressureFactor: 1,
      note: 'Outside the promoted 300-450 C IAPWS density grid; the low-temperature calibrated quartz relation remains authoritative.',
    };
  }
  const waterDensityGcm3 = quartzWaterDensityGcm3(temperatureC, pressure)!;
  const referencePpm = manningQuartzSolubilityPpm(temperatureC, 0.5)!;
  const pressureFactor = equilibriumPpm / referencePpm;
  return {
    active: true, equilibriumPpm, waterDensityGcm3, referencePpm, pressureFactor,
    pressureClampedLow: pressure < 0.5,
    note: `Manning (1994) quartz solubility from bilinearly interpolated IAPWS water density; ${pressureFactor.toFixed(2)}x the 0.5-kbar solubility at this temperature.`,
  };
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

type GypsumAnhydritePhase = 'gypsum' | 'anhydrite' | 'uncertain';
type GypsumAnhydriteBoundaryAssessment = {
  phase: GypsumAnhydritePhase;
  nominalPhase: 'gypsum' | 'anhydrite';
  boundaryC: number;
  uncertaintyC: number;
  waterActivity: WaterActivityAssessment;
  waterActivityStatus: 'pure-water-anchor' | 'measured-interpolation' | 'hardie-extrapolation';
  localSlopeCPerAw: number;
  pressureCorrectionC: number;
  note: string;
};

// Hardie (1967) reversible one-atmosphere points. The pure-water endpoint is
// the paper's 58 +/- 2 C extrapolated reversal; the other three are measured
// a_w/T equilibria. Piecewise interpolation preserves the observations rather
// than fitting an unjustified global polynomial.
const HARDIE_GYPSUM_ANHYDRITE_AW_POINTS: ReadonlyArray<readonly [number, number]> = [
  [0.770, 23],
  [0.845, 39],
  [0.960, 55],
  [1.000, 58],
];

function _hardieBoundaryAtWaterActivity(waterActivityValue: number): {
  boundaryC: number;
  localSlopeCPerAw: number;
  status: GypsumAnhydriteBoundaryAssessment['waterActivityStatus'];
} {
  const aw = Math.max(0.55, Math.min(1, Number(waterActivityValue) || 0));
  let lo = HARDIE_GYPSUM_ANHYDRITE_AW_POINTS[0];
  let hi = HARDIE_GYPSUM_ANHYDRITE_AW_POINTS[1];
  let status: GypsumAnhydriteBoundaryAssessment['waterActivityStatus'] = 'hardie-extrapolation';
  if (aw >= 0.960) {
    lo = HARDIE_GYPSUM_ANHYDRITE_AW_POINTS[2];
    hi = HARDIE_GYPSUM_ANHYDRITE_AW_POINTS[3];
    status = aw >= 0.9995 ? 'pure-water-anchor' : 'measured-interpolation';
  } else if (aw >= 0.845) {
    lo = HARDIE_GYPSUM_ANHYDRITE_AW_POINTS[1];
    hi = HARDIE_GYPSUM_ANHYDRITE_AW_POINTS[2];
    status = 'measured-interpolation';
  } else if (aw >= 0.770) {
    lo = HARDIE_GYPSUM_ANHYDRITE_AW_POINTS[0];
    hi = HARDIE_GYPSUM_ANHYDRITE_AW_POINTS[1];
    status = 'measured-interpolation';
  }
  const localSlopeCPerAw = (hi[1] - lo[1]) / (hi[0] - lo[0]);
  return {
    boundaryC: lo[1] + localSlopeCPerAw * (aw - lo[0]),
    localSlopeCPerAw,
    status,
  };
}

// Authoritative equilibrium selector. This is deliberately not a direct-
// nucleation gate: gypsum can be a primary metastable phase, while primary
// anhydrite has its own conservative ~100 C kinetic floor. Pressure is FLUID
// pressure and contributes the pressure-packet Clapeyron approximation.
function gypsumAnhydritePhaseAssessment(
  fluid: any,
  temperatureC: number,
  fluidPressureKbar: number,
): GypsumAnhydriteBoundaryAssessment {
  const aw = waterActivityAssessment(fluid, temperatureC);
  const hardie = _hardieBoundaryAtWaterActivity(aw.value);
  const pressureCorrectionC = 14.7 * clampFluidPressureKbar(fluidPressureKbar);
  const boundaryC = hardie.boundaryC + pressureCorrectionC;
  const uncertaintyC = Math.hypot(2, Math.abs(hardie.localSlopeCPerAw) * aw.uncertainty);
  const nominalPhase = temperatureC < boundaryC ? 'gypsum' : 'anhydrite';
  const withinUncertainty = Math.abs(temperatureC - boundaryC) <= uncertaintyC;
  const phase: GypsumAnhydritePhase = withinUncertainty ? 'uncertain' : nominalPhase;
  const extrapolation = hardie.status === 'hardie-extrapolation'
    ? ' The Hardie a_w relation is extrapolated below its lowest measured point (0.770).'
    : '';
  return {
    phase,
    nominalPhase,
    boundaryC,
    uncertaintyC,
    waterActivity: aw,
    waterActivityStatus: hardie.status,
    localSlopeCPerAw: hardie.localSlopeCPerAw,
    pressureCorrectionC,
    note: `Hardie (1967) a_w/T reversal with +14.7 C/kbar fluid-pressure correction.${extrapolation} ${aw.note}`,
  };
}

// Backwards-compatible pure-water helper retained for saved reports/tests.
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
