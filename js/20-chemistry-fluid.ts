// ============================================================
// js/20-chemistry-fluid.ts — FluidChemistry — per-ring solute composition
// ============================================================
// Mirror of vugg/chemistry/fluid.py. _cloneFluid is the per-ring shallow-copy helper used by VugSimulator at init time so per-ring mutation does not leak across rings.
//
// Phase B4 of PROPOSAL-MODULAR-REFACTOR. SCRIPT-mode TS — top-level decls
// stay global so call sites in 99-legacy-bundle.ts keep working.

// Phase C: clone a FluidChemistry instance. Used to seed each ring's
// fluid as an independent copy of the scenario's global fluid so
// later mutation on one ring doesn't leak to others.
function _cloneFluid(src) {
  if (!src) return new FluidChemistry();
  // Pass src as the opts object — every numeric field becomes the
  // matching opts.X ?? default, picking up the source value.
  return new FluidChemistry(src);
}

class FluidChemistry {
  constructor(opts = {}) {
    this.SiO2 = opts.SiO2 ?? 500.0;
    this.Ca = opts.Ca ?? 200.0;
    this.CO3 = opts.CO3 ?? 150.0;
    this.F = opts.F ?? 10.0;
    this.Zn = opts.Zn ?? 0.0;
    this.S = opts.S ?? 0.0;
    this.Fe = opts.Fe ?? 5.0;
    this.Mn = opts.Mn ?? 2.0;
    this.Al = opts.Al ?? 3.0;
    this.Ti = opts.Ti ?? 0.5;
    this.Pb = opts.Pb ?? 0.0;
    this.U = opts.U ?? 0.0;
    this.Cu = opts.Cu ?? 0.0;
    this.Mo = opts.Mo ?? 0.0;
    this.K = opts.K ?? 0.0;      // potassium — feldspar
    this.Na = opts.Na ?? 0.0;     // sodium — albite, perthite
    this.Mg = opts.Mg ?? 0.0;    // magnesium — dolomite, olivine
    this.Ba = opts.Ba ?? 0.0;    // barium — barite
    this.Sr = opts.Sr ?? 0.0;    // strontium — celestine
    this.Cr = opts.Cr ?? 0.0;    // chromium — ruby, uvarovite
    this.P = opts.P ?? 0.0;      // phosphorus — apatite, pyromorphite
    this.As = opts.As ?? 0.0;    // arsenic — realgar, adamite, mimetite
    this.Cl = opts.Cl ?? 0.0;    // chlorine — halite, pyromorphite
    this.V = opts.V ?? 0.0;      // vanadium — vanadinite
    this.W = opts.W ?? 0.0;      // tungsten — scheelite, wolframite
    this.Ag = opts.Ag ?? 0.0;    // silver — native, acanthite
    this.Bi = opts.Bi ?? 0.0;    // bismuth — native, bismuthinite
    this.Sb = opts.Sb ?? 0.0;    // antimony — stibnite
    this.Ni = opts.Ni ?? 0.0;    // nickel — millerite, annabergite
    this.Co = opts.Co ?? 0.0;    // cobalt — cobaltite, erythrite
    this.B = opts.B ?? 0.0;      // boron — tourmaline
    this.Li = opts.Li ?? 0.0;    // lithium — spodumene, kunzite
    this.Be = opts.Be ?? 0.0;    // beryllium — beryl, emerald
    this.Te = opts.Te ?? 0.0;    // tellurium — calaverite
    this.Se = opts.Se ?? 0.0;    // selenium — clausthalite
    this.Ge = opts.Ge ?? 0.0;    // germanium — Tsumeb sphalerite
    this.Au = opts.Au ?? 0.0;    // gold — native gold; Bingham/Bisbee porphyry-Cu-Au
    this.O2 = opts.O2 ?? 0.0;
    this.pH = opts.pH ?? 6.5;
    this.salinity = opts.salinity ?? 5.0;
    // v27 evaporative concentration multiplier (mirror of
    // FluidChemistry.concentration in vugg.py).
    this.concentration = opts.concentration ?? 1.0;
  }

  describe() {
    const parts = [];
    if (this.SiO2 > 300) parts.push(`silica-rich (${this.SiO2.toFixed(0)} ppm SiO₂)`);
    if (this.Ca > 100) parts.push(`Ca²⁺ ${this.Ca.toFixed(0)} ppm`);
    if (this.Fe > 20) parts.push(`Fe-bearing (${this.Fe.toFixed(0)} ppm)`);
    if (this.Mn > 5) parts.push(`Mn-bearing (${this.Mn.toFixed(0)} ppm)`);
    if (this.Zn > 50) parts.push(`Zn-rich (${this.Zn.toFixed(0)} ppm)`);
    if (this.S > 50) parts.push(`sulfur-bearing (${this.S.toFixed(0)} ppm)`);
    if (this.Cu > 20) parts.push(`Cu-bearing (${this.Cu.toFixed(0)} ppm)`);
    if (this.Pb > 10) parts.push(`Pb-bearing (${this.Pb.toFixed(0)} ppm)`);
    if (this.Mo > 10) parts.push(`Mo-bearing (${this.Mo.toFixed(0)} ppm)`);
    if (this.K > 20) parts.push(`K-bearing (${this.K.toFixed(0)} ppm)`);
    if (this.Na > 20) parts.push(`Na-bearing (${this.Na.toFixed(0)} ppm)`);
    if (this.U > 20) parts.push(`U-bearing (${this.U.toFixed(0)} ppm)`);
    if (this.F > 20) parts.push(`fluorine-rich (${this.F.toFixed(0)} ppm)`);
    if (this.O2 > 1.0) parts.push('oxidizing');
    else if (this.O2 < 0.3 && (this.S > 20 || this.Fe > 20)) parts.push('reducing');
    if (this.pH < 5) parts.push(`acidic (pH ${this.pH.toFixed(1)})`);
    else if (this.pH > 8) parts.push(`alkaline (pH ${this.pH.toFixed(1)})`);
    return parts.length ? parts.join(', ') : 'dilute';
  }
}

