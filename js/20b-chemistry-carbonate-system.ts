// ============================================================
// js/20b-chemistry-carbonate-system.ts — DIC + Bjerrum speciation
// ============================================================
// PROPOSAL-GEOLOGICAL-ACCURACY Phase 3a: aqueous-side carbonate
// system. Splits the simulator's single `fluid.CO3` field into the
// proper DIC partition (H₂CO₃*, HCO₃⁻, CO₃²⁻) using the Bjerrum
// equations from the carbonate dissociation constants K₁ and K₂.
//
// Couples deliberately with PROPOSAL-VOLATILE-GASES (Rock Bot,
// 2026-05-04, on canonical) — that proposal owns the multi-species
// headspace state vector (volatiles['CO2'] partial pressure +
// gas sources/sinks). This module owns the aqueous-side speciation
// that turns CO₂ partial pressure into actual carbonate-system
// chemistry. When VOLATILE-GASES lands, it consumes
// `equilibriumPCO2(fluid)` from here to set its volatiles['CO2'];
// scenarios with degassing events use `setDICAndPH` to update the
// carbonate state in a Bjerrum-consistent way.
//
// Default state: CARBONATE_SPECIATION_ACTIVE = false. Nothing in
// existing scenarios uses this module yet — Phase 3b will migrate
// the carbonate supersat methods and add a co2_degas event handler.
// Until then, this is callable infrastructure that narrators and
// future scenarios can use.
//
// Conventions:
//   - fluid.CO3 in the simulator carries TOTAL dissolved inorganic
//     carbon (DIC) by convention, in ppm. Pre-Phase-3 supersat
//     methods that read fluid.CO3 are reading DIC, not just CO₃²⁻.
//     This module's bjerrumPartition(fluid) extracts the correct
//     CO₃²⁻ fraction at the current pH for thermodynamic Q
//     calculation (Phase 3b will use it).
//   - DIC is in ppm (as CO3 mass-equivalent). Real DIC measurements
//     usually report mg/L of carbon, not carbonate; the conversion
//     factor is 60 g/mol CO3 vs 12 g/mol C (factor 5). The
//     simulator's per-species ppm convention treats CO3 as the
//     species, so DIC here is in those units.
//   - K₁ and K₂ from Plummer & Busenberg 1982 / Millero 1995. T in
//     °C. Pressure correction for moderate pressures (<1 kbar)
//     is small; ignore for now.

const CARBONATE_SPECIATION_ACTIVE = true;

// Carbonate dissociation constants. pK at temperature, returned as
// -log₁₀(K).
//
// v192 (2026-06-12, review §2.2 calibration debt): the original
// linear fits ("Stumm & Morgan ... departure < 0.05 pK up to 60 °C")
// had slopes ~5–10× too flat — pK₁ −0.0007/°C vs real ≈ −0.009 on the
// cold side, pK₂ −0.0029 vs ≈ −0.009, pKH +0.005 vs ≈ +0.013 — and
// the "<0.05 pK" comment was wrong by ~4× (measured drift 0.23 pK at
// 0 °C; tools/pk-t-observe.mjs --table is the standing receipt).
// Replaced with the FULL Plummer & Busenberg 1982 analytic
// expressions (GCA 46:1011), the exact coefficients PHREEQC ships —
// VERIFIED verbatim against canonical wateq4f.dat
// (usgs-coupled/phreeqc3, fetched 2026-06-12): K1/K2 are the
// negations of the association entries; KH is the CO2(g) phase entry;
// internal consistency logK1+logK2 = −16.680 vs the database's
// combined CO3⁻²+2H⁺ entry 16.681. Anchors at 25 °C are unchanged
// (pK₁ 6.352, pK₂ 10.329, pKH 1.468) — this corrects the SLOPES and
// the curvature (pK₁ minimum near 55 °C, pK₂ near 100 °C, both
// rising steeply into the hydrothermal range).
//
//   log K = A1 + A2·T + A3/T + A4·log₁₀(T) + A5/T²   (T in Kelvin)
//
// Validity clamp [0, 250 °C] (was [0, 80]): PB82/PHREEQC analytic
// range. Above 250 °C the whole aqueous model is out of its depth
// (near-critical water; the sim's pH axis doesn't track the neutral-
// point shift either) — clamping is the honest extrapolation, and the
// >250 °C scenarios (marble, pegmatites) treat carbonates as skarn
// proxies anyway.
function _pb82pK(A1: number, A2: number, A3: number, A4: number, A5: number, T_celsius: number): number {
  const T = Math.max(0, Math.min(250, T_celsius));
  const TK = T + 273.15;
  return -(A1 + A2 * TK + A3 / TK + A4 * Math.log10(TK) + A5 / (TK * TK));
}

function pK1Carbonate(T_celsius: number): number {
  // H₂CO₃* ⇌ H⁺ + HCO₃⁻ (dissociation = −association entry in wateq4f)
  return _pb82pK(-356.3094, -0.06091960, 21834.37, 126.8339, -1684915, T_celsius);
}

function pK2Carbonate(T_celsius: number): number {
  // HCO₃⁻ ⇌ H⁺ + CO₃²⁻
  return _pb82pK(-107.8871, -0.03252849, 5151.79, 38.92561, -563713.9, T_celsius);
}

