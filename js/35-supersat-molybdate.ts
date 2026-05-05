// ============================================================
// js/35-supersat-molybdate.ts — supersaturation methods for molybdate minerals
// ============================================================
// Mirror of vugg/chemistry/supersat/molybdate.py. Minerals (4): ferrimolybdite, raspite, stolzite, wulfenite.
//
// Methods are attached to VugConditions.prototype after the class is
// defined in 25-chemistry-conditions.ts, so call sites
// (cond.supersaturation_calcite(), etc.) keep working unchanged.
//
// Phase B7 of PROPOSAL-MODULAR-REFACTOR.

Object.assign(VugConditions.prototype, {
  supersaturation_wulfenite() {
  // v17 reconciliation (May 2026): per research-wulfenite.md
  // "T <80°C (supergene), pH 6-9 (near-neutral to slightly alkaline),
  // rare two-parent mineral that only appears when chemistry of two
  // different primary ore bodies converges." Pre-v17 JS T cap at
  // 250°C was way too lenient (250°C is hydrothermal, not supergene);
  // pH window 4-7 was too restrictive on alkaline side. Now matches
  // Python: decay above 80°C, graduated pH penalties at 3.5/9.0.
  // Pb/Mo thresholds (>=10/>=5) preserved — JS canonical here, matches
  // the research's "rare two-parent" framing better than Python's
  // pre-v17 lower thresholds.
  if (this.fluid.Pb < 10 || this.fluid.Mo < 5 || this.fluid.O2 < 0.5) return 0;
  let sigma = (this.fluid.Pb / 40.0) * (this.fluid.Mo / 15.0) * (this.fluid.O2 / 1.0);
  // Decay above 80°C — supergene-only ceiling
  if (this.temperature > 80) {
    sigma *= Math.exp(-0.025 * (this.temperature - 80));
  }
  // Graduated pH penalties (matches research: 6-9 window, soft edges)
  if (this.fluid.pH < 3.5) {
    sigma -= (3.5 - this.fluid.pH) * 0.4;
  } else if (this.fluid.pH > 9.0) {
    sigma -= (this.fluid.pH - 9.0) * 0.3;
  }
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'wulfenite');
  return Math.max(sigma, 0);
},

  supersaturation_ferrimolybdite() {
  if (this.fluid.Mo < 2 || this.fluid.Fe < 3 || this.fluid.O2 < 0.5) return 0;
  // Lower Mo threshold + /10 scaling reflects faster, less-picky growth.
  let sigma = (this.fluid.Mo / 10.0) * (this.fluid.Fe / 20.0) * (this.fluid.O2 / 1.0);
  // Strongly low-temperature — supergene/weathering zone only.
  if (this.temperature > 50) {
    sigma *= Math.exp(-0.02 * (this.temperature - 50));
  }
  // pH window — mild acidic to neutral.
  if (this.fluid.pH > 7) {
    sigma *= Math.max(0.2, 1.0 - 0.2 * (this.fluid.pH - 7));
  } else if (this.fluid.pH < 3) {
    sigma *= Math.max(0.3, 1.0 - 0.25 * (3 - this.fluid.pH));
  }
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'ferrimolybdite');
  return Math.max(sigma, 0);
},

  supersaturation_raspite() {
  if (this.fluid.Pb < 40 || this.fluid.W < 5) return 0;
  if (this.fluid.O2 < 0.5) return 0;
  const pb_f = Math.min(this.fluid.Pb / 80.0, 2.0);
  const w_f  = Math.min(this.fluid.W  / 15.0, 2.5);
  const ox_f = Math.min(this.fluid.O2 / 1.0, 2.0);
  let sigma = pb_f * w_f * ox_f;
  const T = this.temperature;
  let T_factor;
  if (T >= 20 && T <= 40) T_factor = 1.2;
  else if (T < 10) T_factor = 0.4;
  else if (T < 20) T_factor = 0.4 + 0.08 * (T - 10);
  else if (T <= 50) T_factor = Math.max(0.4, 1.2 - 0.040 * (T - 40));
  else T_factor = 0.3;
  sigma *= T_factor;
  if (this.fluid.pH < 4 || this.fluid.pH > 8) sigma *= 0.6;
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'raspite');
  return Math.max(sigma, 0);
},

  supersaturation_stolzite() {
  if (this.fluid.Pb < 40 || this.fluid.W < 5) return 0;
  if (this.fluid.O2 < 0.5) return 0;
  const pb_f = Math.min(this.fluid.Pb / 80.0, 2.5);
  const w_f  = Math.min(this.fluid.W  / 15.0, 2.5);
  const ox_f = Math.min(this.fluid.O2 / 1.0, 2.0);
  let sigma = pb_f * w_f * ox_f;
  const T = this.temperature;
  let T_factor;
  if (T >= 20 && T <= 80) T_factor = 1.2;
  else if (T < 10) T_factor = 0.4;
  else if (T < 20) T_factor = 0.4 + 0.08 * (T - 10);
  else if (T <= 100) T_factor = Math.max(0.4, 1.2 - 0.020 * (T - 80));
  else T_factor = 0.3;
  sigma *= T_factor;
  if (this.fluid.pH < 4 || this.fluid.pH > 8) sigma *= 0.6;
  if (ACTIVITY_CORRECTED_SUPERSAT) sigma *= activityCorrectionFactor(this.fluid, 'stolzite');
  return Math.max(sigma, 0);
},
});