// Henry's-Law constant for CO₂ at temperature, mol/(kg·atm).
// CO₂ solubility decreases with T (gas escapes from warm fluid).
function pKH_CO2(T_celsius: number): number {
  // CO₂(g) ⇌ H₂CO₃* — wateq4f CO2(g) phase entry, sign flipped to pK
  return _pb82pK(108.3865, 0.01985076, -6919.53, -40.45154, 669365, T_celsius);
}

// Bjerrum partition: given the fluid's total DIC (= fluid.CO3 in ppm)
// and pH, return the mole-fraction split among H₂CO₃*, HCO₃⁻, CO₃²⁻.
// At pH 6: ~95% H₂CO₃*, ~5% HCO₃⁻, <0.1% CO₃²⁻.
// At pH 8: ~3% H₂CO₃*, ~96% HCO₃⁻, ~1% CO₃²⁻.
// At pH 10: <0.1% H₂CO₃*, ~70% HCO₃⁻, ~30% CO₃²⁻.
//
// Used by Phase 3b's carbonate supersat methods to extract the
// thermodynamically correct CO₃²⁻ activity for Q calculation,
// instead of treating fluid.CO3 as the carbonate ion directly.
function bjerrumFractions(pH: number, T_celsius: number): { H2CO3: number; HCO3: number; CO3: number } {
  const H = Math.pow(10, -pH);
  const K1 = Math.pow(10, -pK1Carbonate(T_celsius));
  const K2 = Math.pow(10, -pK2Carbonate(T_celsius));
  // f(H2CO3) : f(HCO3) : f(CO3) = H² : H·K1 : K1·K2
  // Normalize so they sum to 1.
  const f0 = H * H;          // H2CO3*
  const f1 = H * K1;         // HCO3-
  const f2 = K1 * K2;        // CO3^2-
  const total = f0 + f1 + f2;
  return {
    H2CO3: f0 / total,
    HCO3: f1 / total,
    CO3: f2 / total,
  };
}

// Convenience: extract the actual CO₃²⁻ activity (in ppm-equivalent)
// at the fluid's current pH and temperature. The aqueous Q for, say,
// calcite uses this rather than fluid.CO3 directly.
function carbonateIonPpm(fluid: any, T_celsius: number): number {
  if (!fluid || typeof fluid.CO3 !== 'number' || fluid.CO3 <= 0) return 0;
  const pH = typeof fluid.pH === 'number' ? fluid.pH : 7.0;
  const fractions = bjerrumFractions(pH, T_celsius);
  return fluid.CO3 * fractions.CO3;
}

// Reference pH for the Bjerrum normalization. Carbonate eq calibration
// constants in the supersat methods were tuned against fluid.CO3 (= DIC)
// at typical near-neutral pH around 7.5. Keeping the normalization
// anchored here means existing eq values stay valid at pH 7.5; pH
// deviations produce the proper Bjerrum amplification automatically.
const BJERRUM_REFERENCE_PH = 7.5;

// Damping coefficient for the Bjerrum normalization, analogous to
// ACTIVITY_DAMPING in 20a-chemistry-activity.ts. Full Bjerrum at pH 8
// gives a 10× CO₃²⁻ amplification (factor √10 ≈ 3.16 in σ via
// geometric-mean form). That's about 2× stronger than the empirical
// 3^(pH-7.5) factor used pre-Phase-3c — too aggressive against the
// existing per-mineral eq calibration. Damping smoothly interpolates:
//   damped_ratio = 1 + damping × (raw_ratio - 1)
//   damping = 1.0 → full Bjerrum (research mode)
//   damping = 0.5 → half-amplitude (current shipping default)
//   damping = 0.0 → no normalization (= flag off)
// Calibrated in Phase 3c (May 2026) at 0.5 — keeps the sweep-wide
// RMS in the same band as Phase 1c/2c flips while preserving the
// pH-driven cascade in tutorial_travertine and giving the other
// 10 carbonates real pH dependence for the first time.
const BJERRUM_DAMPING = 0.5;

// The carbonate quantity to use in supersaturation calculations.
// When CARBONATE_SPECIATION_ACTIVE is on, returns DIC scaled by the
// pH-dependent CO₃²⁻ fraction relative to the reference pH. The
// normalization is the key trick: at pH = BJERRUM_REFERENCE_PH the
// scale factor is 1.0, so eq calibrations survive the flag flip.
// Above 7.5: ~10× more CO₃²⁻ per pH unit (real Bjerrum amplification).
// Below 7.5: ~10× less per pH unit (acidic suppression).
//
// Returns DIC directly (no scaling) when flag is off — preserves
// pre-Phase-3c behavior for any caller that hasn't migrated yet.
function effectiveCO3(fluid: any, T_celsius: number): number {
  if (!CARBONATE_SPECIATION_ACTIVE) return fluid.CO3;
  if (typeof fluid.CO3 !== 'number' || fluid.CO3 <= 0) return 0;
  const pH = typeof fluid.pH === 'number' ? fluid.pH : 7.0;
  const fAtFluid = bjerrumFractions(pH, T_celsius).CO3;
  const fAtRef = bjerrumFractions(BJERRUM_REFERENCE_PH, T_celsius).CO3;
  if (fAtRef <= 0) return fluid.CO3;
  const rawRatio = fAtFluid / fAtRef;
  // Damped ratio: blends toward 1.0 (= no amplification) per BJERRUM_DAMPING.
  const dampedRatio = 1 + BJERRUM_DAMPING * (rawRatio - 1);
  return fluid.CO3 * Math.max(0.05, dampedRatio);
}

// Compute the equilibrium pCO₂ (bar) consistent with the fluid's
// current DIC and pH. This is the "aqueous-side answer" that
// PROPOSAL-VOLATILE-GASES would set its `volatiles['CO2']` to,
// so the headspace and aqueous side stay in equilibrium. When there
// is no headspace (submerged ring), the pCO₂ is hypothetical — what
// CO₂ would degas if the cavity opened to that ring.
//
// pCO2 = [H2CO3*] / KH_CO2  (Henry's-Law inversion)
function equilibriumPCO2(fluid: any, T_celsius: number): number {
  if (!fluid || typeof fluid.CO3 !== 'number' || fluid.CO3 <= 0) return 0;
  const pH = typeof fluid.pH === 'number' ? fluid.pH : 7.0;
  const fractions = bjerrumFractions(pH, T_celsius);
  // DIC ppm → mol/kg (assume CO3 as ~60 g/mol surrogate)
  const DIC_molal = fluid.CO3 / (1000 * 60.01);
  const H2CO3_molal = DIC_molal * fractions.H2CO3;
  const KH = Math.pow(10, -pKH_CO2(T_celsius));
  return KH > 0 ? H2CO3_molal / KH : 0;
}

// =============================================================
// Conserved carbonate boundary (science contract 2026-08-08)
// =============================================================
//
// These helpers are deliberately pure/serializable. They are the numerical
// kernel for the opt-in boundary controller; scenarios that do not declare a
// carbonate_boundary never call them and retain their legacy trajectory.

const CARBONATE_SURROGATE_G_MOL = 60.01;
const ATM_IN_BAR = 1.01325;
const GAS_R_L_BAR_MOL_K = 0.08314462618;

function dicPpmToMolKg(ppmAsCO3: number): number {
  return Math.max(0, Number(ppmAsCO3) || 0) / (1000 * CARBONATE_SURROGATE_G_MOL);
}

function dicMolKgToPpm(molKg: number): number {
  return Math.max(0, Number(molKg) || 0) * 1000 * CARBONATE_SURROGATE_G_MOL;
}

// Atmospheric-pressure pure-water density (kg/m3), used only inside the
// Marshall-Franck ionization relation. Kell 1975, JCED 20:97-105,
// doi:10.1021/je60064a005. Validity is deliberately clamped to v1's 0-90 C.
function pureWaterDensityKgM3(T_celsius: number): number {
  const t = Math.max(0, Math.min(90, Number(T_celsius) || 0));
  return 1000 * (1 - ((t + 288.9414) * Math.pow(t - 3.9863, 2))
    / (508929.2 * (t + 68.12963)));
}

// Marshall & Franck 1981 (JPCRD 10:295, doi:10.1063/1.555643), T in
// kelvin and density in g/cm3. Returns -log10(Kw). At 25 C ~=13.99 and
// at 90 C ~=12.43. The reduced v1 model treats 10^-pH as molal H+
// activity under an explicitly declared ideal-dilute 1 mol/kg standard-state
// approximation; it does not mix an unlabelled activity with concentration.
function pKwWater(T_celsius: number): number {
  const t = Math.max(0, Math.min(90, Number(T_celsius) || 0));
  const TK = t + 273.15;
  const densityGcm3 = pureWaterDensityKgM3(t) / 1000;
  const logKw = -4.098 - 3245.2 / TK + 2.2362e5 / (TK * TK)
    - 3.984e7 / (TK * TK * TK)
    + (13.957 - 1262.3 / TK + 8.5641e5 / (TK * TK)) * Math.log10(densityGcm3);
  return -logKw;
}

function reducedCarbonateAlkalinityEqKg(
  dicMolKg: number,
  pH: number,
  T_celsius: number,
): number {
  const dic = Math.max(0, Number(dicMolKg) || 0);
  const ph = Number.isFinite(pH) ? Number(pH) : 7;
  const fractions = bjerrumFractions(ph, T_celsius);
  const h = Math.pow(10, -ph);
  const kw = Math.pow(10, -pKwWater(T_celsius));
  const oh = kw / Math.max(h, 1e-30);
  return dic * (fractions.HCO3 + 2 * fractions.CO3) + oh - h;
}

function solvePHForReducedCarbonateAlkalinity(
  dicMolKg: number,
  alkalinityEqKg: number,
  T_celsius: number,
): number {
  const result = solvePHForReducedCarbonateAlkalinityResult(dicMolKg, alkalinityEqKg, T_celsius);
  return result.ok ? result.pH : NaN;
}

function solvePHForReducedCarbonateAlkalinityResult(
  dicMolKg: number,
  alkalinityEqKg: number,
  T_celsius: number,
): any {
  const dic = Math.max(0, Number(dicMolKg) || 0);
  const target = Number(alkalinityEqKg) || 0;
  let lo = 0;
  let hi = 14;
  const at = (ph: number) => reducedCarbonateAlkalinityEqKg(dic, ph, T_celsius) - target;
  const fLo = at(lo);
  const fHi = at(hi);
  if (!Number.isFinite(fLo) || !Number.isFinite(fHi)) {
    return { ok: false, error: 'nonfinite', fLo, fHi };
  }
  if (fLo > 0 || fHi < 0) {
    return { ok: false, error: 'no_bracket', fLo, fHi };
  }
  if (fLo === 0) return { ok: true, pH: lo, residualEqKg: 0 };
  if (fHi === 0) return { ok: true, pH: hi, residualEqKg: 0 };
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) * 0.5;
    if (at(mid) < 0) lo = mid;
    else hi = mid;
  }
  const pH = (lo + hi) * 0.5;
  return { ok: true, pH, residualEqKg: at(pH) };
}

function _co2MolalityAtBar(pCO2Bar: number, T_celsius: number): number {
  const pBar = Math.max(0, Number(pCO2Bar) || 0);
  const k0MolKgAtm = Math.pow(10, -pKH_CO2(T_celsius));
  return k0MolKgAtm * (pBar / ATM_IN_BAR);
}

function _pCO2BarFromDICAndPH(dicMolKg: number, pH: number, T_celsius: number): number {
  const fractions = bjerrumFractions(pH, T_celsius);
  const k0MolKgAtm = Math.pow(10, -pKH_CO2(T_celsius));
  if (!(k0MolKgAtm > 0)) return 0;
  return Math.max(0, dicMolKg) * fractions.H2CO3 / k0MolKgAtm * ATM_IN_BAR;
}

function _headspaceCO2MolKg(
  pCO2Bar: number,
  headspaceLKg: number,
  T_celsius: number,
): number {
  const p = Math.max(0, Number(pCO2Bar) || 0);
  const v = Math.max(0, Number(headspaceLKg) || 0);
  const tk = Math.max(1, Number(T_celsius) + 273.15);
  return p * v / (GAS_R_L_BAR_MOL_K * tk);
}

function solveOpenCarbonateBoundary(
  alkalinityEqKg: number,
  targetPCO2Bar: number,
  T_celsius: number,
  headspaceLKg: number,
): any {
  const target = Math.max(1e-12, Number(targetPCO2Bar) || 0);
  const dissolvedCO2 = _co2MolalityAtBar(target, T_celsius);
  const alk = Number(alkalinityEqKg) || 0;
  const residual = (ph: number) => {
    const alpha0 = Math.max(1e-30, bjerrumFractions(ph, T_celsius).H2CO3);
    const dic = dissolvedCO2 / alpha0;
    return reducedCarbonateAlkalinityEqKg(dic, ph, T_celsius) - alk;
  };
  let lo = 0;
  let hi = 14;
  const fLo = residual(lo);
  const fHi = residual(hi);
  if (!Number.isFinite(fLo) || !Number.isFinite(fHi)) {
    return { ok: false, error: 'nonfinite', fLo, fHi };
  }
  if (fLo > 0 || fHi < 0) return { ok: false, error: 'no_bracket', fLo, fHi };
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) * 0.5;
    if (residual(mid) < 0) lo = mid;
    else hi = mid;
  }
  const pH = (lo + hi) * 0.5;
  const alpha0 = Math.max(1e-30, bjerrumFractions(pH, T_celsius).H2CO3);
  const dicMolKg = dissolvedCO2 / alpha0;
  return {
    ok: true,
    dicMolKg,
    pH,
    pCO2Bar: target,
    headspaceCO2MolKg: _headspaceCO2MolKg(target, headspaceLKg, T_celsius),
    residualEqKg: residual(pH),
  };
}

function solveClosedCarbonateBoundary(
  totalCarbonMolKg: number,
  alkalinityEqKg: number,
  T_celsius: number,
  headspaceLKg: number,
): any {
  const total = Math.max(0, Number(totalCarbonMolKg) || 0);
  const alk = Number(alkalinityEqKg) || 0;
  const evaluate = (dic: number) => {
    const phResult = solvePHForReducedCarbonateAlkalinityResult(dic, alk, T_celsius);
    if (!phResult.ok) return { ok: false, error: phResult.error };
    const pH = phResult.pH;
    const pCO2Bar = _pCO2BarFromDICAndPH(dic, pH, T_celsius);
    const gas = _headspaceCO2MolKg(pCO2Bar, headspaceLKg, T_celsius);
    return { ok: true, dicMolKg: dic, pH, pCO2Bar, headspaceCO2MolKg: gas, residual: dic + gas - total };
  };
  if (total === 0) return evaluate(0);
  let lo = 0;
  let hi = total;
  const eLo = evaluate(lo);
  const eHi = evaluate(hi);
  if (!eLo.ok || !eHi.ok) return { ok: false, error: eLo.error || eHi.error || 'no_bracket' };
  if (eLo.residual > 0 || eHi.residual < 0) {
    return { ok: false, error: 'no_bracket', fLo: eLo.residual, fHi: eHi.residual };
  }
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) * 0.5;
    const evaluated = evaluate(mid);
    if (!evaluated.ok) return { ok: false, error: evaluated.error || 'nonfinite' };
    if (evaluated.residual < 0) lo = mid;
    else hi = mid;
  }
  return evaluate((lo + hi) * 0.5);
}

function carbonateBoundaryUncertainties(
  fluid: any,
  T_celsius: number,
  fluidPressureKbar: number,
  pCO2Bar: number,
): string[] {
  const out: string[] = [];
  const salinity = Math.max(0, Number(fluid?.salinity) || 0);
  if (salinity > 5) out.push('salinity_model_missing');
  if (T_celsius < 0 || T_celsius > 90) out.push('temperature_outside_pb82');
  if (pCO2Bar > 1) out.push('gas_nonideality_missing');
  if (Math.abs(Math.max(0, Number(fluidPressureKbar) || 0) * 1000 - 1.01325) > 1) {
    out.push('fluid_pressure_not_coupled_to_headspace');
  }
  if (['B', 'P', 'SiO2', 'S_sulfide'].some((key) => Math.max(0, Number(fluid?.[key]) || 0) > 0)) {
    out.push('full_alkalinity_systems_omitted');
  }
  return out;
}

function createCarbonateBoundaryState(fluid: any, T_celsius: number, opts: any = {}): any {
  const dicMolKg = dicPpmToMolKg(fluid?.CO3);
  const pH = Number.isFinite(fluid?.pH) ? Number(fluid.pH) : 7;
  const pCO2Bar = _pCO2BarFromDICAndPH(dicMolKg, pH, T_celsius);
  const headspaceLKg = Math.max(0, Number(opts.headspace_L_per_kg_water) || 0);
  return {
    schema: 'carbonate-boundary-v1',
    mode: opts.mode === 'open' ? 'open' : 'closed',
    headspaceLKg,
    targetPCO2Bar: Math.max(1e-12, Number(opts.target_pCO2_bar) || pCO2Bar || 4.2e-4),
    reducedAlkalinityEqKg: Number.isFinite(opts.reduced_alkalinity_eq_per_kg)
      ? Number(opts.reduced_alkalinity_eq_per_kg)
      : reducedCarbonateAlkalinityEqKg(dicMolKg, pH, T_celsius),
    headspaceCO2MolKg: _headspaceCO2MolKg(pCO2Bar, headspaceLKg, T_celsius),
    boundaryImportMolKg: 0,
    boundaryExportMolKg: 0,
    lastDICMolKg: dicMolKg,
    lastBulkDICPpm: dicMolKgToPpm(dicMolKg),
    solidCarbonMolKg: 0,
    initialSystemCarbonMolKg: dicMolKg + _headspaceCO2MolKg(pCO2Bar, headspaceLKg, T_celsius),
    blocked: false,
    transactions: [],
    uncertainties: carbonateBoundaryUncertainties(
      fluid,
      T_celsius,
      Number(opts.fluid_pressure_kbar) || 0,
      pCO2Bar,
    ),
  };
}

function _recordCarbonateBoundaryTransaction(state: any, tx: any): any {
  (state.transactions ||= []).push(tx);
  if (tx.ok !== false) {
    state.lastDICMolKg = tx.after.dicMolKg;
    state.headspaceCO2MolKg = tx.after.headspaceCO2MolKg;
    state.lastBulkDICPpm = dicMolKgToPpm(tx.after.dicMolKg);
  }
  return tx;
}

function equilibrateClosedCarbonateBoundaryState(
  state: any,
  fluid: any,
  T_celsius: number,
  note: string = 'closed equilibration',
): any {
  const beforeDIC = dicPpmToMolKg(fluid?.CO3);
  const beforeGas = Math.max(0, Number(state.headspaceCO2MolKg) || 0);
  const totalBefore = beforeDIC + beforeGas;
  const solved = solveClosedCarbonateBoundary(
    totalBefore,
    state.reducedAlkalinityEqKg,
    T_celsius,
    state.headspaceLKg,
  );
  if (!solved.ok) {
    return _recordCarbonateBoundaryTransaction(state, {
      ok: false, kind: 'failed', attemptedKind: 'closed', note,
      error: solved.error,
      before: { dicMolKg: beforeDIC, headspaceCO2MolKg: beforeGas, totalCarbonMolKg: totalBefore },
      after: { dicMolKg: beforeDIC, headspaceCO2MolKg: beforeGas, totalCarbonMolKg: totalBefore },
    });
  }
  fluid.CO3 = dicMolKgToPpm(solved.dicMolKg);
  fluid.pH = solved.pH;
  const totalAfter = solved.dicMolKg + solved.headspaceCO2MolKg;
  return _recordCarbonateBoundaryTransaction(state, {
    ok: true, kind: 'closed', note,
    before: { dicMolKg: beforeDIC, headspaceCO2MolKg: beforeGas, totalCarbonMolKg: totalBefore },
    after: { ...solved, totalCarbonMolKg: totalAfter },
    carbonErrorMolKg: totalAfter - totalBefore,
    alkalinityChangeEqKg: 0,
  });
}

function equilibrateOpenCarbonateBoundaryState(
  state: any,
  fluid: any,
  T_celsius: number,
  targetPCO2Bar: number,
  note: string = 'open equilibration',
): any {
  const beforeDIC = dicPpmToMolKg(fluid?.CO3);
  const beforeGas = Math.max(0, Number(state.headspaceCO2MolKg) || 0);
  const totalBefore = beforeDIC + beforeGas;
  const solved = solveOpenCarbonateBoundary(
    state.reducedAlkalinityEqKg,
    targetPCO2Bar,
    T_celsius,
    state.headspaceLKg,
  );
  if (!solved.ok) {
    return _recordCarbonateBoundaryTransaction(state, {
      ok: false, kind: 'failed', attemptedKind: 'open', note,
      error: solved.error,
      before: { dicMolKg: beforeDIC, headspaceCO2MolKg: beforeGas, totalCarbonMolKg: totalBefore },
      after: { dicMolKg: beforeDIC, headspaceCO2MolKg: beforeGas, totalCarbonMolKg: totalBefore },
    });
  }
  fluid.CO3 = dicMolKgToPpm(solved.dicMolKg);
  fluid.pH = solved.pH;
  const totalAfter = solved.dicMolKg + solved.headspaceCO2MolKg;
  const delta = totalAfter - totalBefore;
  if (delta >= 0) state.boundaryImportMolKg += delta;
  else state.boundaryExportMolKg -= delta;
  state.targetPCO2Bar = solved.pCO2Bar;
  return _recordCarbonateBoundaryTransaction(state, {
    ok: true, kind: 'open', note,
    before: { dicMolKg: beforeDIC, headspaceCO2MolKg: beforeGas, totalCarbonMolKg: totalBefore },
    after: { ...solved, totalCarbonMolKg: totalAfter },
    boundaryDeltaMolKg: delta,
    alkalinityChangeEqKg: 0,
  });
}

function chargeCarbonateBoundaryState(
  state: any,
  fluid: any,
  T_celsius: number,
  carbonMolKg: number,
  note: string = 'pure CO2 charge',
): any {
  const charge = Math.max(0, Number(carbonMolKg) || 0);
  const beforeDIC = dicPpmToMolKg(fluid?.CO3);
  const beforeGas = Math.max(0, Number(state.headspaceCO2MolKg) || 0);
  const totalBefore = beforeDIC + beforeGas;
  const solved = solveClosedCarbonateBoundary(
    totalBefore + charge,
    state.reducedAlkalinityEqKg,
    T_celsius,
    state.headspaceLKg,
  );
  if (!solved.ok) {
    return _recordCarbonateBoundaryTransaction(state, {
      ok: false, kind: 'failed', attemptedKind: 'charge', note,
      error: solved.error,
      requestedImportMolKg: charge,
      before: { dicMolKg: beforeDIC, headspaceCO2MolKg: beforeGas, totalCarbonMolKg: totalBefore },
      after: { dicMolKg: beforeDIC, headspaceCO2MolKg: beforeGas, totalCarbonMolKg: totalBefore },
    });
  }
  const totalAfter = solved.dicMolKg + solved.headspaceCO2MolKg;
  fluid.CO3 = dicMolKgToPpm(solved.dicMolKg);
  fluid.pH = solved.pH;
  state.headspaceCO2MolKg = solved.headspaceCO2MolKg;
  state.boundaryImportMolKg += charge;
  return _recordCarbonateBoundaryTransaction(state, {
    ok: true, kind: 'charge', note,
    boundaryImportMolKg: charge,
    boundaryExportMolKg: 0,
    before: { dicMolKg: beforeDIC, headspaceCO2MolKg: beforeGas, totalCarbonMolKg: totalBefore },
    after: { ...solved, totalCarbonMolKg: totalAfter },
    carbonErrorMolKg: totalAfter - totalBefore - charge,
    alkalinityChangeEqKg: 0,
  });
}

// Replace a declared fraction of the one-kilogram aqueous control volume with
// authored incoming water. Unlike a pure-CO2 charge, recharge carries both DIC
// and reduced carbonate alkalinity; neither may be inferred from pH alone. The
// outgoing and incoming carbon legs are recorded separately, then the retained
// headspace and mixed water equilibrate as a closed control volume.
function rechargeCarbonateBoundaryState(
  state: any,
  fluid: any,
  T_celsius: number,
  replacementFraction: number,
  incomingDICMolKg: number,
  incomingReducedAlkalinityEqKg: number,
  note: string = 'authored replacement-water recharge',
): any {
  const fraction = Number(replacementFraction);
  const incomingDIC = Number(incomingDICMolKg);
  const incomingAlkalinity = Number(incomingReducedAlkalinityEqKg);
  const beforeDIC = dicPpmToMolKg(fluid?.CO3);
  const beforeGas = Math.max(0, Number(state.headspaceCO2MolKg) || 0);
  const beforeAlkalinity = Number(state.reducedAlkalinityEqKg);
  const totalBefore = beforeDIC + beforeGas;
  const valid = Number.isFinite(fraction) && fraction >= 0 && fraction <= 1
    && Number.isFinite(incomingDIC) && incomingDIC >= 0
    && Number.isFinite(incomingAlkalinity);
  if (!valid) {
    return _recordCarbonateBoundaryTransaction(state, {
      ok: false, kind: 'failed', attemptedKind: 'recharge', note,
      error: 'recharge_requires_fraction_0_to_1_and_explicit_finite_incoming_DIC_and_alkalinity',
      before: { dicMolKg: beforeDIC, headspaceCO2MolKg: beforeGas, totalCarbonMolKg: totalBefore },
      after: { dicMolKg: beforeDIC, headspaceCO2MolKg: beforeGas, totalCarbonMolKg: totalBefore },
    });
  }

  const exportedAqueous = fraction * beforeDIC;
  const importedAqueous = fraction * incomingDIC;
  const mixedDIC = beforeDIC - exportedAqueous + importedAqueous;
  const mixedAlkalinity = (1 - fraction) * beforeAlkalinity + fraction * incomingAlkalinity;
  const solved = solveClosedCarbonateBoundary(
    mixedDIC + beforeGas,
    mixedAlkalinity,
    T_celsius,
    state.headspaceLKg,
  );
  if (!solved.ok) {
    return _recordCarbonateBoundaryTransaction(state, {
      ok: false, kind: 'failed', attemptedKind: 'recharge', note,
      error: solved.error,
      requestedBoundaryImportMolKg: importedAqueous,
      requestedBoundaryExportMolKg: exportedAqueous,
      before: { dicMolKg: beforeDIC, headspaceCO2MolKg: beforeGas, totalCarbonMolKg: totalBefore },
      after: { dicMolKg: beforeDIC, headspaceCO2MolKg: beforeGas, totalCarbonMolKg: totalBefore },
    });
  }

  const totalAfter = solved.dicMolKg + solved.headspaceCO2MolKg;
  fluid.CO3 = dicMolKgToPpm(solved.dicMolKg);
  fluid.pH = solved.pH;
  state.reducedAlkalinityEqKg = mixedAlkalinity;
  state.headspaceCO2MolKg = solved.headspaceCO2MolKg;
  state.boundaryImportMolKg += importedAqueous;
  state.boundaryExportMolKg += exportedAqueous;
  return _recordCarbonateBoundaryTransaction(state, {
    ok: true, kind: 'recharge', note,
    replacementFraction: fraction,
    incomingDICMolKg: incomingDIC,
    incomingReducedAlkalinityEqKg: incomingAlkalinity,
    boundaryImportMolKg: importedAqueous,
    boundaryExportMolKg: exportedAqueous,
    before: { dicMolKg: beforeDIC, headspaceCO2MolKg: beforeGas, totalCarbonMolKg: totalBefore },
    after: { ...solved, totalCarbonMolKg: totalAfter },
    carbonErrorMolKg: totalAfter - totalBefore - importedAqueous + exportedAqueous,
    alkalinityChangeEqKg: mixedAlkalinity - beforeAlkalinity,
  });
}

// Strong-acid/base capacity edit for Creative mode. Carbon is not added by a
// closed titration; an open gas boundary may exchange carbon while it restores
// its authored pCO2. The requested reduced alkalinity is committed only after a
// successful solve, so failed edits leave both inventories and fluid unchanged.
function setCarbonateBoundaryReducedAlkalinityState(
  state: any,
  fluid: any,
  T_celsius: number,
  requestedAlkalinityEqKg: number,
  note: string = 'authored reduced-alkalinity titration',
): any {
  const requested = Number(requestedAlkalinityEqKg);
  const beforeDIC = dicPpmToMolKg(fluid?.CO3);
  const beforeGas = Math.max(0, Number(state.headspaceCO2MolKg) || 0);
  const beforeAlkalinity = Number(state.reducedAlkalinityEqKg);
  const totalBefore = beforeDIC + beforeGas;
  if (!Number.isFinite(requested)) {
    return _recordCarbonateBoundaryTransaction(state, {
      ok: false, kind: 'failed', attemptedKind: 'alkalinity_titration', note,
      error: 'finite_reduced_alkalinity_required',
      before: { dicMolKg: beforeDIC, headspaceCO2MolKg: beforeGas, totalCarbonMolKg: totalBefore },
      after: { dicMolKg: beforeDIC, headspaceCO2MolKg: beforeGas, totalCarbonMolKg: totalBefore },
    });
  }
  const solved = state.mode === 'open'
    ? solveOpenCarbonateBoundary(requested, state.targetPCO2Bar, T_celsius, state.headspaceLKg)
    : solveClosedCarbonateBoundary(totalBefore, requested, T_celsius, state.headspaceLKg);
  if (!solved.ok) {
    return _recordCarbonateBoundaryTransaction(state, {
      ok: false, kind: 'failed', attemptedKind: 'alkalinity_titration', note,
      error: solved.error,
      requestedReducedAlkalinityEqKg: requested,
      before: { dicMolKg: beforeDIC, headspaceCO2MolKg: beforeGas, totalCarbonMolKg: totalBefore },
      after: { dicMolKg: beforeDIC, headspaceCO2MolKg: beforeGas, totalCarbonMolKg: totalBefore },
    });
  }
  const totalAfter = solved.dicMolKg + solved.headspaceCO2MolKg;
  const boundaryDelta = state.mode === 'open' ? totalAfter - totalBefore : 0;
  fluid.CO3 = dicMolKgToPpm(solved.dicMolKg);
  fluid.pH = solved.pH;
  state.reducedAlkalinityEqKg = requested;
  state.headspaceCO2MolKg = solved.headspaceCO2MolKg;
  if (boundaryDelta >= 0) state.boundaryImportMolKg += boundaryDelta;
  else state.boundaryExportMolKg -= boundaryDelta;
  return _recordCarbonateBoundaryTransaction(state, {
    ok: true, kind: 'alkalinity_titration', note,
    requestedReducedAlkalinityEqKg: requested,
    boundaryImportMolKg: Math.max(0, boundaryDelta),
    boundaryExportMolKg: Math.max(0, -boundaryDelta),
    before: { dicMolKg: beforeDIC, headspaceCO2MolKg: beforeGas, totalCarbonMolKg: totalBefore },
    after: { ...solved, totalCarbonMolKg: totalAfter },
    carbonErrorMolKg: totalAfter - totalBefore - boundaryDelta,
    alkalinityChangeEqKg: requested - beforeAlkalinity,
  });
}

function titrateCarbonateBoundaryToPHState(
  state: any,
  fluid: any,
  T_celsius: number,
  targetPH: number,
  note: string = 'authored strong-acid/base pH titration',
): any {
  const pH = Number(targetPH);
  if (!Number.isFinite(pH) || pH < 0 || pH > 14) {
    const beforeDIC = dicPpmToMolKg(fluid?.CO3);
    const beforeGas = Math.max(0, Number(state.headspaceCO2MolKg) || 0);
    return _recordCarbonateBoundaryTransaction(state, {
      ok: false, kind: 'failed', attemptedKind: 'ph_titration', note,
      error: 'target_pH_must_be_between_0_and_14',
      before: { dicMolKg: beforeDIC, headspaceCO2MolKg: beforeGas, totalCarbonMolKg: beforeDIC + beforeGas },
      after: { dicMolKg: beforeDIC, headspaceCO2MolKg: beforeGas, totalCarbonMolKg: beforeDIC + beforeGas },
    });
  }
  let targetDIC: number;
  if (state.mode === 'open') {
    const dissolvedCO2 = _co2MolalityAtBar(state.targetPCO2Bar, T_celsius);
    const alpha0 = Math.max(1e-30, bjerrumFractions(pH, T_celsius).H2CO3);
    targetDIC = dissolvedCO2 / alpha0;
  } else {
    const total = dicPpmToMolKg(fluid?.CO3)
      + Math.max(0, Number(state.headspaceCO2MolKg) || 0);
    const gasPerMolDIC = _headspaceCO2MolKg(
      _pCO2BarFromDICAndPH(1, pH, T_celsius),
      state.headspaceLKg,
      T_celsius,
    );
    targetDIC = total / (1 + gasPerMolDIC);
  }
  const targetAlkalinity = reducedCarbonateAlkalinityEqKg(targetDIC, pH, T_celsius);
  const tx = setCarbonateBoundaryReducedAlkalinityState(
    state, fluid, T_celsius, targetAlkalinity, note,
  );
  if (tx?.ok) {
    tx.kind = 'ph_titration';
    tx.targetPH = pH;
  } else if (tx) {
    tx.attemptedKind = 'ph_titration';
    tx.targetPH = pH;
  }
  return tx;
}

function recordSimpleCaCO3SolidTransferState(
  state: any,
  aqueousCarbonDeltaMolKg: number,
  mineral: string | string[],
  note: string = 'explicit simple CaCO3 transfer',
): any {
  const minerals = (Array.isArray(mineral) ? mineral : [mineral]).map(String);
  if (!minerals.length || minerals.some((phase) => phase !== 'calcite' && phase !== 'aragonite')) {
    const failed = {
      ok: false,
      kind: 'solid_transfer_unresolved',
      note,
      minerals,
      error: 'v1_supports_only_calcite_or_aragonite',
    };
    (state.transactions ||= []).push(failed);
    return failed;
  }
  const deltaAqueous = Number(aqueousCarbonDeltaMolKg) || 0;
  const previous = Math.max(0, Number(state.lastDICMolKg) || 0);
  if (Math.abs(deltaAqueous) <= Math.max(1e-15, Math.abs(previous) * 1e-12)) return null;
  // Valid only for the explicitly named simple CaCO3 phases above. Basic and
  // hydroxycarbonates have different proton/alkalinity stoichiometry and are
  // deliberately rejected rather than silently forced through this rule.
  state.reducedAlkalinityEqKg += 2 * deltaAqueous;
  state.solidCarbonMolKg = Math.max(0,
    (Number(state.solidCarbonMolKg) || 0) - deltaAqueous);
  state.lastDICMolKg = Math.max(0, (Number(state.lastDICMolKg) || 0) + deltaAqueous);
  const tx = {
    ok: true,
    kind: 'solid_transfer',
    note,
    minerals,
    aqueousCarbonDeltaMolKg: deltaAqueous,
    solidCarbonDeltaMolKg: -deltaAqueous,
    alkalinityChangeEqKg: 2 * deltaAqueous,
  };
  (state.transactions ||= []).push(tx);
  return tx;
}

function recordUnresolvedCarbonateTransferState(
  state: any,
  observedDICMolKg: number,
  note: string,
): any | null {
  const observed = Math.max(0, Number(observedDICMolKg) || 0);
  const previous = Math.max(0, Number(state.lastDICMolKg) || 0);
  const delta = observed - previous;
  if (Math.abs(delta) <= Math.max(1e-15, Math.abs(previous) * 1e-12)) return null;
  const tx = {
    ok: false,
    kind: 'solid_transfer_unresolved',
    note,
    observedAqueousCarbonDeltaMolKg: delta,
    error: 'undeclared_DIC_change',
  };
  (state.transactions ||= []).push(tx);
  return tx;
}
