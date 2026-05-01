#!/usr/bin/env node
// ============================================================
// VUGG SIMULATOR — Agent API
// A headless JSON CLI for AI agents to play the crystal growth game.
//
// Built by 🪨✍️ (StonePhilosopher) with Professor
// Protocol: one JSON object per line on stdin, one JSON object per line on stdout.
//
// Commands:
//   {"cmd":"start", "preset":"clean", "temperature":300, "pressure":1.5, "seed":42}
//   {"cmd":"action", "type":"wait"|"heat"|"cool"|"silica"|"metals"|"brine"|"fluorine"|"copper"|"oxidize"|"tectonic"|"flood"|"acidify"|"alkalinize"}
//   {"cmd":"status"}
//   {"cmd":"finish"}
//
// Only "wait" advances time. All other actions modify conditions without stepping.
// Play 200 steps. See your records at the end. Write about what you see.
// ============================================================

// ============================================================
// Role in the project (read this before refactoring)
// ============================================================
// This is the THIRD runtime of the simulation engine, after vugg.py
// (dev/test harness) and index.html (shipped product). It is
// **intentionally kept simpler** than the other two — fewer features,
// less coupling — because its job is "minimum viable headless sim for
// an AI agent to play 200 steps and write about what it saw."
//
// What that means in practice:
//   - Some grow_*() implementations here are simplifications of their
//     vugg.py / index.html counterparts.
//   - Some mechanics (paramorph transitions, water-solubility
//     metastability, etc.) may not be wired up here even after they
//     ship in the other two runtimes. That is a deliberate lag, not
//     drift.
//   - tools/sync-spec.js will flag this lag in `runtimes_present`
//     arrays; entries that legitimately don't claim agent-api are
//     documenting an intentional gap, not a bug.
//
// When does this file change?
//   - Always: load mineral data from ../data/minerals.json (below).
//   - On the data/-as-truth migration (proposals/
//     TASK-BRIEF-DATA-AS-TRUTH.md): this file should consume new
//     declarative tables (scenarios.json, paramorph_transitions.json,
//     etc.) the same way the other runtimes do. The intent is to keep
//     the lag deliberate and visible, not to accumulate accidental
//     drift.
// ============================================================

// ============================================================
// MINERAL SPEC — single source of truth from ../data/minerals.json
// ============================================================
// Declares every template field per mineral. Runtime reads max_size_cm
// to enforce the 2× world-record cap — the fix for the 321,248% bug.
const MINERAL_SPEC = require('../data/minerals.json').minerals;

function maxSizeCm(mineral) {
  const entry = MINERAL_SPEC[mineral];
  return entry ? entry.max_size_cm : null;
}

// ============================================================
// SEEDED PRNG (Mulberry32)
// ============================================================
class SeededRandom {
  constructor(seed) {
    this.state = seed >>> 0;
  }
  next() {
    let t = (this.state += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  uniform(lo, hi) {
    return lo + this.next() * (hi - lo);
  }
  random() {
    return this.next();
  }
}

let rng = new SeededRandom(Date.now());

// ============================================================
// PHYSICAL CONSTANTS AND MODELS
// ============================================================

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
    // Phase-3 additions: fields needed by adamite / mimetite / feldspar /
    // albite / selenite engines. Default 0 so existing scenarios unchanged.
    this.K = opts.K ?? 0.0;
    this.Na = opts.Na ?? 0.0;
    this.As = opts.As ?? 0.0;
    this.Cl = opts.Cl ?? 0.0;
    this.Cr = opts.Cr ?? 0.0;
    this.V = opts.V ?? 0.0;
    this.Ag = opts.Ag ?? 0.0;
    this.Mg = opts.Mg ?? 0.0;
    this.O2 = opts.O2 ?? 0.0;
    this.pH = opts.pH ?? 6.5;
    this.salinity = opts.salinity ?? 5.0;
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
    if (this.U > 20) parts.push(`U-bearing (${this.U.toFixed(0)} ppm)`);
    if (this.F > 20) parts.push(`fluorine-rich (${this.F.toFixed(0)} ppm)`);
    if (this.O2 > 1.0) parts.push('oxidizing');
    else if (this.O2 < 0.3 && (this.S > 20 || this.Fe > 20)) parts.push('reducing');
    if (this.pH < 5) parts.push(`acidic (pH ${this.pH.toFixed(1)})`);
    else if (this.pH > 8) parts.push(`alkaline (pH ${this.pH.toFixed(1)})`);
    return parts.length ? parts.join(', ') : 'dilute';
  }
}

class VugWall {
  constructor(opts = {}) {
    this.composition = opts.composition ?? 'limestone';
    this.thickness_mm = opts.thickness_mm ?? 500.0;
    this.vug_diameter_mm = opts.vug_diameter_mm ?? 50.0;
    this.total_dissolved_mm = opts.total_dissolved_mm ?? 0.0;
    this.wall_Fe_ppm = opts.wall_Fe_ppm ?? 2000.0;
    this.wall_Mn_ppm = opts.wall_Mn_ppm ?? 500.0;
    this.wall_Mg_ppm = opts.wall_Mg_ppm ?? 1000.0;
    this.ca_from_wall_total = opts.ca_from_wall_total ?? 0.0;
  }

  dissolve(acid_strength, fluid) {
    if (acid_strength <= 0) return { dissolved: false };

    let rate_mm = Math.min(acid_strength * 0.5, 2.0);
    if (this.thickness_mm < rate_mm) rate_mm = this.thickness_mm;

    this.thickness_mm -= rate_mm;
    this.total_dissolved_mm += rate_mm;
    this.vug_diameter_mm += rate_mm * 2;

    const ca_released = rate_mm * 15.0;
    const co3_released = rate_mm * 12.0;
    const fe_released = rate_mm * (this.wall_Fe_ppm / 1000.0) * 0.5;
    const mn_released = rate_mm * (this.wall_Mn_ppm / 1000.0) * 0.5;
    const ph_recovery = rate_mm * 0.8;

    const ph_before = fluid.pH;
    fluid.Ca += ca_released;
    fluid.CO3 += co3_released;
    fluid.Fe += fe_released;
    fluid.Mn += mn_released;
    fluid.pH += ph_recovery;
    fluid.pH = Math.min(fluid.pH, 8.5);

    this.ca_from_wall_total += ca_released;

    return {
      dissolved: true,
      rate_mm,
      ca_released,
      co3_released,
      fe_released,
      mn_released,
      ph_before,
      ph_after: fluid.pH,
      vug_diameter: this.vug_diameter_mm,
      total_dissolved: this.total_dissolved_mm,
    };
  }
}

class VugConditions {
  constructor(opts = {}) {
    this.temperature = opts.temperature ?? 350.0;
    this.pressure = opts.pressure ?? 1.5;
    this.fluid = opts.fluid || new FluidChemistry();
    this.flow_rate = opts.flow_rate ?? 1.0;
    this.wall = opts.wall || new VugWall();
  }

  // Mo flux effect: Mo > 20 ppm = minerals nucleate as if temp 15% higher
  get effectiveTemperature() {
    if (this.fluid.Mo > 20) {
      const boost = 1.0 + 0.15 * Math.min((this.fluid.Mo - 20) / 40, 1.0);
      return this.temperature * boost;
    }
    return this.temperature;
  }

  // SiO₂ solubility lookup (ppm) — Fournier & Potter 1982 / Rimstidt 1997
  static _SiO2_SOLUBILITY = [
    [25,6],[50,15],[75,30],[100,60],[125,90],[150,130],[175,200],
    [200,300],[225,390],[250,500],[275,600],[300,700],[325,850],
    [350,1000],[375,1100],[400,1200],[450,1400],[500,1500],[600,1600]
  ];

  silica_equilibrium(T) {
    const table = VugConditions._SiO2_SOLUBILITY;
    if (T <= table[0][0]) return table[0][1];
    if (T >= table[table.length-1][0]) return table[table.length-1][1];
    for (let i = 0; i < table.length - 1; i++) {
      if (T >= table[i][0] && T <= table[i+1][0]) {
        const frac = (T - table[i][0]) / (table[i+1][0] - table[i][0]);
        return table[i][1] + frac * (table[i+1][1] - table[i][1]);
      }
    }
    return table[table.length-1][1];
  }

  silica_polymorph() {
    const T = this.temperature;
    if (T < 100) return 'opal';
    if (T < 200) return 'chalcedony';
    if (T < 573) return 'alpha-quartz';
    if (T < 870) return 'beta-quartz';
    return 'tridymite';
  }

  supersaturation_quartz() {
    const eq = this.silica_equilibrium(this.effectiveTemperature);
    if (eq <= 0) return 0;
    let sigma = this.fluid.SiO2 / eq;
    if (this.fluid.pH < 4.0 && this.fluid.F > 20) {
      const hf_attack = (4.0 - this.fluid.pH) * (this.fluid.F / 50.0) * 0.3;
      sigma -= hf_attack;
    }
    return Math.max(sigma, 0);
  }

  supersaturation_calcite() {
    if (this.temperature > 500) return 0; // thermal decomposition
    const eq = 300.0 * Math.exp(-0.005 * this.temperature);
    if (eq <= 0) return 0;
    const ca_co3 = Math.min(this.fluid.Ca, this.fluid.CO3);
    let sigma = ca_co3 / eq;
    if (this.fluid.pH < 5.5) {
      const acid_attack = (5.5 - this.fluid.pH) * 0.5;
      sigma -= acid_attack;
    } else if (this.fluid.pH > 7.5) {
      sigma *= 1.0 + (this.fluid.pH - 7.5) * 0.15;
    }
    return Math.max(sigma, 0);
  }

  supersaturation_fluorite() {
    if (this.fluid.Ca < 10 || this.fluid.F < 5) return 0;
    let product = (this.fluid.Ca / 200.0) * (this.fluid.F / 20.0);
    let T_factor = 1.0;
    if (this.temperature < 50) T_factor = this.temperature / 50.0;
    else if (this.temperature < 100) T_factor = 0.8;
    else if (this.temperature <= 250) T_factor = 1.2;
    else if (this.temperature <= 350) T_factor = 1.0;
    else T_factor = Math.max(0.1, 1.0 - (this.temperature - 350) / 200);
    let sigma = product * T_factor;
    if (this.fluid.pH < 5.0) {
      const acid_attack = (5.0 - this.fluid.pH) * 0.4;
      sigma -= acid_attack;
    }
    return Math.max(sigma, 0);
  }

  supersaturation_sphalerite() {
    if (this.fluid.Zn < 10 || this.fluid.S < 10) return 0;
    const product = (this.fluid.Zn / 100.0) * (this.fluid.S / 100.0);
    return product * 2.0 * Math.exp(-0.004 * this.temperature);
  }

  supersaturation_pyrite() {
    if (this.fluid.Fe < 5 || this.fluid.S < 10) return 0;
    if (this.fluid.O2 > 1.5) return 0;
    const product = (this.fluid.Fe / 50.0) * (this.fluid.S / 80.0);
    const eT = this.effectiveTemperature;
    const T_factor = (100 < eT && eT < 400) ? 1.0 : 0.5;
    return product * T_factor * (1.5 - this.fluid.O2);
  }

  supersaturation_chalcopyrite() {
    if (this.fluid.Cu < 10 || this.fluid.Fe < 5 || this.fluid.S < 15) return 0;
    if (this.fluid.O2 > 1.5) return 0;
    const product = (this.fluid.Cu / 80.0) * (this.fluid.Fe / 50.0) * (this.fluid.S / 80.0);
    const eT = this.effectiveTemperature;
    // Porphyry window 300-500°C (Seo et al. 2012), viable 200-300°C, rare below 180°C
    let T_factor;
    if (eT < 180) T_factor = 0.2;
    else if (eT < 300) T_factor = 0.8;
    else if (eT <= 500) T_factor = 1.3;
    else T_factor = 0.5;
    return product * T_factor * (1.5 - this.fluid.O2);
  }

  supersaturation_hematite() {
    if (this.fluid.Fe < 20 || this.fluid.O2 < 0.5) return 0;
    let sigma = (this.fluid.Fe / 100.0) * (this.fluid.O2 / 1.0) * Math.exp(-0.002 * this.temperature);
    if (this.fluid.pH < 3.5) {
      sigma -= (3.5 - this.fluid.pH) * 0.3;
    }
    return Math.max(sigma, 0);
  }

  supersaturation_malachite() {
    if (this.fluid.Cu < 5 || this.fluid.CO3 < 20 || this.fluid.O2 < 0.3) return 0;
    let sigma = (this.fluid.Cu / 50.0) * (this.fluid.CO3 / 200.0) * (this.fluid.O2 / 1.0);
    if (this.temperature > 50) {
      sigma *= Math.exp(-0.005 * (this.temperature - 50));
    }
    if (this.fluid.pH < 4.5) {
      sigma -= (4.5 - this.fluid.pH) * 0.5;
    }
    return Math.max(sigma, 0);
  }

  supersaturation_uraninite() {
    // Reconciled to Python canonical (v12, May 2026). Pre-v12 had a T-only
    // formula with no O2 gate. Now: needs reducing + U + slight high-T pref.
    if (this.fluid.U < 5 || this.fluid.O2 > 0.3) return 0;
    let sigma = (this.fluid.U / 20.0) * (0.5 - this.fluid.O2);
    if (this.temperature > 200) sigma *= 1.3;
    return Math.max(sigma, 0);
  }

  supersaturation_galena() {
    if (this.fluid.Pb < 10 || this.fluid.S < 10) return 0;
    let sigma = (this.fluid.Pb / 80.0) * (this.fluid.S / 100.0);
    const eT = this.effectiveTemperature;
    if (eT >= 200 && eT <= 400) {
      sigma *= 1.3;
    } else if (eT > 500) {
      sigma *= 0.5;
    }
    return sigma;
  }

  supersaturation_smithsonite() {
    if (this.fluid.Zn < 20 || this.fluid.CO3 < 50 || this.fluid.O2 < 0.2) return 0;
    if (this.temperature > 200) return 0;
    if (this.fluid.pH < 5) return 0;
    let sigma = (this.fluid.Zn / 80.0) * (this.fluid.CO3 / 200.0) * (this.fluid.O2 / 1.0);
    if (this.temperature > 100) {
      sigma *= Math.exp(-0.008 * (this.temperature - 100));
    }
    if (this.fluid.pH > 7) sigma *= 1.2;
    return Math.max(sigma, 0);
  }

  supersaturation_wulfenite() {
    if (this.fluid.Pb < 10 || this.fluid.Mo < 5 || this.fluid.O2 < 0.2) return 0;
    if (this.temperature > 250) return 0;
    if (this.fluid.pH < 4 || this.fluid.pH > 7) return 0;
    let sigma = (this.fluid.Pb / 60.0) * (this.fluid.Mo / 30.0) * (this.fluid.O2 / 1.0);
    if (this.temperature > 150) {
      sigma *= Math.exp(-0.006 * (this.temperature - 150));
    }
    return Math.max(sigma, 0);
  }

  // Goethite (FeO(OH)) — the ghost mineral, now real across all runtimes.
  supersaturation_goethite() {
    if (this.fluid.Fe < 15 || this.fluid.O2 < 0.4) return 0;
    let sigma = (this.fluid.Fe / 60.0) * (this.fluid.O2 / 1.0);
    if (this.temperature > 150) sigma *= Math.exp(-0.015 * (this.temperature - 150));
    if (this.fluid.pH < 3.0) sigma -= (3.0 - this.fluid.pH) * 0.5;
    return Math.max(sigma, 0);
  }

  // Molybdenite (MoS₂) — porphyry sulfide, Mo source for wulfenite paragenesis.
  supersaturation_molybdenite() {
    if ((this.fluid.Mo || 0) < 3 || this.fluid.S < 10) return 0;
    if (this.fluid.O2 > 1.2) return 0;
    let sigma = (this.fluid.Mo / 15.0) * (this.fluid.S / 60.0) * (1.5 - this.fluid.O2);
    if (this.temperature < 150) sigma *= Math.exp(-0.01 * (150 - this.temperature));
    else if (this.temperature > 300 && this.temperature < 500) sigma *= 1.3;
    return Math.max(sigma, 0);
  }

  // Feldspar (KAlSi₃O₈) — the polymorph clock. High-T igneous/pegmatite.
  supersaturation_feldspar() {
    if ((this.fluid.K || 0) < 10 || (this.fluid.Al || 0) < 3 || this.fluid.SiO2 < 200) return 0;
    let sigma = (this.fluid.K / 40.0) * (this.fluid.Al / 10.0) * (this.fluid.SiO2 / 400.0);
    if (this.temperature < 300) sigma *= Math.exp(-0.01 * (300 - this.temperature));
    return Math.max(sigma, 0);
  }

  // Albite (NaAlSi₃O₈) — Na plagioclase, pegmatite cleavelandite.
  supersaturation_albite() {
    if ((this.fluid.Na || 0) < 10 || (this.fluid.Al || 0) < 3 || this.fluid.SiO2 < 200) return 0;
    let sigma = (this.fluid.Na / 35.0) * (this.fluid.Al / 10.0) * (this.fluid.SiO2 / 400.0);
    if (this.temperature < 300) sigma *= Math.exp(-0.01 * (300 - this.temperature));
    return Math.max(sigma, 0);
  }

  // Selenite (CaSO₄·2H₂O) — low-T evaporite, Naica's giant crystals.
  supersaturation_selenite() {
    if (this.fluid.Ca < 20 || this.fluid.S < 15 || this.fluid.O2 < 0.2) return 0;
    let sigma = (this.fluid.Ca / 60.0) * (this.fluid.S / 50.0) * (this.fluid.O2 / 0.5);
    if (this.temperature > 60) sigma *= Math.exp(-0.06 * (this.temperature - 60));
    if (this.fluid.pH < 5.0) sigma -= (5.0 - this.fluid.pH) * 0.2;
    return Math.max(sigma, 0);
  }

  // Adamite (Zn₂(AsO₄)(OH)) — supergene arsenate, cuproadamite fluoresces green.
  supersaturation_adamite() {
    if (this.fluid.Zn < 10 || (this.fluid.As || 0) < 5 || this.fluid.O2 < 0.3) return 0;
    let sigma = (this.fluid.Zn / 50.0) * (this.fluid.As / 25.0) * (this.fluid.O2 / 1.0);
    if (this.temperature > 100) sigma *= Math.exp(-0.02 * (this.temperature - 100));
    if (this.fluid.pH < 4.0) sigma -= (4.0 - this.fluid.pH) * 0.5;
    else if (this.fluid.pH > 8.0) sigma -= (this.fluid.pH - 8.0) * 0.3;
    return Math.max(sigma, 0);
  }

  // Mimetite (Pb₅(AsO₄)₃Cl) — the mimic, campylite barrels.
  supersaturation_mimetite() {
    if (this.fluid.Pb < 5 || (this.fluid.As || 0) < 3 || (this.fluid.Cl || 0) < 2 || this.fluid.O2 < 0.3) return 0;
    let sigma = (this.fluid.Pb / 60.0) * (this.fluid.As / 25.0) * (this.fluid.Cl / 30.0) * (this.fluid.O2 / 1.0);
    if (this.temperature > 150) sigma *= Math.exp(-0.015 * (this.temperature - 150));
    if (this.fluid.pH < 3.5) sigma -= (3.5 - this.fluid.pH) * 0.5;
    return Math.max(sigma, 0);
  }
}

// ============================================================
// CRYSTAL MODELS
// ============================================================

class GrowthZone {
  constructor(opts = {}) {
    this.step = opts.step ?? 0;
    this.temperature = opts.temperature ?? 0;
    this.thickness_um = opts.thickness_um ?? 0;
    this.growth_rate = opts.growth_rate ?? 0;
    this.trace_Fe = opts.trace_Fe ?? 0;
    this.trace_Mn = opts.trace_Mn ?? 0;
    this.trace_Al = opts.trace_Al ?? 0;
    this.trace_Ti = opts.trace_Ti ?? 0;
    this.fluid_inclusion = opts.fluid_inclusion ?? false;
    this.inclusion_type = opts.inclusion_type ?? '';
    this.note = opts.note ?? '';
    this.ca_from_wall = opts.ca_from_wall ?? 0.0;
    this.ca_from_fluid = opts.ca_from_fluid ?? 0.0;
    this.is_phantom = opts.is_phantom ?? false;
    this.dissolution_depth_um = opts.dissolution_depth_um ?? 0.0;
  }
}

class Crystal {
  constructor(opts = {}) {
    this.mineral = opts.mineral ?? '';
    this.crystal_id = opts.crystal_id ?? 0;
    this.nucleation_step = opts.nucleation_step ?? 0;
    this.nucleation_temp = opts.nucleation_temp ?? 0;
    this.position = opts.position ?? 'vug wall';
    this.c_length_mm = 0;
    this.a_width_mm = 0;
    this.habit = opts.habit ?? 'prismatic';
    this.dominant_forms = opts.dominant_forms ? [...opts.dominant_forms] : [];
    this.twinned = false;
    this.twin_law = '';
    this.zones = [];
    this.total_growth_um = 0;
    this.active = true;
    this.dissolved = false;
    this.phantom_surfaces = [];
    this.phantom_count = 0;
  }

  add_zone(zone) {
    // Time compression — agents play at 5× (same physics, more years per step)
    zone.thickness_um *= 5.0;
    zone.growth_rate *= 5.0;
    // Detect phantom boundaries
    if (zone.thickness_um < 0) {
      zone.is_phantom = true;
      zone.dissolution_depth_um = Math.abs(zone.thickness_um);
      this.phantom_surfaces.push(this.zones.length);
      this.phantom_count++;
    } else if (this.zones.length && this.zones[this.zones.length - 1].thickness_um < 0 && zone.thickness_um > 0) {
      zone.note = (zone.note + ' [phantom boundary — growing over dissolution surface]').trim();
    }
    this.zones.push(zone);
    this.total_growth_um += zone.thickness_um;
    this.c_length_mm = this.total_growth_um / 1000.0;
    if (this.habit === 'prismatic') this.a_width_mm = this.c_length_mm * 0.4;
    else if (this.habit === 'tabular') this.a_width_mm = this.c_length_mm * 1.5;
    else if (this.habit === 'acicular') this.a_width_mm = this.c_length_mm * 0.15;
    else if (this.habit === 'rhombohedral') this.a_width_mm = this.c_length_mm * 0.8;
    else this.a_width_mm = this.c_length_mm * 0.5;
  }

  describe_morphology() {
    const forms = this.dominant_forms.length ? this.dominant_forms.join(', ') : this.habit;
    const twin_str = this.twinned ? `, ${this.twin_law} twin` : '';
    // Show in µm if crystal is < 0.1mm, otherwise mm
    let size;
    if (this.c_length_mm < 0.05) {
      const c_um = this.total_growth_um;
      const a_um = c_um * (this.a_width_mm / (this.c_length_mm || 1));
      size = `${c_um.toFixed(1)} × ${(isFinite(a_um) ? a_um : 0).toFixed(1)} µm`;
    } else if (this.c_length_mm < 1.0) {
      size = `${this.c_length_mm.toFixed(2)} × ${this.a_width_mm.toFixed(2)} mm`;
    } else {
      size = `${this.c_length_mm.toFixed(1)} × ${this.a_width_mm.toFixed(1)} mm`;
    }
    return `${this.habit} [${forms}]${twin_str}, ${size}`;
  }

  describe_latest_zone() {
    if (!this.zones.length) return 'no growth';
    const z = this.zones[this.zones.length - 1];
    const parts = [`+${z.thickness_um.toFixed(1)} µm`];
    const traces = [];
    if (z.trace_Fe > 1) traces.push(`Fe ${z.trace_Fe.toFixed(1)}`);
    if (z.trace_Mn > 0.5) traces.push(`Mn ${z.trace_Mn.toFixed(1)}`);
    if (z.trace_Ti > 0.1) traces.push(`Ti ${z.trace_Ti.toFixed(2)}`);
    if (z.trace_Al > 1) traces.push(`Al ${z.trace_Al.toFixed(1)}`);
    if (traces.length) parts.push(`traces: ${traces.join(', ')} ppm`);
    if (z.fluid_inclusion) parts.push(`fluid inclusion (${z.inclusion_type})`);
    if (z.note) parts.push(z.note);
    return parts.join('; ');
  }

  predict_fluorescence() {
    const n = Math.max(this.zones.length, 1);
    const avg_Mn = this.zones.reduce((s, z) => s + z.trace_Mn, 0) / n;
    const avg_Fe = this.zones.reduce((s, z) => s + z.trace_Fe, 0) / n;

    if (this.mineral === 'calcite') {
      if (avg_Mn > 2 && avg_Fe < 10) return 'orange-red (Mn²⁺ activated)';
      if (avg_Mn > 2 && avg_Fe > 10) return 'weak/quenched (Fe²⁺ quenching Mn²⁺ emission)';
      return 'non-fluorescent';
    }
    if (this.mineral === 'fluorite') return 'blue-violet (REE/defect centers)';
    if (this.mineral === 'quartz') {
      const avg_Al = this.zones.reduce((s, z) => s + z.trace_Al, 0) / n;
      if (avg_Al > 5) return 'weak blue (Al-related defects)';
      return 'non-fluorescent';
    }
    if (this.mineral === 'pyrite' || this.mineral === 'chalcopyrite') {
      return 'non-fluorescent (opaque sulfide)';
    }
    if (this.mineral === 'hematite') {
      return 'non-fluorescent (opaque oxide)';
    }
    if (this.mineral === 'malachite') {
      return 'non-fluorescent';
    }
    if (this.mineral === 'uraninite') {
      return 'non-fluorescent (radioactive, opaque)';
    }
    if (this.mineral === 'galena') {
      return 'non-fluorescent (opaque sulfide)';
    }
    if (this.mineral === 'smithsonite') {
      return 'blue-green to pale blue (SW UV)';
    }
    if (this.mineral === 'wulfenite') {
      return 'non-fluorescent';
    }
    return 'unknown';
  }
}

// ============================================================
// MINERAL GROWTH ENGINES
// ============================================================

function grow_quartz(crystal, conditions, step) {
  const sigma = conditions.supersaturation_quartz();

  if (sigma < 1.0) {
    if (crystal.total_growth_um > 10) {
      crystal.dissolved = true;
      const dissolved_um = Math.min(5.0, crystal.total_growth_um * 0.1);
      // RECYCLING: dissolved SiO2 returns to fluid
      conditions.fluid.SiO2 += dissolved_um * 0.8;

      // Determine dissolution type
      let note;
      if (conditions.fluid.pH < 4.0 && conditions.fluid.F > 20) {
        note = 'HF etching — trigonal etch pits on prism faces, SiO₂ dissolved as SiF₄';
      } else {
        note = 'dissolution — etching on prism faces';
      }

      return new GrowthZone({
        step, temperature: conditions.temperature,
        thickness_um: -dissolved_um, growth_rate: -dissolved_um,
        note
      });
    }
    return null;
  }

  const excess = sigma - 1.0;
  let rate;
  if (excess < 0.5) rate = 8.0 * excess * excess;
  else rate = 4.0 * excess;

  rate *= Math.exp(-3000.0 / (conditions.temperature + 273.15)) * 50.0;
  rate *= rng.uniform(0.7, 1.3);

  if (rate < 0.1) return null;

  const Ti_partition = 0.01 * Math.exp(0.005 * conditions.temperature);
  const trace_Ti = conditions.fluid.Ti * Ti_partition;
  const Al_partition = 0.02 * (1 + 0.5 * excess);
  const trace_Al = conditions.fluid.Al * Al_partition;
  const trace_Fe = conditions.fluid.Fe * 0.005;
  const trace_Mn = conditions.fluid.Mn * 0.003;

  let fi = false, fi_type = '';
  if (rate > 15 && rng.random() < 0.3) {
    fi = true;
    if (conditions.temperature > 300) fi_type = '2-phase (liquid + vapor)';
    else if (conditions.temperature > 200) fi_type = '2-phase (liquid-dominant)';
    else fi_type = 'single-phase liquid';
  }

  // SiO₂ polymorph determines habit
  const polymorph = conditions.silica_polymorph();
  crystal._polymorph = polymorph;
  if (polymorph === 'tridymite') {
    crystal.habit = 'tridymite (thin hexagonal plates)';
    crystal.dominant_forms = ['thin tabular {0001}', 'pseudo-hexagonal'];
    crystal.mineral_display = 'tridymite';
  } else if (polymorph === 'beta-quartz') {
    crystal.habit = 'β-quartz bipyramidal (paramorphic)';
    crystal.dominant_forms = ['hexagonal bipyramid {10̄11}', 'no prism faces'];
    crystal.mineral_display = 'quartz (β→α)';
  } else if (polymorph === 'alpha-quartz') {
    if (conditions.temperature > 400) {
      crystal.habit = 'prismatic';
      crystal.dominant_forms = ['m{100} prism', 'r{101} rhombohedron'];
    } else if (conditions.temperature > 250) {
      crystal.habit = 'prismatic';
      crystal.dominant_forms = ['m{100} prism', 'r{101}', 'z{011}'];
    } else {
      crystal.dominant_forms = ['m{100}', 'r{101}', 'z{011} dominant'];
      if (excess > 1.0) crystal.habit = 'scepter overgrowth possible';
    }
  } else if (polymorph === 'chalcedony') {
    crystal.habit = 'chalcedony (microcrystalline)';
    crystal.dominant_forms = ['fibrous aggregates', 'botryoidal'];
    crystal.mineral_display = 'chalcedony';
    rate *= 1.5;
  } else {
    crystal.habit = 'opal (amorphous silica)';
    crystal.dominant_forms = ['botryoidal', 'colloform'];
    crystal.mineral_display = 'opal';
    rate *= 2.0;
  }

  // Dauphiné twinning: β→α inversion at 573°C or thermal shock
  if (!crystal.twinned && crystal.zones.length > 2) {
    const prev_T = crystal.zones[crystal.zones.length - 1].temperature;
    const crossed_573 = (prev_T > 573 && conditions.temperature <= 573) ||
                         (prev_T <= 573 && conditions.temperature > 573);
    if (crossed_573 && rng.random() < 0.7) {
      crystal.twinned = true;
      crystal.twin_law = 'Dauphiné (β→α inversion)';
    } else if (!crossed_573) {
      const delta_T = Math.abs(conditions.temperature - prev_T);
      if (delta_T > 50 && rng.random() < 0.25) {
        crystal.twinned = true;
        crystal.twin_law = 'Dauphiné (thermal stress)';
      }
    }
  }

  let note = '';
  if (polymorph === 'opal') {
    note = 'amorphous silica precipitating — colloidal deposition';
  } else if (polymorph === 'chalcedony') {
    note = 'chalcedony — fibrous microcrystalline growth';
    if (excess > 1.5) note += ', rapid banding possible';
  } else if (polymorph === 'beta-quartz') {
    note = 'β-quartz crystallizing — hexagonal bipyramids, will invert to α on cooling';
  } else if (polymorph === 'tridymite') {
    note = 'tridymite crystallizing — high-T silica polymorph, thin hexagonal plates';
  } else {
    if (excess > 1.5) note = 'rapid growth — growth hillocks developing on prism faces';
    else if (excess > 1.0) note = 'moderate supersaturation — clean layer growth';
    else if (excess < 0.2) note = 'near-equilibrium — very slow, high-quality growth';
  }

  return new GrowthZone({
    step, temperature: conditions.temperature,
    thickness_um: rate, growth_rate: rate,
    trace_Fe, trace_Mn, trace_Al, trace_Ti,
    fluid_inclusion: fi, inclusion_type: fi_type, note
  });
}

function grow_calcite(crystal, conditions, step) {
  const sigma = conditions.supersaturation_calcite();
  if (sigma < 1.0) {
    // Acid dissolution — calcite dissolves easily in acid
    if (crystal.total_growth_um > 5 && conditions.fluid.pH < 5.5) {
      crystal.dissolved = true;
      const dissolved_um = Math.min(8.0, crystal.total_growth_um * 0.15);
      // RECYCLING: Ca, CO3, and trace elements return to fluid
      conditions.fluid.Ca += dissolved_um * 0.5;
      conditions.fluid.CO3 += dissolved_um * 0.3;
      // Mn and Fe that were in the crystal go back into solution
      if (crystal.zones.length) {
        const recentZones = crystal.zones.slice(-3);
        const avg_mn = recentZones.reduce((s, z) => s + z.trace_Mn, 0) / recentZones.length;
        const avg_fe = recentZones.reduce((s, z) => s + z.trace_Fe, 0) / recentZones.length;
        conditions.fluid.Mn += avg_mn * 0.5;
        conditions.fluid.Fe += avg_fe * 0.5;
      }
      return new GrowthZone({
        step, temperature: conditions.temperature,
        thickness_um: -dissolved_um, growth_rate: -dissolved_um,
        note: `acid dissolution (pH ${conditions.fluid.pH.toFixed(1)}) — Ca²⁺ + CO₃²⁻ released back to fluid`
      });
    }
    return null;
  }

  const excess = sigma - 1.0;
  let rate = 5.0 * excess * rng.uniform(0.8, 1.2);

  const Mn_partition = 0.1 * (1 + excess * 0.5);
  const trace_Mn = conditions.fluid.Mn * Mn_partition;
  const Fe_partition = 0.08;
  const trace_Fe = conditions.fluid.Fe * Fe_partition;

  // Provenance tracking — what fraction of Ca came from the wall?
  const wall = conditions.wall;
  const total_ca = conditions.fluid.Ca;
  let ca_wall_fraction = 0.0;
  let ca_fluid_fraction = 1.0;
  if (total_ca > 0 && wall.ca_from_wall_total > 0) {
    ca_wall_fraction = Math.min(wall.ca_from_wall_total / total_ca, 1.0);
    ca_fluid_fraction = 1.0 - ca_wall_fraction;
  }

  if (conditions.temperature > 200) {
    crystal.habit = 'scalenohedral';
    crystal.dominant_forms = ['v{211} scalenohedron', 'dog-tooth'];
  } else if (conditions.temperature > 100) {
    crystal.habit = 'rhombohedral';
    crystal.dominant_forms = ['e{104} rhombohedron'];
  } else {
    crystal.habit = 'rhombohedral';
    crystal.dominant_forms = ['e{104}', 'possibly nail-head'];
  }

  if (!crystal.twinned && rng.random() < 0.01) {
    crystal.twinned = true;
    crystal.twin_law = 'c-twin {001}';
  }

  let note = '';
  if (trace_Mn > 1.0 && trace_Fe < 2.0) note = 'Mn-rich zone — will fluoresce orange under UV';
  else if (trace_Mn > 1.0 && trace_Fe > 2.0) note = 'Fe quenching Mn fluorescence — dark CL zone';

  // Provenance note when significant wall-derived material
  if (ca_wall_fraction > 0.3) {
    const prov_note = `[${(ca_wall_fraction * 100).toFixed(0)}% recycled wall rock]`;
    note = note ? `${note} ${prov_note}` : prov_note;
  }

  let fi = false, fi_type = '';
  if (rate > 8 && rng.random() < 0.2) {
    fi = true;
    fi_type = conditions.temperature > 150 ? '2-phase' : 'single-phase';
  }

  return new GrowthZone({
    step, temperature: conditions.temperature,
    thickness_um: rate, growth_rate: rate,
    trace_Fe, trace_Mn,
    fluid_inclusion: fi, inclusion_type: fi_type, note,
    ca_from_wall: ca_wall_fraction,
    ca_from_fluid: ca_fluid_fraction,
  });
}

function grow_sphalerite(crystal, conditions, step) {
  const sigma = conditions.supersaturation_sphalerite();
  if (sigma < 1.0) return null;

  const excess = sigma - 1.0;
  let rate = 6.0 * excess * rng.uniform(0.7, 1.3);

  const Fe_mol_percent = Math.min(conditions.fluid.Fe * 0.1 * (conditions.temperature / 300.0), 30.0);
  const trace_Fe = Fe_mol_percent * 10;

  crystal.habit = 'tetrahedral';
  crystal.dominant_forms = ['{111} tetrahedron'];

  let color_note;
  if (Fe_mol_percent > 15) color_note = 'black (marmatite — high Fe)';
  else if (Fe_mol_percent > 8) color_note = 'dark brown';
  else if (Fe_mol_percent > 3) color_note = 'honey/amber';
  else color_note = 'pale yellow (cleiophane — gem quality)';

  if (!crystal.twinned && rng.random() < 0.015) {
    crystal.twinned = true;
    crystal.twin_law = 'spinel-law {111}';
  }

  return new GrowthZone({
    step, temperature: conditions.temperature,
    thickness_um: rate, growth_rate: rate,
    trace_Fe,
    note: `color: ${color_note}, Fe: ${Fe_mol_percent.toFixed(1)} mol%`
  });
}

function grow_fluorite(crystal, conditions, step) {
  const sigma = conditions.supersaturation_fluorite();
  if (sigma < 1.0) {
    // Acid dissolution: CaF₂ + 2HCl → CaCl₂ + 2HF (releases hydrofluoric acid!)
    if (crystal.total_growth_um > 5 && conditions.fluid.pH < 4.0) {
      crystal.dissolved = true;
      const dissolved_um = Math.min(6.0, crystal.total_growth_um * 0.12);
      conditions.fluid.Ca += dissolved_um * 0.4;
      conditions.fluid.F += dissolved_um * 0.6;
      return new GrowthZone({
        step, temperature: conditions.temperature,
        thickness_um: -dissolved_um, growth_rate: -dissolved_um,
        note: `acid dissolution (pH ${conditions.fluid.pH.toFixed(1)}) — CaF₂ + 2H⁺ → Ca²⁺ + 2HF (⚠️ releases hydrofluoric acid)`
      });
    }
    return null;
  }

  const excess = sigma - 1.0;
  let rate = 7.0 * excess * rng.uniform(0.8, 1.2);

  crystal.habit = 'cubic';
  crystal.dominant_forms = ['{100} cube'];

  let color;
  if (conditions.fluid.Fe > 10) color = 'green';
  else if (conditions.fluid.Mn > 5) color = 'purple';
  else if (conditions.temperature > 200) color = 'colorless';
  else color = 'blue-violet';

  if (!crystal.twinned && rng.random() < 0.008) {
    crystal.twinned = true;
    crystal.twin_law = 'penetration twin {111}';
  }

  return new GrowthZone({
    step, temperature: conditions.temperature,
    thickness_um: rate, growth_rate: rate,
    trace_Fe: conditions.fluid.Fe * 0.02,
    trace_Mn: conditions.fluid.Mn * 0.05,
    note: `color zone: ${color}`
  });
}

function grow_pyrite(crystal, conditions, step) {
  const sigma = conditions.supersaturation_pyrite();

  if (sigma < 1.0) {
    // Check for oxidation/dissolution
    if (crystal.total_growth_um > 10 && conditions.fluid.O2 > 1.0) {
      crystal.dissolved = true;
      const dissolved_um = Math.min(3.0, crystal.total_growth_um * 0.1);
      // RECYCLING: Fe and S return to fluid
      conditions.fluid.Fe += dissolved_um * 1.0;
      conditions.fluid.S += dissolved_um * 0.5;
      return new GrowthZone({
        step, temperature: conditions.temperature,
        thickness_um: -dissolved_um, growth_rate: -dissolved_um,
        note: 'oxidizing — pyrite weathering to goethite/limonite, Fe²⁺ released to fluid'
      });
    }
    // Also dissolves in strong acid
    if (crystal.total_growth_um > 10 && conditions.fluid.pH < 3.0) {
      crystal.dissolved = true;
      conditions.fluid.Fe += 2.0;
      conditions.fluid.S += 1.5;
      return new GrowthZone({
        step, temperature: conditions.temperature,
        thickness_um: -2.0, growth_rate: -2.0,
        note: `acid dissolution (pH ${conditions.fluid.pH.toFixed(1)}) — Fe + S released`
      });
    }
    return null;
  }

  const excess = sigma - 1.0;
  let rate = 5.0 * excess * rng.uniform(0.7, 1.3);

  if (conditions.temperature > 300) {
    crystal.habit = 'cubic';
    crystal.dominant_forms = ['{100} cube'];
  } else if (conditions.temperature > 200) {
    crystal.habit = 'pyritohedral';
    crystal.dominant_forms = ['{210} pyritohedron'];
  } else if (conditions.temperature > 100) {
    crystal.habit = 'cubo-pyritohedral';
    crystal.dominant_forms = ['{100} + {210}'];
  } else {
    if (excess > 1.0) {
      crystal.habit = 'framboidal';
      crystal.dominant_forms = ['framboidal aggregate'];
    } else {
      crystal.habit = 'cubic';
      crystal.dominant_forms = ['{100} cube, microcrystalline'];
    }
  }

  let trace_note = 'brassy yellow metallic luster';
  if (conditions.fluid.Cu > 20) {
    trace_note += ', Cu traces (may exsolve chalcopyrite inclusions)';
  }

  if (!crystal.twinned && rng.random() < 0.008) {
    crystal.twinned = true;
    crystal.twin_law = 'iron cross {110}';
  }

  return new GrowthZone({
    step, temperature: conditions.temperature,
    thickness_um: rate, growth_rate: rate,
    trace_Fe: conditions.fluid.Fe * 0.15,
    note: trace_note
  });
}

function grow_chalcopyrite(crystal, conditions, step) {
  const sigma = conditions.supersaturation_chalcopyrite();

  if (sigma < 1.0) {
    if (crystal.total_growth_um > 10 && conditions.fluid.O2 > 1.0) {
      crystal.dissolved = true;
      const dissolved_um = Math.min(4.0, crystal.total_growth_um * 0.1);
      // RECYCLING: Cu, Fe, S return to fluid
      conditions.fluid.Cu += dissolved_um * 0.8;
      conditions.fluid.Fe += dissolved_um * 0.5;
      conditions.fluid.S += dissolved_um * 0.3;
      return new GrowthZone({
        step, temperature: conditions.temperature,
        thickness_um: -dissolved_um, growth_rate: -dissolved_um,
        note: 'oxidizing — chalcopyrite weathering, Cu²⁺ + Fe²⁺ released (→ malachite/azurite at surface)'
      });
    }
    return null;
  }

  const excess = sigma - 1.0;
  let rate = 4.5 * excess * rng.uniform(0.7, 1.3);

  crystal.habit = 'disphenoidal';
  crystal.dominant_forms = ['{112} disphenoid', '{012}'];

  let color_note;
  if (conditions.temperature < 100) {
    color_note = 'brassy yellow, may develop iridescent tarnish';
  } else {
    color_note = 'brassy yellow, metallic';
  }

  const trace_Cu = conditions.fluid.Cu * 0.1;

  if (!crystal.twinned && rng.random() < 0.012) {
    crystal.twinned = true;
    crystal.twin_law = 'penetration twin {112}';
  }

  return new GrowthZone({
    step, temperature: conditions.temperature,
    thickness_um: rate, growth_rate: rate,
    trace_Fe: conditions.fluid.Fe * 0.1,
    note: `${color_note}, Cu: ${trace_Cu.toFixed(1)} ppm incorporated`
  });
}

function grow_hematite(crystal, conditions, step) {
  const sigma = conditions.supersaturation_hematite();

  if (sigma < 1.0) {
    if (crystal.total_growth_um > 5 && conditions.fluid.pH < 3.0) {
      crystal.dissolved = true;
      const dissolved_um = Math.min(4.0, crystal.total_growth_um * 0.1);
      conditions.fluid.Fe += dissolved_um * 1.5;
      return new GrowthZone({
        step, temperature: conditions.temperature,
        thickness_um: -dissolved_um, growth_rate: -dissolved_um,
        note: `acid dissolution (pH ${conditions.fluid.pH.toFixed(1)}) — Fe²⁺ released back to fluid`
      });
    }
    return null;
  }

  const excess = sigma - 1.0;
  let rate = 4.0 * excess * rng.uniform(0.8, 1.2);
  if (rate < 0.1) return null;

  if (conditions.temperature > 300) {
    crystal.habit = 'specular';
    crystal.dominant_forms = ['{001} basal plates', 'metallic platy'];
  } else if (conditions.temperature > 150) {
    crystal.habit = 'rhombohedral';
    crystal.dominant_forms = ['{101} rhombohedron'];
  } else {
    if (excess > 0.5) {
      crystal.habit = 'botryoidal';
      crystal.dominant_forms = ['kidney-ore texture'];
    } else {
      crystal.habit = 'earthy/massive';
      crystal.dominant_forms = ['microcrystalline aggregate'];
    }
  }

  if (crystal.habit === 'specular') crystal.a_width_mm = crystal.c_length_mm * 2.0;
  else if (crystal.habit === 'botryoidal') crystal.a_width_mm = crystal.c_length_mm * 1.2;

  const trace_Mn = conditions.fluid.Mn * 0.04;
  const trace_Fe = conditions.fluid.Fe * 0.2;

  if (!crystal.twinned && rng.random() < 0.005) {
    crystal.twinned = true;
    crystal.twin_law = 'penetration twin {001}';
  }

  let color_note;
  if (crystal.habit === 'specular') {
    color_note = rng.random() < 0.03 ? 'iridescent (very thin plates — interference colors)' : 'steel-gray metallic';
  } else if (crystal.habit === 'earthy/massive' || crystal.habit === 'botryoidal') {
    color_note = 'red earthy';
  } else {
    color_note = 'dark gray metallic';
  }

  return new GrowthZone({
    step, temperature: conditions.temperature,
    thickness_um: rate, growth_rate: rate,
    trace_Fe, trace_Mn,
    note: `${crystal.habit} habit, ${color_note}`
  });
}

function grow_malachite(crystal, conditions, step) {
  const sigma = conditions.supersaturation_malachite();

  if (sigma < 1.0) {
    if (crystal.total_growth_um > 5 && conditions.fluid.pH < 4.5) {
      crystal.dissolved = true;
      const dissolved_um = Math.min(6.0, crystal.total_growth_um * 0.15);
      conditions.fluid.Cu += dissolved_um * 0.8;
      conditions.fluid.CO3 += dissolved_um * 0.5;
      return new GrowthZone({
        step, temperature: conditions.temperature,
        thickness_um: -dissolved_um, growth_rate: -dissolved_um,
        note: `acid dissolution (pH ${conditions.fluid.pH.toFixed(1)}) — fizzing! Cu²⁺ + CO₃²⁻ released`
      });
    }
    return null;
  }

  const excess = sigma - 1.0;
  let rate = 6.0 * excess * rng.uniform(0.8, 1.2);
  if (rate < 0.1) return null;

  const zone_count = crystal.zones.length;
  if (zone_count >= 20) {
    crystal.habit = 'banded';
    crystal.dominant_forms = ['banded botryoidal', 'concentric layers'];
  } else if (rate > 8) {
    crystal.habit = 'fibrous/acicular';
    crystal.dominant_forms = ['acicular sprays', 'fibrous radiating'];
  } else {
    crystal.habit = 'botryoidal';
    crystal.dominant_forms = ['botryoidal masses', 'mammillary'];
  }

  if (crystal.habit === 'botryoidal' || crystal.habit === 'banded') {
    crystal.a_width_mm = crystal.c_length_mm * 1.5;
  } else if (crystal.habit === 'fibrous/acicular') {
    crystal.a_width_mm = crystal.c_length_mm * 0.2;
  }

  // Cu consumption
  conditions.fluid.Cu -= rate * 0.01;
  conditions.fluid.Cu = Math.max(conditions.fluid.Cu, 0);

  let color_note;
  if (zone_count >= 20) {
    color_note = 'banded green (alternating light/dark)';
  } else if (conditions.fluid.Cu > 30) {
    color_note = 'vivid green';
  } else if (conditions.fluid.Cu < 10) {
    color_note = 'pale green';
  } else {
    color_note = 'green';
  }

  return new GrowthZone({
    step, temperature: conditions.temperature,
    thickness_um: rate, growth_rate: rate,
    trace_Fe: conditions.fluid.Fe * 0.01,
    note: `${crystal.habit}, ${color_note}, Cu fluid: ${conditions.fluid.Cu.toFixed(0)} ppm`
  });
}

function grow_uraninite(crystal, conditions, step) {
  // v12 (May 2026): Gatekeeper for the secondary U family. When sigma<1
  // AND O2>0.3 AND grown>3µm, uraninite oxidizes and releases UO₂²⁺
  // back to broth — feedstock for torbernite/zeunerite/carnotite.
  // Habit dispatch: T>500 octahedral (pegmatitic), else pitchblende_massive.
  const sigma = conditions.supersaturation_uraninite();

  if (sigma < 1.0) {
    // Oxidative dissolution: UO₂ + ½O₂ + 2H⁺ → UO₂²⁺ + H₂O
    if (crystal.total_growth_um > 3 && conditions.fluid.O2 > 0.3) {
      crystal.dissolved = true;
      const dissolved_um = Math.min(4.0, crystal.total_growth_um * 0.12);
      conditions.fluid.U += dissolved_um * 0.6; // uranyl back to fluid
      return new GrowthZone({
        step, temperature: conditions.temperature,
        thickness_um: -dissolved_um, growth_rate: -dissolved_um,
        note: `oxidation — uraninite weathers, releasing UO₂²⁺ (U fluid: ${conditions.fluid.U.toFixed(0)} ppm)`
      });
    }
    return null;
  }

  const rate = 0.008 * sigma * 1000 * rng.uniform(0.8, 1.2); // scale to µm
  if (rate < 0.1) return null;

  // Habit dispatch — research §157
  const T = conditions.temperature;
  if (T > 500) {
    crystal.habit = 'octahedral';
    crystal.dominant_forms = ['{111} octahedron'];
  } else {
    crystal.habit = 'pitchblende_massive';
    crystal.dominant_forms = ['botryoidal masses', 'colloform banding'];
  }

  // U consumption
  conditions.fluid.U -= rate * 0.005;
  conditions.fluid.U = Math.max(conditions.fluid.U, 0);

  let color_note;
  if (T > 500) color_note = 'pitch-black, submetallic — pegmatitic octahedron';
  else if (T >= 200) color_note = 'greasy black pitchblende, botryoidal crust';
  else color_note = 'cryptocrystalline black mass — roll-front uraninite';

  return new GrowthZone({
    step, temperature: conditions.temperature,
    thickness_um: rate, growth_rate: rate,
    trace_Fe: conditions.fluid.Fe * 0.01,
    note: `${color_note}, U fluid: ${conditions.fluid.U.toFixed(0)} ppm — radioactive`
  });
}

function grow_galena(crystal, conditions, step) {
  const sigma = conditions.supersaturation_galena();
  if (sigma < 1.0) return null;

  let rate = 0.015 * sigma * 1000 * rng.uniform(0.8, 1.2); // scale to µm
  // Faster at 200-400°C
  if (conditions.temperature >= 200 && conditions.temperature <= 400) {
    rate *= 1.2;
  }
  if (rate < 0.1) return null;

  crystal.habit = 'cubic';
  crystal.dominant_forms = ['{100} cube', '{111} octahedron'];

  // Pb and S consumption
  conditions.fluid.Pb -= rate * 0.005;
  conditions.fluid.Pb = Math.max(conditions.fluid.Pb, 0);
  conditions.fluid.S -= rate * 0.003;
  conditions.fluid.S = Math.max(conditions.fluid.S, 0);

  if (!crystal.twinned && rng.random() < 0.008) {
    crystal.twinned = true;
    crystal.twin_law = 'spinel-law {111}';
  }

  let color_note = 'lead-gray, bright metallic luster';
  if (conditions.fluid.Ag > 5) {
    color_note += ', possible Ag inclusions';
  }

  return new GrowthZone({
    step, temperature: conditions.temperature,
    thickness_um: rate, growth_rate: rate,
    trace_Fe: conditions.fluid.Fe * 0.005,
    note: `${color_note}, Pb fluid: ${conditions.fluid.Pb.toFixed(0)} ppm`
  });
}

function grow_smithsonite(crystal, conditions, step) {
  const sigma = conditions.supersaturation_smithsonite();
  if (sigma < 1.0) {
    if (crystal.total_growth_um > 5 && conditions.fluid.pH < 4.5) {
      crystal.dissolved = true;
      const dissolved_um = Math.min(5.0, crystal.total_growth_um * 0.12);
      conditions.fluid.Zn += dissolved_um * 0.6;
      conditions.fluid.CO3 += dissolved_um * 0.4;
      return new GrowthZone({ step, temperature: conditions.temperature, thickness_um: -dissolved_um, growth_rate: -dissolved_um, note: `acid dissolution — smithsonite fizzes weakly, releasing Zn²⁺` });
    }
    return null;
  }
  const excess = sigma - 1.0;
  let rate = 5.0 * excess * rng.uniform(0.8, 1.2);
  if (rate < 0.1) return null;
  const zone_count = crystal.zones.length;
  if (zone_count >= 15) { crystal.habit = 'botryoidal/stalactitic'; crystal.dominant_forms = ['botryoidal crusts', 'stalactitic masses']; }
  else if (rate > 6) { crystal.habit = 'rhombohedral'; crystal.dominant_forms = ['{10̄11} rhombohedron', 'curved faces']; }
  else { crystal.habit = 'botryoidal'; crystal.dominant_forms = ['grape-like clusters', 'reniform masses']; }
  if (crystal.habit === 'botryoidal' || crystal.habit === 'botryoidal/stalactitic') crystal.a_width_mm = crystal.c_length_mm * 1.8;
  conditions.fluid.Zn -= rate * 0.008; conditions.fluid.Zn = Math.max(conditions.fluid.Zn, 0);
  conditions.fluid.CO3 -= rate * 0.005; conditions.fluid.CO3 = Math.max(conditions.fluid.CO3, 0);
  if (!crystal.twinned && rng.random() < 0.01) { crystal.twinned = true; crystal.twin_law = 'cyclic {01̄12}'; }
  let color_note;
  if (conditions.fluid.Cu > 15) color_note = 'apple-green (Cu impurity)';
  else if (conditions.fluid.Fe > 20) color_note = 'yellow-brown (Fe impurity)';
  else if (conditions.fluid.Mn > 10) color_note = 'pink (Mn impurity)';
  else color_note = rng.random() < 0.4 ? 'blue-green' : 'white to pale blue';
  return new GrowthZone({ step, temperature: conditions.temperature, thickness_um: rate, growth_rate: rate, trace_Fe: conditions.fluid.Fe * 0.01, note: `${crystal.habit}, ${color_note}, Zn fluid: ${conditions.fluid.Zn.toFixed(0)} ppm` });
}

function grow_wulfenite(crystal, conditions, step) {
  const sigma = conditions.supersaturation_wulfenite();
  if (sigma < 1.0) {
    if (crystal.total_growth_um > 3 && conditions.fluid.pH < 3.5) {
      crystal.dissolved = true;
      const dissolved_um = Math.min(4.0, crystal.total_growth_um * 0.10);
      conditions.fluid.Pb += dissolved_um * 0.5; conditions.fluid.Mo += dissolved_um * 0.3;
      return new GrowthZone({ step, temperature: conditions.temperature, thickness_um: -dissolved_um, growth_rate: -dissolved_um, note: `acid dissolution — wulfenite dissolves, releasing Pb²⁺ and MoO₄²⁻` });
    }
    return null;
  }
  const excess = sigma - 1.0;
  let rate = 3.5 * excess * rng.uniform(0.8, 1.2);
  if (rate < 0.1) return null;
  crystal.habit = 'tabular'; crystal.dominant_forms = ['{001} tabular plates', 'square outline'];
  crystal.a_width_mm = crystal.c_length_mm * 3.0;
  conditions.fluid.Pb -= rate * 0.006; conditions.fluid.Pb = Math.max(conditions.fluid.Pb, 0);
  conditions.fluid.Mo -= rate * 0.004; conditions.fluid.Mo = Math.max(conditions.fluid.Mo, 0);
  if (!crystal.twinned && rng.random() < 0.03) { crystal.twinned = true; crystal.twin_law = 'penetration twin {001}/{100}'; }
  let color_note;
  if (rate > 5) color_note = 'honey-yellow, translucent';
  else color_note = rng.random() < 0.5 ? 'orange tabular plates' : 'honey-orange, vitreous luster';
  return new GrowthZone({ step, temperature: conditions.temperature, thickness_um: rate, growth_rate: rate, trace_Fe: conditions.fluid.Fe * 0.005, note: `${color_note}, Pb: ${conditions.fluid.Pb.toFixed(0)} Mo: ${conditions.fluid.Mo.toFixed(0)} ppm` });
}

// Goethite (FeO(OH)) — ghost mineral made real.
function grow_goethite(crystal, conditions, step) {
  const sigma = conditions.supersaturation_goethite();
  if (sigma < 1.0) {
    if (crystal.total_growth_um > 3 && conditions.fluid.pH < 3.0) {
      crystal.dissolved = true;
      const d = Math.min(4.0, crystal.total_growth_um * 0.12);
      conditions.fluid.Fe += d * 0.5;
      return new GrowthZone({ step, temperature: conditions.temperature, thickness_um: -d, growth_rate: -d, note: `acid dissolution (pH ${conditions.fluid.pH.toFixed(1)}) — goethite releases Fe³⁺` });
    }
    return null;
  }
  const excess = sigma - 1.0;
  const rate = 4.0 * excess * rng.uniform(0.7, 1.3);
  if (rate < 0.1) return null;

  const zoneCount = crystal.zones.length;
  if (zoneCount >= 20) {
    crystal.habit = 'botryoidal/stalactitic';
    crystal.dominant_forms = ['botryoidal masses', 'velvety surfaces'];
  } else if (zoneCount >= 8) {
    crystal.habit = 'botryoidal';
    crystal.dominant_forms = ['grape-like clusters', 'reniform masses'];
  } else if (crystal.position.includes('pseudomorph after')) {
    crystal.habit = 'pseudomorph_after_sulfide';
    crystal.dominant_forms = ['replaces sulfide cube', 'preserves parent habit'];
  } else {
    crystal.habit = 'fibrous_acicular';
    crystal.dominant_forms = ['radiating needles', 'velvet crust'];
  }
  if (crystal.habit.includes('botryoidal')) crystal.a_width_mm = crystal.c_length_mm * 1.6;

  conditions.fluid.Fe = Math.max(conditions.fluid.Fe - rate * 0.008, 0);
  conditions.fluid.O2 = Math.max(conditions.fluid.O2 - rate * 0.001, 0);

  let colorNote;
  if (crystal.habit.includes('pseudomorph')) colorNote = 'yellow-brown pseudomorph after pyrite — the boxwork ghost';
  else if (crystal.habit.includes('botryoidal')) colorNote = 'black lustrous botryoidal surfaces, velvety sheen';
  else colorNote = 'yellow-brown earthy to ochre';

  return new GrowthZone({ step, temperature: conditions.temperature, thickness_um: rate, growth_rate: rate, trace_Fe: conditions.fluid.Fe * 0.02, note: colorNote });
}

// Molybdenite (MoS₂) — porphyry sulfide, Mo source for wulfenite.
function grow_molybdenite(crystal, conditions, step) {
  const sigma = conditions.supersaturation_molybdenite();
  if (sigma < 1.0) {
    if (crystal.total_growth_um > 3 && conditions.fluid.O2 > 0.3) {
      crystal.dissolved = true;
      const d = Math.min(4.0, crystal.total_growth_um * 0.15);
      conditions.fluid.Mo += d * 0.8;
      conditions.fluid.S += d * 0.2;
      return new GrowthZone({ step, temperature: conditions.temperature, thickness_um: -d, growth_rate: -d, note: 'oxidation — molybdenite releases MoO₄²⁻' });
    }
    return null;
  }
  let rate = 4.0 * sigma * rng.uniform(0.8, 1.2);
  if (conditions.temperature >= 300 && conditions.temperature <= 500) rate *= 1.3;
  if (rate < 0.1) return null;
  crystal.habit = 'hexagonal platy';
  conditions.fluid.Mo = Math.max(conditions.fluid.Mo - rate * 0.004, 0);
  conditions.fluid.S = Math.max(conditions.fluid.S - rate * 0.003, 0);
  return new GrowthZone({ step, temperature: conditions.temperature, thickness_um: rate, growth_rate: rate, note: 'bluish-gray metallic, platy habit, sectile' });
}

// Feldspar (KAlSi₃O₈) — polymorph by T: sanidine/orthoclase/microcline.
function grow_feldspar(crystal, conditions, step) {
  const sigma = conditions.supersaturation_feldspar();
  if (sigma < 1.0) {
    if (crystal.total_growth_um > 3 && conditions.fluid.pH < 4.5) {
      crystal.dissolved = true;
      const d = Math.min(3.0, crystal.total_growth_um * 0.08);
      conditions.fluid.K += d * 0.3;
      conditions.fluid.Al += d * 0.4;
      conditions.fluid.SiO2 += d * 0.5;
      return new GrowthZone({ step, temperature: conditions.temperature, thickness_um: -d, growth_rate: -d, note: 'acid weathering — feldspar → kaolinite, releases K⁺, Al³⁺, SiO₂' });
    }
    return null;
  }
  const excess = sigma - 1.0;
  const rate = 3.0 * excess * rng.uniform(0.7, 1.3);
  if (rate < 0.1) return null;
  const T = conditions.temperature;
  const polymorph = T > 500 ? 'sanidine' : (T > 300 ? 'orthoclase' : 'microcline');
  crystal.habit = T > 500 ? 'tabular' : 'prismatic';
  crystal.mineral_display = polymorph;
  if (!crystal.twinned && rng.random() < 0.12) { crystal.twinned = true; crystal.twin_law = 'Carlsbad [001]'; }
  conditions.fluid.K = Math.max(conditions.fluid.K - rate * 0.005, 0);
  conditions.fluid.Al = Math.max(conditions.fluid.Al - rate * 0.004, 0);
  conditions.fluid.SiO2 = Math.max(conditions.fluid.SiO2 - rate * 0.006, 0);
  const amazonite = conditions.fluid.Pb > 5 && polymorph === 'microcline';
  const note = amazonite ? `${polymorph} — amazonite (Pb²⁺ → K⁺)` : `${polymorph} (T=${T.toFixed(0)}°C)`;
  return new GrowthZone({ step, temperature: conditions.temperature, thickness_um: rate, growth_rate: rate, trace_Al: conditions.fluid.Al * 0.1, note });
}

// Albite (NaAlSi₃O₈) — Na-feldspar, cleavelandite platy in pegmatites.
function grow_albite(crystal, conditions, step) {
  const sigma = conditions.supersaturation_albite();
  if (sigma < 1.0) {
    if (crystal.total_growth_um > 10 && conditions.fluid.pH < 3.0) {
      crystal.dissolved = true;
      const d = Math.min(3.0, crystal.total_growth_um * 0.06);
      conditions.fluid.Na += d * 0.3;
      conditions.fluid.Al += d * 0.2;
      conditions.fluid.SiO2 += d * 0.3;
      return new GrowthZone({ step, temperature: conditions.temperature, thickness_um: -d, growth_rate: -d, note: `albite dissolution (pH ${conditions.fluid.pH.toFixed(1)})` });
    }
    return null;
  }
  const excess = sigma - 1.0;
  const rate = 4.0 * excess * rng.uniform(0.8, 1.2);
  if (rate < 0.1) return null;
  crystal.habit = (conditions.temperature < 350 && rate < 3.0 && rng.random() < 0.25) ? 'cleavelandite_platy' : 'prismatic';
  if (!crystal.twinned && rng.random() < 0.20) { crystal.twinned = true; crystal.twin_law = 'albite polysynthetic {010}'; }
  conditions.fluid.Na = Math.max(conditions.fluid.Na - rate * 0.012, 0);
  conditions.fluid.Al = Math.max(conditions.fluid.Al - rate * 0.006, 0);
  conditions.fluid.SiO2 = Math.max(conditions.fluid.SiO2 - rate * 0.010, 0);
  return new GrowthZone({ step, temperature: conditions.temperature, thickness_um: rate, growth_rate: rate, trace_Al: conditions.fluid.Al * 0.03, note: crystal.habit });
}

// Selenite (CaSO₄·2H₂O) — low-T evaporite, Naica cathedral blade.
function grow_selenite(crystal, conditions, step) {
  const sigma = conditions.supersaturation_selenite();
  if (sigma < 1.0) {
    if (crystal.total_growth_um > 5 && conditions.fluid.pH < 5.0) {
      crystal.dissolved = true;
      const d = Math.min(5.0, crystal.total_growth_um * 0.10);
      conditions.fluid.Ca += d * 0.4;
      conditions.fluid.S += d * 0.4;
      return new GrowthZone({ step, temperature: conditions.temperature, thickness_um: -d, growth_rate: -d, note: `selenite acid dissolution (pH ${conditions.fluid.pH.toFixed(1)})` });
    }
    return null;
  }
  const excess = sigma - 1.0;
  let rate = 6.0 * excess * rng.uniform(0.8, 1.2);
  if (conditions.temperature >= 55 && conditions.temperature <= 58) rate *= 1.4;
  if (rate < 0.1) return null;
  const zoneCount = crystal.zones.length;
  crystal.habit = zoneCount >= 30 ? 'cathedral_blade' : (rate > 8 ? 'tabular' : 'prismatic');
  if (!crystal.twinned && rng.random() < 0.08) { crystal.twinned = true; crystal.twin_law = 'swallowtail {100}'; }
  conditions.fluid.Ca = Math.max(conditions.fluid.Ca - rate * 0.008, 0);
  conditions.fluid.S = Math.max(conditions.fluid.S - rate * 0.005, 0);
  return new GrowthZone({ step, temperature: conditions.temperature, thickness_um: rate, growth_rate: rate, note: 'water-clear selenite' });
}

// Adamite (Zn₂(AsO₄)(OH)) — supergene arsenate; cuproadamite green FL.
function grow_adamite(crystal, conditions, step) {
  const sigma = conditions.supersaturation_adamite();
  if (sigma < 1.0) {
    if (crystal.total_growth_um > 3 && conditions.fluid.pH < 3.5) {
      crystal.dissolved = true;
      const d = Math.min(4.0, crystal.total_growth_um * 0.12);
      conditions.fluid.Zn += d * 0.5;
      conditions.fluid.As += d * 0.3;
      return new GrowthZone({ step, temperature: conditions.temperature, thickness_um: -d, growth_rate: -d, note: `acid dissolution (pH ${conditions.fluid.pH.toFixed(1)})` });
    }
    return null;
  }
  const excess = sigma - 1.0;
  const rate = 4.0 * excess * rng.uniform(0.8, 1.2);
  if (rate < 0.1) return null;
  crystal.habit = 'prismatic';
  conditions.fluid.Zn = Math.max(conditions.fluid.Zn - rate * 0.006, 0);
  conditions.fluid.As = Math.max(conditions.fluid.As - rate * 0.004, 0);
  const trace_Cu = conditions.fluid.Cu * 0.05;
  const colorNote = trace_Cu > 0.5 ? 'cuproadamite (green, SW-UV fluorescent)' : 'yellow-green adamite';
  return new GrowthZone({ step, temperature: conditions.temperature, thickness_um: rate, growth_rate: rate, trace_Cu, note: colorNote });
}

// Mimetite (Pb₅(AsO₄)₃Cl) — the 'mimic' of pyromorphite; campylite barrels.
function grow_mimetite(crystal, conditions, step) {
  const sigma = conditions.supersaturation_mimetite();
  if (sigma < 1.0) {
    if (crystal.total_growth_um > 3 && conditions.fluid.pH < 3.0) {
      crystal.dissolved = true;
      const d = Math.min(4.0, crystal.total_growth_um * 0.10);
      conditions.fluid.Pb += d * 0.4;
      conditions.fluid.As += d * 0.3;
      return new GrowthZone({ step, temperature: conditions.temperature, thickness_um: -d, growth_rate: -d, note: `mimetite acid dissolution (pH ${conditions.fluid.pH.toFixed(1)})` });
    }
    return null;
  }
  const excess = sigma - 1.0;
  const rate = 4.0 * excess * rng.uniform(0.8, 1.2);
  if (rate < 0.1) return null;
  crystal.habit = (conditions.fluid.Cu > 2 && rng.random() < 0.4) ? 'campylite_barrel' : 'hexagonal_prism';
  conditions.fluid.Pb = Math.max(conditions.fluid.Pb - rate * 0.005, 0);
  conditions.fluid.As = Math.max(conditions.fluid.As - rate * 0.003, 0);
  conditions.fluid.Cl = Math.max(conditions.fluid.Cl - rate * 0.001, 0);
  return new GrowthZone({ step, temperature: conditions.temperature, thickness_um: rate, growth_rate: rate, note: crystal.habit === 'campylite_barrel' ? 'yellow-orange campylite barrels' : 'yellow-orange hexagonal prisms' });
}

const MINERAL_ENGINES = {
  quartz: grow_quartz,
  calcite: grow_calcite,
  sphalerite: grow_sphalerite,
  fluorite: grow_fluorite,
  pyrite: grow_pyrite,
  chalcopyrite: grow_chalcopyrite,
  hematite: grow_hematite,
  malachite: grow_malachite,
  uraninite: grow_uraninite,
  galena: grow_galena,
  smithsonite: grow_smithsonite,
  wulfenite: grow_wulfenite,
  goethite: grow_goethite,
  molybdenite: grow_molybdenite,
  feldspar: grow_feldspar,
  albite: grow_albite,
  selenite: grow_selenite,
  adamite: grow_adamite,
  mimetite: grow_mimetite,
};

// ============================================================
// EVENT SYSTEM
// ============================================================

function event_fluid_pulse(conditions) {
  conditions.fluid.SiO2 *= 1.8;
  conditions.fluid.Fe *= 3.0;
  conditions.fluid.Mn *= 2.5;
  conditions.fluid.pH -= 0.5;
  conditions.flow_rate = 5.0;
  return 'Fresh hydrothermal fluid floods the vug. Silica and metals spike.';
}

function event_cooling_pulse(conditions) {
  conditions.temperature -= 50;
  conditions.fluid.SiO2 *= 0.6;
  conditions.flow_rate = 3.0;
  return `Meteoric water incursion. Temperature drops to ${conditions.temperature.toFixed(0)}°C.`;
}

function event_tectonic_shock(conditions) {
  conditions.pressure += 0.5;
  conditions.temperature += 15;
  return 'Tectonic event. Pressure spike. Crystals may twin.';
}

function event_copper_injection(conditions) {
  conditions.fluid.Cu = 120.0;
  conditions.fluid.Fe += 40.0;
  conditions.fluid.S += 80.0;
  conditions.fluid.SiO2 += 200.0;
  conditions.fluid.O2 = 0.3;
  conditions.temperature += 30;
  conditions.flow_rate = 4.0;
  return `Copper-bearing magmatic fluid surges into the vug. Cu spikes to ${conditions.fluid.Cu.toFixed(0)} ppm. T rises to ${conditions.temperature.toFixed(0)}°C. Reducing conditions — sulfides stable.`;
}

function event_oxidation(conditions) {
  conditions.fluid.O2 = 1.8;
  conditions.fluid.S *= 0.3;
  conditions.temperature -= 40;
  return `Oxidizing meteoric water infiltrates. Sulfides becoming unstable. T drops to ${conditions.temperature.toFixed(0)}°C.`;
}

function event_acidify(conditions) {
  conditions.fluid.pH -= 2.0;
  conditions.fluid.pH = Math.max(conditions.fluid.pH, 2.0);
  return `Acidic fluid incursion. pH drops to ${conditions.fluid.pH.toFixed(1)}. Carbonates becoming unstable — calcite may dissolve.`;
}

function event_alkalinize(conditions) {
  conditions.fluid.pH += 2.0;
  conditions.fluid.pH = Math.min(conditions.fluid.pH, 10.0);
  return `Alkaline fluid incursion. pH rises to ${conditions.fluid.pH.toFixed(1)}. Carbonate precipitation favored.`;
}

function event_fluid_mixing(conditions) {
  // Phase-3: sync with vugg.py — F bumped 15→40 (Cave-in-Rock fluid-inclusion
  // data) so fluorite actually crosses σ=1.2. Pb added so galena nucleates.
  conditions.fluid.Zn = 150.0;
  conditions.fluid.S = 120.0;
  conditions.fluid.Ca += 100.0;
  conditions.fluid.F += 40.0;
  conditions.fluid.Pb += 25.0;
  conditions.fluid.Fe += 30.0;
  conditions.temperature -= 20;
  return 'Fluid mixing event. Metal-bearing brine meets sulfur-bearing groundwater. Sphalerite, fluorite, and galena become possible.';
}

// ============================================================
// SCENARIOS
// ============================================================

function scenario_cooling() {
  const conditions = new VugConditions({
    temperature: 380.0, pressure: 1.5,
    fluid: new FluidChemistry({ SiO2: 600, Ca: 150, CO3: 100, Fe: 8, Mn: 3, Ti: 0.8, Al: 4 })
  });
  return { conditions, events: [], defaultSteps: 100 };
}

function scenario_pulse() {
  const conditions = new VugConditions({
    temperature: 350.0, pressure: 1.2,
    fluid: new FluidChemistry({ SiO2: 500, Ca: 200, CO3: 120, Fe: 5, Mn: 2, Ti: 0.5, Al: 3 })
  });
  const events = [
    { step: 40, name: 'Fluid Pulse', description: 'Fresh hydrothermal fluid', apply_fn: event_fluid_pulse },
    { step: 70, name: 'Cooling Pulse', description: 'Meteoric water mixing', apply_fn: event_cooling_pulse },
  ];
  return { conditions, events, defaultSteps: 100 };
}

function scenario_mvt() {
  const conditions = new VugConditions({
    temperature: 180.0, pressure: 0.3,
    fluid: new FluidChemistry({
      SiO2: 100, Ca: 300, CO3: 250, Fe: 15, Mn: 8,
      Zn: 0, S: 0, F: 5, Pb: 40, pH: 7.2, salinity: 15.0
    })
  });
  const events = [
    { step: 20, name: 'Fluid Mixing', description: 'Brine meets groundwater', apply_fn: event_fluid_mixing },
    { step: 60, name: 'Second Pulse', description: 'Another mixing event', apply_fn: event_fluid_pulse },
    { step: 80, name: 'Tectonic', description: 'Minor seismic event', apply_fn: event_tectonic_shock },
  ];
  return { conditions, events, defaultSteps: 120 };
}

function scenario_porphyry() {
  const conditions = new VugConditions({
    temperature: 400.0, pressure: 2.0,
    fluid: new FluidChemistry({
      SiO2: 700, Ca: 80, CO3: 50, Fe: 30, Mn: 2,
      Zn: 0, S: 60, F: 5, Cu: 0, O2: 0.2,
      pH: 4.5, salinity: 10.0
    })
  });
  const events = [
    { step: 25, name: 'Copper Pulse', description: 'Magmatic copper fluid arrives', apply_fn: event_copper_injection },
    { step: 60, name: 'Second Cu Pulse', description: 'Another copper surge', apply_fn: event_copper_injection },
    { step: 85, name: 'Oxidation', description: 'Meteoric water infiltrates', apply_fn: event_oxidation },
    { step: 95, name: 'Cooling', description: 'Rapid cooling event', apply_fn: event_cooling_pulse },
  ];
  return { conditions, events, defaultSteps: 120 };
}

function scenario_reactive_wall() {
  const conditions = new VugConditions({
    temperature: 140.0, pressure: 0.2,
    fluid: new FluidChemistry({
      SiO2: 50, Ca: 250, CO3: 200, Fe: 8, Mn: 5,
      Zn: 80, S: 60, F: 8, pH: 7.0, salinity: 18.0
    }),
    wall: new VugWall({
      composition: 'limestone',
      thickness_mm: 500.0,
      vug_diameter_mm: 40.0,
      wall_Fe_ppm: 3000.0,
      wall_Mn_ppm: 800.0,
    })
  });

  function acid_pulse_1(cond) {
    cond.fluid.pH = 3.5;
    cond.fluid.S += 40.0;
    cond.fluid.Zn += 60.0;
    cond.fluid.Fe += 15.0;
    cond.flow_rate = 4.0;
    return 'CO₂-saturated brine surges into the vug. pH crashes to 3.5. The limestone walls begin to fizz — carbonate dissolving on contact.';
  }

  function acid_pulse_2(cond) {
    cond.fluid.pH = 3.0;
    cond.fluid.S += 50.0;
    cond.fluid.Zn += 80.0;
    cond.fluid.Fe += 25.0;
    cond.fluid.Mn += 10.0;
    cond.flow_rate = 5.0;
    return 'Second acid pulse — stronger than the first. pH drops to 3.0. Metal-bearing brine floods the vug. The walls are being eaten alive, but every Ca²⁺ released is a future growth band waiting to happen.';
  }

  function acid_pulse_3(cond) {
    cond.fluid.pH = 4.0;
    cond.fluid.S += 20.0;
    cond.fluid.Zn += 30.0;
    cond.flow_rate = 3.0;
    return 'Third acid pulse — weaker now. pH only drops to 4.0. The fluid system is exhausting. But the wall still has carbonate to give.';
  }

  function seal_event(cond) {
    cond.flow_rate = 0.1;
    cond.fluid.pH += 0.5;
    cond.fluid.pH = Math.min(cond.fluid.pH, 8.0);
    return 'The feeding fracture seals. Flow stops. The vug becomes a closed system. Whatever\'s dissolved will precipitate until equilibrium.';
  }

  const events = [
    { step: 15, name: 'First Acid Pulse', description: 'CO₂-saturated brine', apply_fn: acid_pulse_1 },
    { step: 40, name: 'Second Acid Pulse', description: 'Stronger metal-bearing brine', apply_fn: acid_pulse_2 },
    { step: 70, name: 'Third Acid Pulse', description: 'Weakening system', apply_fn: acid_pulse_3 },
    { step: 90, name: 'Fracture Seal', description: 'Flow stops', apply_fn: seal_event },
  ];

  return { conditions, events, defaultSteps: 120 };
}

function scenario_radioactive_pegmatite() {
  // Pegmatitic fluids are silica-saturated melts — SiO2 must be well above
  // equilibrium (eq at 600°C ≈ 6000 ppm in our model). Real pegmatites
  // have extreme silica activity. U and Pb for uraninite + galena.
  const conditions = new VugConditions({
    temperature: 600.0, pressure: 2.0,
    fluid: new FluidChemistry({
      SiO2: 12000, Ca: 50, CO3: 20, Fe: 60, Mn: 8,
      Zn: 0, S: 40, F: 25, Cu: 0, U: 150, Pb: 30,
      O2: 0, pH: 6.5, salinity: 8.0
    })
  });
  const events = [
    { step: 20, name: 'Pegmatite Crystallization', description: 'Main crystallization pulse', apply_fn: (cond) => {
      cond.temperature = 450;
      cond.fluid.SiO2 += 3000; // late-stage silica release from melt
      return 'The pegmatite melt differentiates. Volatile-rich residual fluid floods the pocket. Quartz begins to grow in earnest — large, clear crystals claiming space. Uraninite cubes nucleate where uranium concentration is highest.';
    }},
    { step: 50, name: 'Deep Time', description: 'Eons pass — radiation accumulates', apply_fn: (cond) => {
      cond.temperature = 300;
      return 'Deep time passes. The uraninite sits in its cradle of cooling rock, silently emitting alpha particles. Each decay transmutes one atom of uranium into lead. The quartz growing nearby doesn\'t know it yet, but it\'s darkening.';
    }},
    { step: 80, name: 'Oxidizing Fluids', description: 'Late-stage meteoric water', apply_fn: (cond) => {
      cond.fluid.O2 += 0.8;
      cond.temperature = 120;
      cond.flow_rate = 1.5;
      return 'Oxidizing meteoric fluids seep through fractures. The reducing environment shifts. Sulfides become unstable. The uraninite begins to weather — pitchy edges yellowing as U⁴⁺ goes back into solution as soluble uranyl ion.';
    }},
    { step: 100, name: 'Final Cooling', description: 'System approaches ambient', apply_fn: (cond) => {
      cond.temperature = 50;
      cond.flow_rate = 0.1;
      return 'The system cools to near-ambient. What remains is a pegmatite pocket: black uraninite cubes, smoky quartz darkened by radiation, and galena crystallized from the lead that uranium became. Time wrote this assemblage. Chemistry just held the pen.';
    }},
  ];
  return { conditions, events, defaultSteps: 120 };
}

const SCENARIOS = { cooling: scenario_cooling, pulse: scenario_pulse, mvt: scenario_mvt, porphyry: scenario_porphyry, reactive_wall: scenario_reactive_wall, radioactive_pegmatite: scenario_radioactive_pegmatite };

// ============================================================
// SIMULATION ENGINE
// ============================================================

class VugSimulator {
  constructor(conditions, events) {
    this.conditions = conditions;
    this._startTemp = conditions.temperature; // remember initial T for thermal pulse ceiling
    this.events = (events || []).slice().sort((a, b) => a.step - b.step);
    this.crystals = [];
    this.crystal_counter = 0;
    this.step = 0;
    this.log = [];
  }

  nucleate(mineral, position = 'vug wall') {
    this.crystal_counter++;
    const crystal = new Crystal({
      mineral, crystal_id: this.crystal_counter,
      nucleation_step: this.step,
      nucleation_temp: this.conditions.temperature,
      position
    });
    if (mineral === 'quartz') {
      crystal.habit = 'prismatic';
      crystal.dominant_forms = ['m{100} prism', 'r{101} rhombohedron'];
    } else if (mineral === 'calcite') {
      crystal.habit = 'rhombohedral';
      crystal.dominant_forms = ['e{104} rhombohedron'];
    } else if (mineral === 'sphalerite') {
      crystal.habit = 'tetrahedral';
      crystal.dominant_forms = ['{111} tetrahedron'];
    } else if (mineral === 'fluorite') {
      crystal.habit = 'cubic';
      crystal.dominant_forms = ['{100} cube'];
    } else if (mineral === 'pyrite') {
      crystal.habit = 'cubic';
      crystal.dominant_forms = ['{100} cube'];
    } else if (mineral === 'chalcopyrite') {
      crystal.habit = 'disphenoidal';
      crystal.dominant_forms = ['{112} disphenoid'];
    } else if (mineral === 'hematite') {
      crystal.habit = 'specular';
      crystal.dominant_forms = ['{001} basal plates'];
    } else if (mineral === 'malachite') {
      crystal.habit = 'botryoidal';
      crystal.dominant_forms = ['botryoidal masses'];
    } else if (mineral === 'uraninite') {
      crystal.habit = 'cubic';
      crystal.dominant_forms = ['{100} cube', '{111} octahedron'];
    } else if (mineral === 'galena') {
      crystal.habit = 'cubic';
      crystal.dominant_forms = ['{100} cube', '{111} octahedron'];
    } else if (mineral === 'goethite') {
      crystal.habit = 'fibrous_acicular';
      crystal.dominant_forms = ['radiating needles'];
    }
    this.crystals.push(crystal);
    return crystal;
  }

  check_nucleation() {
    const sigma_q = this.conditions.supersaturation_quartz();
    const existing_quartz = this.crystals.filter(c => c.mineral === 'quartz' && c.active);
    if (sigma_q > 1.2 && existing_quartz.length < 3) {
      if (!existing_quartz.length || (sigma_q > 2.0 && rng.random() < 0.3)) {
        const c = this.nucleate('quartz');
        this.log.push(`  ✦ NUCLEATION: Quartz #${c.crystal_id} on ${c.position} (T=${this.conditions.temperature.toFixed(0)}°C, σ=${sigma_q.toFixed(2)})`);
      }
    }

    const sigma_c = this.conditions.supersaturation_calcite();
    const existing_calcite = this.crystals.filter(c => c.mineral === 'calcite' && c.active);
    if (sigma_c > 1.3 && !existing_calcite.length) {
      const c = this.nucleate('calcite');
      this.log.push(`  ✦ NUCLEATION: Calcite #${c.crystal_id} on ${c.position} (T=${this.conditions.temperature.toFixed(0)}°C, σ=${sigma_c.toFixed(2)})`);
    }

    const sigma_s = this.conditions.supersaturation_sphalerite();
    const existing_sph = this.crystals.filter(c => c.mineral === 'sphalerite' && c.active);
    if (sigma_s > 1.0 && !existing_sph.length) {
      const c = this.nucleate('sphalerite', 'vug wall');
      this.log.push(`  ✦ NUCLEATION: Sphalerite #${c.crystal_id} on ${c.position} (T=${this.conditions.temperature.toFixed(0)}°C, σ=${sigma_s.toFixed(2)})`);
    }

    const sigma_f = this.conditions.supersaturation_fluorite();
    const existing_fl = this.crystals.filter(c => c.mineral === 'fluorite' && c.active);
    if (sigma_f > 1.2 && !existing_fl.length) {
      const c = this.nucleate('fluorite', 'vug wall');
      this.log.push(`  ✦ NUCLEATION: Fluorite #${c.crystal_id} on ${c.position}`);
    }

    // Pyrite nucleation
    const sigma_py = this.conditions.supersaturation_pyrite();
    const existing_py = this.crystals.filter(c => c.mineral === 'pyrite' && c.active);
    if (sigma_py > 1.0 && !existing_py.length) {
      let pos = 'vug wall';
      const existing_sph2 = this.crystals.filter(c => c.mineral === 'sphalerite' && c.active);
      if (existing_sph2.length && rng.random() < 0.5) {
        pos = `on sphalerite #${existing_sph2[0].crystal_id}`;
      }
      const c = this.nucleate('pyrite', pos);
      this.log.push(`  ✦ NUCLEATION: Pyrite #${c.crystal_id} on ${c.position} (T=${this.conditions.temperature.toFixed(0)}°C, σ=${sigma_py.toFixed(2)})`);
    }

    // Chalcopyrite nucleation
    const sigma_cp = this.conditions.supersaturation_chalcopyrite();
    const existing_cp = this.crystals.filter(c => c.mineral === 'chalcopyrite' && c.active);
    if (sigma_cp > 1.0 && !existing_cp.length) {
      let pos = 'vug wall';
      if (existing_py.length && rng.random() < 0.4) {
        pos = `on pyrite #${existing_py[0].crystal_id}`;
      }
      const c = this.nucleate('chalcopyrite', pos);
      this.log.push(`  ✦ NUCLEATION: Chalcopyrite #${c.crystal_id} on ${c.position} (T=${this.conditions.temperature.toFixed(0)}°C, σ=${sigma_cp.toFixed(2)})`);
    }

    // Hematite nucleation — needs sigma > 1.2 (harder to nucleate)
    const sigma_hem = this.conditions.supersaturation_hematite();
    const existing_hem = this.crystals.filter(c => c.mineral === 'hematite' && c.active);
    const total_hem = this.crystals.filter(c => c.mineral === 'hematite').length;
    if (sigma_hem > 1.2 && !existing_hem.length && total_hem < 3) {
      let pos = 'vug wall';
      if (existing_quartz.length && rng.random() < 0.4) {
        pos = `on quartz #${existing_quartz[0].crystal_id}`;
      }
      const c = this.nucleate('hematite', pos);
      this.log.push(`  ✦ NUCLEATION: Hematite #${c.crystal_id} on ${c.position} (T=${this.conditions.temperature.toFixed(0)}°C, σ=${sigma_hem.toFixed(2)})`);
    }

    // Malachite nucleation — needs sigma > 1.0
    const sigma_mal = this.conditions.supersaturation_malachite();
    const existing_mal = this.crystals.filter(c => c.mineral === 'malachite' && c.active);
    const total_mal = this.crystals.filter(c => c.mineral === 'malachite').length;
    if (sigma_mal > 1.0 && !existing_mal.length && total_mal < 3) {
      let pos = 'vug wall';
      // Preference for chalcopyrite surface (classic oxidation paragenesis!)
      const dissolving_cp = this.crystals.filter(c => c.mineral === 'chalcopyrite' && c.dissolved);
      const active_cp_all = this.crystals.filter(c => c.mineral === 'chalcopyrite');
      if (dissolving_cp.length && rng.random() < 0.7) {
        pos = `on chalcopyrite #${dissolving_cp[0].crystal_id}`;
      } else if (active_cp_all.length && rng.random() < 0.4) {
        pos = `on chalcopyrite #${active_cp_all[0].crystal_id}`;
      } else if (existing_hem.length && rng.random() < 0.3) {
        pos = `on hematite #${existing_hem[0].crystal_id}`;
      }
      const c = this.nucleate('malachite', pos);
      this.log.push(`  ✦ NUCLEATION: Malachite #${c.crystal_id} on ${c.position} (T=${this.conditions.temperature.toFixed(0)}°C, σ=${sigma_mal.toFixed(2)})`);
    }

    // Uraninite nucleation — needs sigma > 1.5, max 3 active / 5 total
    const sigma_urn = this.conditions.supersaturation_uraninite();
    const existing_urn = this.crystals.filter(c => c.mineral === 'uraninite' && c.active);
    const total_urn = this.crystals.filter(c => c.mineral === 'uraninite').length;
    if (sigma_urn > 1.5 && existing_urn.length < 3 && total_urn < 5) {
      if (!existing_urn.length || (sigma_urn > 2.5 && rng.random() < 0.3)) {
        const c = this.nucleate('uraninite', 'vug wall');
        this.log.push(`  ✦ NUCLEATION: ☢️ Uraninite #${c.crystal_id} on ${c.position} (T=${this.conditions.temperature.toFixed(0)}°C, σ=${sigma_urn.toFixed(2)}) — radioactive!`);
      }
    }

    // Smithsonite nucleation — oxidized Zn environment
    const sigma_sm = this.conditions.supersaturation_smithsonite();
    const existing_sm = this.crystals.filter(c => c.mineral === 'smithsonite' && c.active);
    const total_sm = this.crystals.filter(c => c.mineral === 'smithsonite').length;
    if (sigma_sm > 1.0 && !existing_sm.length && total_sm < 3) {
      let pos = 'vug wall';
      const dissolved_sph = this.crystals.filter(c => c.mineral === 'sphalerite' && c.dissolved);
      const any_sph = this.crystals.filter(c => c.mineral === 'sphalerite');
      if (dissolved_sph.length && rng.random() < 0.7) pos = `on sphalerite #${dissolved_sph[0].crystal_id} (oxidized)`;
      else if (any_sph.length && rng.random() < 0.3) pos = `on sphalerite #${any_sph[0].crystal_id}`;
      const c = this.nucleate('smithsonite', pos);
      this.log.push(`  ✦ NUCLEATION: Smithsonite #${c.crystal_id} on ${c.position} (T=${this.conditions.temperature.toFixed(0)}°C, σ=${sigma_sm.toFixed(2)}) — zinc carbonate from oxidized sphalerite`);
    }

    // Wulfenite nucleation — RARE: needs Pb AND Mo
    const sigma_wulf = this.conditions.supersaturation_wulfenite();
    const existing_wulf = this.crystals.filter(c => c.mineral === 'wulfenite' && c.active);
    const total_wulf = this.crystals.filter(c => c.mineral === 'wulfenite').length;
    if (sigma_wulf > 1.2 && !existing_wulf.length && total_wulf < 2) {
      let pos = 'vug wall';
      const dissolved_gal = this.crystals.filter(c => c.mineral === 'galena' && c.dissolved);
      const any_gal = this.crystals.filter(c => c.mineral === 'galena');
      if (dissolved_gal.length && rng.random() < 0.7) pos = `on galena #${dissolved_gal[0].crystal_id} (oxidized)`;
      else if (any_gal.length && rng.random() < 0.3) pos = `on galena #${any_gal[0].crystal_id}`;
      const c = this.nucleate('wulfenite', pos);
      this.log.push(`  ✦ NUCLEATION: 🟠 Wulfenite #${c.crystal_id} on ${c.position} (T=${this.conditions.temperature.toFixed(0)}°C, σ=${sigma_wulf.toFixed(2)}) — the collector's prize!`);
    }

    // Galena nucleation — needs sigma > 1.0, max 4 active / 8 total
    const sigma_gal = this.conditions.supersaturation_galena();
    const existing_gal = this.crystals.filter(c => c.mineral === 'galena' && c.active);
    const total_gal = this.crystals.filter(c => c.mineral === 'galena').length;
    if (sigma_gal > 1.0 && existing_gal.length < 4 && total_gal < 8) {
      if (!existing_gal.length || (sigma_gal > 2.0 && rng.random() < 0.3)) {
        let pos = 'vug wall';
        const existing_sph3 = this.crystals.filter(c => c.mineral === 'sphalerite' && c.active);
        if (existing_sph3.length && rng.random() < 0.4) {
          pos = `on sphalerite #${existing_sph3[0].crystal_id}`;
        }
        const c = this.nucleate('galena', pos);
        this.log.push(`  ✦ NUCLEATION: Galena #${c.crystal_id} on ${c.position} (T=${this.conditions.temperature.toFixed(0)}°C, σ=${sigma_gal.toFixed(2)})`);
      }
    }

    // Goethite nucleation — the ghost mineral, now real.
    const sigma_goe = this.conditions.supersaturation_goethite();
    const existing_goe = this.crystals.filter(c => c.mineral === 'goethite' && c.active);
    const total_goe = this.crystals.filter(c => c.mineral === 'goethite').length;
    if (sigma_goe > 1.0 && !existing_goe.length && total_goe < 3) {
      let pos = 'vug wall';
      const dissolving_py = this.crystals.filter(c => c.mineral === 'pyrite' && c.dissolved);
      const dissolving_cp = this.crystals.filter(c => c.mineral === 'chalcopyrite' && c.dissolved);
      const active_hem = this.crystals.filter(c => c.mineral === 'hematite' && c.active);
      if (dissolving_py.length && rng.random() < 0.7) pos = `pseudomorph after pyrite #${dissolving_py[0].crystal_id}`;
      else if (dissolving_cp.length && rng.random() < 0.5) pos = `pseudomorph after chalcopyrite #${dissolving_cp[0].crystal_id}`;
      else if (active_hem.length && rng.random() < 0.3) pos = `on hematite #${active_hem[0].crystal_id}`;
      const c = this.nucleate('goethite', pos);
      this.log.push(`  ✦ NUCLEATION: Goethite #${c.crystal_id} on ${c.position} (T=${this.conditions.temperature.toFixed(0)}°C, σ=${sigma_goe.toFixed(2)})`);
    }

    // Phase-3 ports: molybdenite, feldspar, albite, selenite, adamite, mimetite
    const sigma_moly = this.conditions.supersaturation_molybdenite();
    const total_moly = this.crystals.filter(c => c.mineral === 'molybdenite').length;
    if (sigma_moly > 1.5 && total_moly < 3 && rng.random() < 0.15) {
      const c = this.nucleate('molybdenite', 'vug wall');
      this.log.push(`  ✦ NUCLEATION: Molybdenite #${c.crystal_id} on ${c.position} (T=${this.conditions.temperature.toFixed(0)}°C, σ=${sigma_moly.toFixed(2)})`);
    }

    const sigma_feld = this.conditions.supersaturation_feldspar();
    const existing_feld = this.crystals.filter(c => c.mineral === 'feldspar' && c.active);
    if (sigma_feld > 1.0 && !existing_feld.length) {
      const c = this.nucleate('feldspar', 'vug wall');
      this.log.push(`  ✦ NUCLEATION: Feldspar #${c.crystal_id} on ${c.position} (T=${this.conditions.temperature.toFixed(0)}°C, σ=${sigma_feld.toFixed(2)})`);
    }

    const sigma_alb = this.conditions.supersaturation_albite();
    const existing_alb = this.crystals.filter(c => c.mineral === 'albite' && c.active);
    if (sigma_alb > 1.0 && !existing_alb.length) {
      let pos = 'vug wall';
      if (existing_feld.length && rng.random() < 0.5) pos = `on feldspar #${existing_feld[0].crystal_id}`;
      const c = this.nucleate('albite', pos);
      this.log.push(`  ✦ NUCLEATION: Albite #${c.crystal_id} on ${c.position} (T=${this.conditions.temperature.toFixed(0)}°C, σ=${sigma_alb.toFixed(2)})`);
    }

    const sigma_sel = this.conditions.supersaturation_selenite();
    const total_sel = this.crystals.filter(c => c.mineral === 'selenite').length;
    if (sigma_sel > 1.0 && total_sel < 4 && rng.random() < 0.12) {
      const c = this.nucleate('selenite', 'vug wall');
      this.log.push(`  ✦ NUCLEATION: Selenite #${c.crystal_id} on ${c.position} (T=${this.conditions.temperature.toFixed(0)}°C, σ=${sigma_sel.toFixed(2)})`);
    }

    const sigma_adam = this.conditions.supersaturation_adamite();
    const existing_adam = this.crystals.filter(c => c.mineral === 'adamite' && c.active);
    if (sigma_adam > 1.0 && !existing_adam.length) {
      let pos = 'vug wall';
      const existing_goe_adam = this.crystals.filter(c => c.mineral === 'goethite' && c.active);
      if (existing_goe_adam.length && rng.random() < 0.6) pos = `on goethite #${existing_goe_adam[0].crystal_id}`;
      const c = this.nucleate('adamite', pos);
      this.log.push(`  ✦ NUCLEATION: Adamite #${c.crystal_id} on ${c.position} (T=${this.conditions.temperature.toFixed(0)}°C, σ=${sigma_adam.toFixed(2)})`);
    }

    const sigma_mim = this.conditions.supersaturation_mimetite();
    const existing_mim = this.crystals.filter(c => c.mineral === 'mimetite' && c.active);
    if (sigma_mim > 1.0 && !existing_mim.length) {
      let pos = 'vug wall';
      const existing_gal_mim = this.crystals.filter(c => c.mineral === 'galena');
      if (existing_gal_mim.length && rng.random() < 0.6) pos = `on galena #${existing_gal_mim[0].crystal_id}`;
      const c = this.nucleate('mimetite', pos);
      this.log.push(`  ✦ NUCLEATION: Mimetite #${c.crystal_id} on ${c.position} (T=${this.conditions.temperature.toFixed(0)}°C, σ=${sigma_mim.toFixed(2)})`);
    }
  }

  apply_events() {
    for (const event of this.events) {
      if (event.step === this.step) {
        const result = event.apply_fn(this.conditions);
        this.log.push('');
        this.log.push(`  ⚡ EVENT: ${event.name}`);
        this.log.push(`     ${result}`);
        this.log.push('');
      }
    }
  }

  dissolve_wall() {
    const wall = this.conditions.wall;
    if (this.conditions.fluid.pH >= 5.5) return;

    const acid_strength = 5.5 - this.conditions.fluid.pH;
    const pre_sigma_cal = this.conditions.supersaturation_calcite();
    const pre_Ca = this.conditions.fluid.Ca;

    const result = wall.dissolve(acid_strength, this.conditions.fluid);

    if (result.dissolved) {
      const post_sigma_cal = this.conditions.supersaturation_calcite();

      this.log.push(`  🧱 WALL DISSOLUTION: ${result.rate_mm.toFixed(2)} mm of ${wall.composition} dissolved`);
      this.log.push(`     pH ${result.ph_before.toFixed(1)} → ${result.ph_after.toFixed(1)} (carbonate buffering)`);
      this.log.push(`     Released: Ca²⁺ +${result.ca_released.toFixed(0)} ppm, CO₃²⁻ +${result.co3_released.toFixed(0)} ppm, Fe +${result.fe_released.toFixed(1)}, Mn +${result.mn_released.toFixed(1)}`);
      this.log.push(`     Vug diameter: ${result.vug_diameter.toFixed(1)} mm (+${result.total_dissolved.toFixed(1)} mm total enlargement)`);

      if (post_sigma_cal > pre_sigma_cal * 1.3 && post_sigma_cal > 1.0) {
        this.log.push(`     ⚡ SUPERSATURATION SPIKE: σ(Cal) ${pre_sigma_cal.toFixed(2)} → ${post_sigma_cal.toFixed(2)} — rapid calcite growth expected!`);
      }
    }
  }

  ambient_cooling(rate = 1.5) {
    this.conditions.temperature -= rate * rng.uniform(0.8, 1.2);
    this.conditions.temperature = Math.max(this.conditions.temperature, 25);

    // ---- Thermal pulses: episodic fluid injection ----
    // Real hydrothermal systems don't cool monotonically. Hot fluid pulses
    // arrive through fractures — fast, dramatic, then bleed heat back out.
    // Probability scales with how far we've cooled (more fractures open as
    // rock contracts) and inversely with how hot we still are (already-hot
    // systems don't notice small pulses).
    const cooledFraction = 1 - (this.conditions.temperature - 25) / Math.max(this._startTemp || 400, 100);
    const pulseChance = 0.04 + cooledFraction * 0.06; // 4-10% per step
    if (rng.random() < pulseChance && this.conditions.temperature < (this._startTemp || 400) * 0.8) {
      // Spike: 30-150°C above current, but not above original start temp
      const spike = rng.uniform(30, 150);
      const newTemp = Math.min(this.conditions.temperature + spike, (this._startTemp || 400) * 0.95);
      const actualSpike = newTemp - this.conditions.temperature;
      if (actualSpike > 15) {
        this.conditions.temperature = newTemp;
        // Fresh fluid pulse brings chemistry
        this.conditions.fluid.SiO2 += rng.uniform(50, 300);
        this.conditions.fluid.Fe += rng.uniform(2, 15);
        this.conditions.fluid.Mn += rng.uniform(1, 5);
        this.conditions.flow_rate = rng.uniform(1.5, 3.0);
        // pH shift from new fluid (slightly acidic hydrothermal)
        this.conditions.fluid.pH = Math.max(4.0, this.conditions.fluid.pH - rng.uniform(0.3, 1.0));
        this.log.push(`  🌡️ THERMAL PULSE: +${actualSpike.toFixed(0)}°C — hot fluid injection through fracture! T=${newTemp.toFixed(0)}°C`);
        this.log.push(`     Fresh fluid: SiO₂↑, Fe↑, Mn↑, pH↓ — new growth expected`);
      }
    }

    // pH recovery toward carbonate-buffered equilibrium when not being actively acidified
    if (this.conditions.fluid.pH < 6.5 && this.conditions.flow_rate < 2.0) {
      this.conditions.fluid.pH += 0.1;
    }

    if (this.conditions.flow_rate > 1.0) this.conditions.flow_rate *= 0.9;
    const active_quartz = this.crystals.filter(c => c.mineral === 'quartz' && c.active);
    if (active_quartz.length) {
      const depletion = active_quartz.reduce((s, c) => s + (c.zones.length ? c.zones[c.zones.length - 1].thickness_um : 0), 0) * 0.1;
      this.conditions.fluid.SiO2 = Math.max(this.conditions.fluid.SiO2 - depletion, 10);
    }

    // Sulfide growth depletes Fe, S, Cu, Zn
    const active_sulfides = this.crystals.filter(c => (c.mineral === 'pyrite' || c.mineral === 'chalcopyrite' || c.mineral === 'sphalerite') && c.active);
    for (const c of active_sulfides) {
      if (c.zones.length) {
        const dep = c.zones[c.zones.length - 1].thickness_um * 0.05;
        this.conditions.fluid.S = Math.max(this.conditions.fluid.S - dep, 0);
        this.conditions.fluid.Fe = Math.max(this.conditions.fluid.Fe - dep * 0.5, 0);
        if (c.mineral === 'chalcopyrite') {
          this.conditions.fluid.Cu = Math.max(this.conditions.fluid.Cu - dep * 0.8, 0);
        }
        if (c.mineral === 'sphalerite') {
          this.conditions.fluid.Zn = Math.max(this.conditions.fluid.Zn - dep * 0.8, 0);
        }
      }
    }
  }

  run_step() {
    this.log = [];
    this.step++;
    this.apply_events();
    this.dissolve_wall();
    this.check_nucleation();
    for (const crystal of this.crystals) {
      if (!crystal.active) continue;

      // Universal max-size cap — fix for 321,248% runaway growth bug.
      const capCm = maxSizeCm(crystal.mineral);
      if (capCm != null && crystal.c_length_mm / 10.0 >= capCm) {
        crystal.active = false;
        this.log.push(`  ⛔ ${capitalize(crystal.mineral)} #${crystal.crystal_id}: reached size cap (${capCm} cm = 2× world record) — growth halts`);
        continue;
      }

      const engine = MINERAL_ENGINES[crystal.mineral];
      if (!engine) continue;
      const zone = engine(crystal, this.conditions, this.step);
      if (zone) {
        crystal.add_zone(zone);
        if (zone.thickness_um < 0) {
          this.log.push(`  ⬇ ${capitalize(crystal.mineral)} #${crystal.crystal_id}: DISSOLUTION ${zone.note}`);
        } else if (Math.abs(zone.thickness_um) > 0.5) {
          this.log.push(`  ▲ ${capitalize(crystal.mineral)} #${crystal.crystal_id}: ${crystal.describe_latest_zone()}`);
        }
      }
    }
    // ---- Radiation damage processing ----
    const active_uraninite = this.crystals.filter(c => c.mineral === 'uraninite' && c.active);
    if (active_uraninite.length) {
      if (!this.radiation_dose) this.radiation_dose = 0;
      if (!this._smoky_logged) this._smoky_logged = false;
      if (!this._metamict_logged) this._metamict_logged = false;

      for (const u_crystal of active_uraninite) {
        const u_size = u_crystal.c_length_mm;
        // Uraninite produces Pb into fluid via radioactive decay
        this.conditions.fluid.Pb += 0.1 * u_size;
        this.radiation_dose += 0.01 * u_size;

        // Radiation damages all OTHER crystals
        for (const other of this.crystals) {
          if (other === u_crystal || !other.active) continue;
          if (!other.radiation_damage) other.radiation_damage = 0;
          other.radiation_damage += 0.02 * u_size;

          // Smoky quartz check
          if (other.mineral === 'quartz' && other.radiation_damage > 0.3 && !this._smoky_logged) {
            this.log.push(`  ☢️ Quartz #${other.crystal_id} is turning smoky — radiation damage from nearby uraninite is displacing Al³⁺ in the lattice, creating color centers`);
            this._smoky_logged = true;
          }

          // Metamictization check
          if (other.radiation_damage > 0.8 && !this._metamict_logged) {
            this.log.push(`  ☢️ ${capitalize(other.mineral)} #${other.crystal_id} is becoming metamict — alpha radiation is destroying the crystal lattice`);
            this._metamict_logged = true;
          }
        }
      }
    }

    this.ambient_cooling();
    return this.log;
  }

  format_header() {
    const c = this.conditions;
    const sigma_q = c.supersaturation_quartz();
    const sigma_c = c.supersaturation_calcite();
    let wall_info = '';
    if (c.wall.total_dissolved_mm > 0) {
      wall_info = ` │ Vug: ${c.wall.vug_diameter_mm.toFixed(0)}mm (+${c.wall.total_dissolved_mm.toFixed(1)})`;
    }
    return `═══ Step ${String(this.step).padStart(3)} │ T=${this.conditions.temperature.toFixed(1).padStart(6)}°C │ P=${c.pressure.toFixed(2)} kbar │ pH=${c.fluid.pH.toFixed(1)} │ σ(Qz)=${sigma_q.toFixed(2)} σ(Cal)=${sigma_c.toFixed(2)}${wall_info} │ Fluid: ${c.fluid.describe()}`;
  }

  format_summary() {
    const lines = [];
    lines.push('');
    lines.push('═'.repeat(70));
    lines.push('FINAL VUG INVENTORY');
    lines.push('═'.repeat(70));

    // Vug wall stats if dissolution occurred
    const w = this.conditions.wall;
    if (w.total_dissolved_mm > 0) {
      const orig_diam = w.vug_diameter_mm - w.total_dissolved_mm * 2;
      lines.push('');
      lines.push('VUG CAVITY');
      lines.push(`  Host rock: ${w.composition}`);
      lines.push(`  Original diameter: ${orig_diam.toFixed(0)} mm`);
      lines.push(`  Final diameter: ${w.vug_diameter_mm.toFixed(0)} mm`);
      lines.push(`  Total wall dissolved: ${w.total_dissolved_mm.toFixed(1)} mm`);
      lines.push('  The acid made the room. The room grew the crystals.');
    }

    for (const c of this.crystals) {
      lines.push('');
      lines.push(`${c.mineral.toUpperCase()} #${c.crystal_id}`);
      lines.push(`  Nucleated: step ${c.nucleation_step} at ${c.nucleation_temp.toFixed(0)}°C`);
      lines.push(`  Position: ${c.position}`);
      lines.push(`  Morphology: ${c.describe_morphology()}`);
      lines.push(`  Growth zones: ${c.zones.length}`);
      lines.push(`  Total growth: ${c.total_growth_um.toFixed(0)} µm (${c.c_length_mm.toFixed(1)} mm)`);

      const fi_count = c.zones.filter(z => z.fluid_inclusion).length;
      if (fi_count) {
        const fi_types = [...new Set(c.zones.filter(z => z.fluid_inclusion).map(z => z.inclusion_type))];
        lines.push(`  Fluid inclusions: ${fi_count} (${fi_types.join(', ')})`);
      }
      if (c.twinned) lines.push(`  Twinning: ${c.twin_law}`);
      if (c.dissolved) lines.push(`  Note: partially dissolved (late-stage undersaturation)`);
      if (c.phantom_count > 0) {
        lines.push(`  Phantom boundaries: ${c.phantom_count} (dissolution surfaces preserved inside crystal)`);
      }

      // Provenance (for calcite with wall dissolution)
      if (c.mineral === 'calcite' && c.zones.length) {
        const wall_zones = c.zones.filter(z => z.ca_from_wall > 0.1);
        if (wall_zones.length) {
          const avg_wall = wall_zones.reduce((s, z) => s + z.ca_from_wall, 0) / wall_zones.length;
          const max_wall = Math.max(...wall_zones.map(z => z.ca_from_wall));
          lines.push(`  Provenance: ${wall_zones.length}/${c.zones.length} zones contain wall-derived Ca²⁺`);
          lines.push(`    Average wall contribution: ${(avg_wall * 100).toFixed(0)}%, peak: ${(max_wall * 100).toFixed(0)}%`);
          const first_wall_zone = c.zones.find(z => z.ca_from_wall > 0.1);
          if (first_wall_zone) {
            lines.push(`    Wall-derived Ca first appears at step ${first_wall_zone.step} (T=${first_wall_zone.temperature.toFixed(0)}°C)`);
          }
        }
      }

      const fl = c.predict_fluorescence();
      if (fl !== 'non-fluorescent') lines.push(`  Predicted UV fluorescence: ${fl}`);

      if (c.zones.length) {
        const temps = c.zones.map(z => z.temperature);
        const minT = Math.min(...temps), maxT = Math.max(...temps);
        lines.push(`  Growth temperature range: ${minT.toFixed(0)}–${maxT.toFixed(0)}°C`);
        if (c.mineral === 'quartz') {
          const ti_vals = c.zones.filter(z => z.trace_Ti > 0).map(z => z.trace_Ti);
          if (ti_vals.length) {
            const avg_ti = ti_vals.reduce((a, b) => a + b, 0) / ti_vals.length;
            lines.push(`  Avg Ti-in-quartz: ${avg_ti.toFixed(3)} ppm (TitaniQ range: ${minT.toFixed(0)}–${maxT.toFixed(0)}°C)`);
          }
        }
      }
    }

    lines.push('');
    lines.push('═'.repeat(70));

    const narrative = this.narrate();
    if (narrative) {
      lines.push('');
      lines.push('GEOLOGICAL HISTORY');
      lines.push('─'.repeat(70));
      lines.push(narrative);
      lines.push('═'.repeat(70));
    }

    return lines;
  }

  narrate() {
    if (!this.crystals.length) return 'The vug remained empty. No minerals precipitated under these conditions. The fluid passed through without leaving a trace — still too hot, too undersaturated, or too brief. Given more time, this story might begin differently.';

    const totalGrowth = this.crystals.reduce((sum, c) => sum + c.total_growth_um, 0);
    if (totalGrowth < 5) {
      return `The vug barely began its story. Over ${this.step} steps, conditions shifted but nothing had time to grow beyond a thin film on the cavity wall. This is the very beginning — the fluid is still finding its equilibrium. Run more steps to see what this vug becomes.`;
    }

    const paragraphs = [];
    const first_crystal = this.crystals[0];
    const start_T = first_crystal.nucleation_temp;
    const mineral_names = [...new Set(this.crystals.map(c => c.mineral))];

    let setting;
    if (start_T > 300) setting = 'deep hydrothermal';
    else if (start_T > 150) setting = 'moderate-temperature hydrothermal';
    else setting = 'low-temperature';

    let vug_growth = '';
    if (this.conditions.wall.total_dissolved_mm > 0) {
      const w = this.conditions.wall;
      vug_growth = ` The cavity itself expanded from ${(w.vug_diameter_mm - w.total_dissolved_mm * 2).toFixed(0)}mm to ${w.vug_diameter_mm.toFixed(0)}mm diameter as acid pulses dissolved ${w.total_dissolved_mm.toFixed(1)}mm of the ${w.composition} host rock.`;
    }

    paragraphs.push(
      `This vug records a ${setting} crystallization history beginning at ${start_T.toFixed(0)}°C. ${this.crystals.length} crystals grew across ${this.step} time steps, producing an assemblage of ${mineral_names.join(', ')}.${vug_growth}`
    );

    const first_step = Math.min(...this.crystals.map(c => c.nucleation_step));
    const first_minerals = this.crystals.filter(c => c.nucleation_step === first_step);

    for (const c of first_minerals) {
      if (c.mineral === 'calcite') {
        paragraphs.push(
          `Calcite was the first mineral to crystallize, nucleating on the vug wall at ${c.nucleation_temp.toFixed(0)}°C. ` + this._narrate_calcite(c)
        );
      } else if (c.mineral === 'quartz') {
        paragraphs.push(
          `Quartz nucleated first at ${c.nucleation_temp.toFixed(0)}°C on the vug wall. ` + this._narrate_quartz(c)
        );
      } else {
        paragraphs.push(`${capitalize(c.mineral)} nucleated at ${c.nucleation_temp.toFixed(0)}°C.`);
      }
    }

    const later_crystals = this.crystals.filter(c => c.nucleation_step > first_step);
    if (later_crystals.length) {
      const nuc_steps = [...new Set(later_crystals.map(c => c.nucleation_step))].sort((a, b) => a - b);
      for (const ns of nuc_steps) {
        const batch = later_crystals.filter(c => c.nucleation_step === ns);
        const batch_names = batch.map(c => c.mineral);
        let triggering_event = null;
        for (const e of this.events) {
          if (Math.abs(e.step - ns) <= 2) { triggering_event = e; break; }
        }

        if (triggering_event) {
          if (triggering_event.name.toLowerCase().includes('mixing')) {
            paragraphs.push(
              `A fluid mixing event at step ${triggering_event.step} transformed the vug's chemistry. ` + this._narrate_mixing_event(batch, triggering_event)
            );
          } else if (triggering_event.name.toLowerCase().includes('pulse')) {
            paragraphs.push(
              `A fresh pulse of hydrothermal fluid at step ${triggering_event.step} introduced new chemistry. ${[...new Set(batch_names)].map(capitalize).join(', ')} nucleated in response.`
            );
          } else if (triggering_event.name.toLowerCase().includes('tectonic')) {
            paragraphs.push(
              `A tectonic event at step ${triggering_event.step} produced a pressure spike.` + this._narrate_tectonic(batch)
            );
          }
        } else {
          paragraphs.push(
            `As temperature continued to fall, ${[...new Set(batch_names)].join(' and ')} nucleated at step ${ns} (${batch[0].nucleation_temp.toFixed(0)}°C).`
          );
        }
      }
    }

    // Dispatch via this['_narrate_' + mineral] — spec says every mineral has one.
    const significant = this.crystals.filter(c => c.total_growth_um > 100);
    for (const c of significant) {
      const fn = this[`_narrate_${c.mineral}`];
      const story = typeof fn === 'function' ? fn.call(this, c) : '';
      if (story && !first_minerals.includes(c)) paragraphs.push(story);
    }

    // Phantom growth narrative
    const phantom_crystals = this.crystals.filter(c => c.phantom_count > 0);
    for (const c of phantom_crystals) {
      if (c.phantom_count >= 2) {
        paragraphs.push(
          `${capitalize(c.mineral)} #${c.crystal_id} shows ${c.phantom_count} phantom boundaries — internal surfaces where acid dissolved the crystal before new growth covered the damage. Each phantom preserves the shape of the crystal at the moment the acid arrived. In a polished section, these appear as ghost outlines nested inside the final crystal — the crystal's autobiography, written in dissolution and regrowth.`
        );
      } else if (c.phantom_count === 1) {
        paragraphs.push(
          `${capitalize(c.mineral)} #${c.crystal_id} contains a single phantom surface — a dissolution boundary where the crystal was partially eaten and then regrew over the wound. The phantom preserves the crystal's earlier shape as a ghost outline inside the final form.`
        );
      }
    }

    // Provenance narrative for calcite
    for (const c of this.crystals) {
      if (c.mineral === 'calcite' && c.zones.length) {
        const wall_zones = c.zones.filter(z => z.ca_from_wall > 0.3);
        const fluid_zones = c.zones.filter(z => z.ca_from_wall < 0.1 && z.thickness_um > 0);
        if (wall_zones.length && fluid_zones.length) {
          paragraphs.push(
            `The calcite tells two stories in one crystal. Early growth zones are built from the original fluid — Ca²⁺ that traveled through the basin. Later zones are built from recycled wall rock — limestone that was dissolved by acid and reprecipitated. The trace element signature shifts at the boundary: wall-derived zones carry the host rock's Fe and Mn signature, distinct from the fluid-derived zones. A microprobe traverse across this crystal would show the moment the vug started eating itself to feed its children.`
          );
        }
      }
    }

    // Radiation narrative
    if (this.radiation_dose > 0) {
      const smoky_crystals = this.crystals.filter(c => c.mineral === 'quartz' && c.radiation_damage > 0.3);
      const metamict_crystals = this.crystals.filter(c => c.radiation_damage > 0.8);
      let rad_text = `☢️ Radiation has left its mark on this vug. Total accumulated dose: ${this.radiation_dose.toFixed(2)}.`;
      if (smoky_crystals.length) {
        rad_text += ` ${smoky_crystals.length} quartz crystal${smoky_crystals.length > 1 ? 's have' : ' has'} turned smoky — aluminum impurities in the lattice were knocked loose by alpha particles from nearby uraninite, creating the color centers that give smoky quartz its signature darkness.`;
      }
      if (metamict_crystals.length) {
        rad_text += ` ${metamict_crystals.length} crystal${metamict_crystals.length > 1 ? 's have' : ' has'} become metamict — the crystal structure itself is destroyed by accumulated radiation damage, leaving an amorphous glass where ordered atoms once stood.`;
      }
      const uraninite_crystals = this.crystals.filter(c => c.mineral === 'uraninite');
      const galena_from_decay = this.crystals.filter(c => c.mineral === 'galena');
      if (uraninite_crystals.length && galena_from_decay.length) {
        rad_text += ` The galena in this assemblage crystallized in part from lead produced by uraninite decay — U-238 → Pb-206, the same chain used to date the age of rocks.`;
      }
      paragraphs.push(rad_text);
    }

    paragraphs.push(this._narrate_collectors_view());
    return paragraphs.join('\n\n');
  }

  _narrate_calcite(c) {
    const parts = [];
    if (c.zones.length) {
      const mn_zones = c.zones.filter(z => z.trace_Mn > 1.0 && z.trace_Fe < 2.0);
      const fe_zones = c.zones.filter(z => z.trace_Fe > 3.0);
      if (mn_zones.length && fe_zones.length) {
        const mn_end = mn_zones[mn_zones.length - 1].step;
        const fe_start = fe_zones[0].step;
        if (fe_start > mn_end - 5) {
          parts.push(`Early growth zones are manganese-rich and would fluoresce orange under UV light. After step ${fe_start}, iron flooded the system and quenched the fluorescence — later zones would appear dark under cathodoluminescence. The boundary between glowing and dark records the moment the fluid chemistry changed.`);
        }
      } else if (mn_zones.length) {
        parts.push(`The crystal incorporated manganese throughout growth and would fluoresce orange under shortwave UV — a classic Mn²⁺-activated calcite.`);
      }
    }
    if (c.twinned) {
      parts.push(`The crystal is twinned on ${c.twin_law}, a common deformation twin in calcite that can form during growth or post-crystallization stress.`);
    }
    const size_desc = c.c_length_mm < 0.5 ? 'microscopic' : c.c_length_mm < 2 ? 'small' : 'well-developed';
    parts.push(`Final size: ${size_desc} (${c.c_length_mm.toFixed(1)} mm), ${c.habit} habit.`);
    return parts.join(' ');
  }

  _narrate_quartz(c) {
    const parts = [];
    if (!c.zones.length) return `Quartz #${c.crystal_id} nucleated but failed to develop — growth kinetics were too slow at ${c.nucleation_temp.toFixed(0)}°C.`;

    const ti_vals = c.zones.filter(z => z.trace_Ti > 0).map(z => z.trace_Ti);
    if (ti_vals.length && Math.max(...ti_vals) > 0.01) {
      parts.push(`Titanium incorporation decreases through the growth zones from ${Math.max(...ti_vals).toFixed(3)} to ${Math.min(...ti_vals).toFixed(3)} ppm, recording the cooling history via the TitaniQ geothermometer.`);
    }

    const fi_zones = c.zones.filter(z => z.fluid_inclusion);
    if (fi_zones.length) {
      const fi_types = [...new Set(fi_zones.map(z => z.inclusion_type))];
      parts.push(`The crystal trapped ${fi_zones.length} fluid inclusions (${fi_types.join(', ')}), preserving samples of the parent fluid at the moment of entrapment.`);
    }

    if (c.twinned) {
      parts.push(`A ${c.twin_law} twin formed during growth — likely triggered by a thermal shock event that introduced a rotational domain boundary.`);
    }

    const fast_zones = c.zones.filter(z => z.growth_rate > 15);
    const slow_zones = c.zones.filter(z => z.growth_rate > 0 && z.growth_rate < 2);
    if (fast_zones.length && slow_zones.length) {
      parts.push(`Growth alternated between rapid pulses (up to ${Math.max(...fast_zones.map(z => z.growth_rate)).toFixed(0)} µm/step, producing growth hillocks) and slow, high-quality periods near equilibrium. This oscillation would be visible as alternating clear and milky zones.`);
    }

    const size_desc = c.c_length_mm < 0.5 ? 'microscopic' : c.c_length_mm < 5 ? 'thumbnail' : 'cabinet-sized';
    parts.push(`Final size: ${size_desc} (${c.c_length_mm.toFixed(1)} × ${c.a_width_mm.toFixed(1)} mm).`);
    return parts.join(' ');
  }

  _narrate_sphalerite(c) {
    const parts = [`Sphalerite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
    if (c.zones.length) {
      const fe_vals = c.zones.filter(z => z.trace_Fe > 0).map(z => z.trace_Fe);
      if (fe_vals.length) {
        const max_fe = Math.max(...fe_vals), min_fe = Math.min(...fe_vals);
        if (max_fe > min_fe * 1.5) {
          const third = Math.max(Math.floor(c.zones.length / 3), 1);
          const early_fe = c.zones.slice(0, third).reduce((s, z) => s + z.trace_Fe, 0) / third;
          const late_fe = c.zones.slice(-third).reduce((s, z) => s + z.trace_Fe, 0) / third;
          if (early_fe < late_fe) {
            parts.push(`Iron content increased through growth — early zones are pale (low Fe, cleiophane variety) grading to darker amber or brown as the fluid became more iron-rich. This color zoning would be visible in a polished cross-section.`);
          } else {
            parts.push(`Iron content decreased through growth — the crystal darkened early (higher Fe, approaching marmatite) then cleared as iron was depleted from the fluid.`);
          }
        }
      }
    }
    if (c.twinned) {
      parts.push(`Twinned on the ${c.twin_law} — a common growth twin in sphalerite that creates triangular re-entrant faces.`);
    }
    return parts.join(' ');
  }

  _narrate_fluorite(c) {
    const parts = [`Fluorite #${c.crystal_id} grew as ${c.habit} crystals to ${c.c_length_mm.toFixed(1)} mm.`];
    if (c.zones.length) {
      const colors = new Set();
      for (const z of c.zones) {
        if (z.note && z.note.includes('color zone:')) {
          colors.add(z.note.split('color zone:')[1].trim());
        }
      }
      if (colors.size > 1) {
        parts.push(`Color zoning present: ${[...colors].join(', ')} zones reflecting changing trace element chemistry during growth.`);
      } else if (colors.size === 1) {
        parts.push(`Uniformly ${[...colors][0]}.`);
      }
    }
    if (c.twinned) parts.push(`Shows ${c.twin_law} twinning — two interpenetrating cubes.`);
    const fl = c.predict_fluorescence();
    if (fl !== 'non-fluorescent') parts.push(`Would show ${fl} under UV excitation.`);
    return parts.join(' ');
  }

  _narrate_pyrite(c) {
    const parts = [`Pyrite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
    if (c.habit === 'framboidal') {
      parts.push('The low temperature produced framboidal pyrite — microscopic raspberry-shaped aggregates of tiny crystallites, a texture common in sedimentary environments.');
    } else if (c.habit === 'pyritohedral') {
      parts.push('The crystal developed the characteristic pyritohedral habit — twelve pentagonal faces, a form unique to pyrite and one of nature\'s few non-crystallographic symmetries.');
    } else if (c.habit.includes('cubic')) {
      parts.push('Clean cubic habit with bright metallic luster. The striations on each cube face (perpendicular on adjacent faces) are the fingerprint of pyrite\'s lower symmetry disguised as cubic.');
    }
    if (c.twinned) {
      parts.push(`Twinned as an ${c.twin_law} — two crystals interpenetrating at 90°, one of the most recognizable twin forms in mineralogy.`);
    }
    if (c.dissolved) {
      parts.push('Late-stage oxidation attacked the pyrite — in nature this would produce a limonite/goethite boxwork pseudomorph, the rusty ghost of the original crystal.');
    }
    return parts.join(' ');
  }

  _narrate_chalcopyrite(c) {
    const parts = [`Chalcopyrite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
    parts.push('Brassy yellow with a greenish tint — distinguishable from pyrite by its deeper color and softer hardness (3.5 vs 6). The disphenoidal crystals often look tetrahedral, a common misidentification.');
    if (c.twinned) {
      parts.push(`Shows ${c.twin_law} twinning — repeated twins create spinel-like star shapes.`);
    }
    if (c.dissolved) {
      parts.push('Oxidation began converting the chalcopyrite — at the surface, this weathering produces malachite (green) and azurite (blue), the colorful signal that led ancient prospectors to copper deposits.');
    }
    return parts.join(' ');
  }

  _narrate_hematite(c) {
    const parts = [`Hematite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
    if (c.habit === 'specular') {
      parts.push('The high temperature produced specular hematite — brilliant metallic plates that flash like mirrors. The thin {001} basal plates grew parallel, creating the characteristic iron rose texture.');
      if (c.zones && c.zones.some(z => z.note && z.note.includes('iridescent'))) {
        parts.push('Some plates are thin enough to show iridescent interference colors — rainbow hematite, a collector favorite.');
      }
    } else if (c.habit === 'rhombohedral') {
      parts.push('Moderate temperatures produced rhombohedral hematite — sharp-edged crystals with {101} faces, dark metallic gray with a red streak.');
    } else if (c.habit === 'botryoidal') {
      parts.push('Low-temperature growth produced botryoidal hematite — kidney-ore texture with smooth, rounded surfaces. Classic kidney iron ore mined since antiquity.');
    } else if (c.habit === 'earthy/massive') {
      parts.push('Low supersaturation produced earthy, massive hematite — red microcrystalline aggregate. The red ochre pigment humans have used for 100,000 years.');
    }
    if (c.twinned) parts.push(`Shows a rare ${c.twin_law}.`);
    if (c.dissolved) parts.push('Late-stage acid attack dissolved some of the hematite, releasing iron back to the fluid.');
    return parts.join(' ');
  }

  _narrate_malachite(c) {
    const parts = [`Malachite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
    if (c.position.includes('chalcopyrite')) {
      parts.push('It nucleated directly on chalcopyrite — the classic oxidation paragenesis. As oxygenated water attacked the copper sulfide, Cu²⁺ combined with carbonate to form malachite. This is the green stain that led ancient prospectors to copper deposits.');
    }
    if (c.habit === 'banded') {
      parts.push('The crystal developed the famous banded texture — concentric layers of alternating light and dark green, prized in decorative stonework since the Bronze Age.');
    } else if (c.habit === 'botryoidal') {
      parts.push('Botryoidal habit — smooth, rounded green masses. Cross-sections would reveal concentric banding.');
    } else if (c.habit === 'fibrous/acicular') {
      parts.push('Rapid growth produced fibrous, acicular malachite — sprays of needle-like green crystals radiating from nucleation points.');
    }
    if (c.dissolved) parts.push('Acid attack dissolved some malachite — it fizzes in acid like calcite, releasing Cu²⁺ and CO₂.');
    return parts.join(' ');
  }

  _narrate_smithsonite(c) {
    const parts = [`Smithsonite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
    if (c.position.includes('sphalerite')) {
      if (c.position.includes('oxidized')) parts.push('It nucleated on oxidized sphalerite — zinc carbonate born from destroyed zinc sulfide. The grape-like clusters grew from the corpse of the sphalerite that donated its zinc.');
      else parts.push('It nucleated on sphalerite, the zinc source. Smithsonite is the oxidized alter ego of sphalerite — same zinc, different anion, different world.');
    }
    if (c.habit === 'botryoidal' || c.habit === 'botryoidal/stalactitic') parts.push('Botryoidal habit — grape-like clusters of rounded, bubbly masses.');
    else if (c.habit === 'rhombohedral') parts.push('Rhombohedral crystals with curved, pearly faces — the "dry bone" ore.');
    const lastZone = c.zones.length ? c.zones[c.zones.length - 1] : null;
    if (lastZone && lastZone.note) {
      if (lastZone.note.includes('apple-green')) parts.push('Copper impurities give it an apple-green color.');
      else if (lastZone.note.includes('pink')) parts.push('Manganese impurities lend a rare pink color.');
      else if (lastZone.note.includes('blue-green')) parts.push('A blue-green translucence that collectors prize.');
    }
    return parts.join(' ');
  }

  _narrate_wulfenite(c) {
    const parts = [`Wulfenite #${c.crystal_id} — the collector's prize.`];
    parts.push(`Thin, square, tabular plates (${c.c_length_mm.toFixed(1)} mm) with a vitreous luster that catches light like stacked playing cards.`);
    if (c.position.includes('galena')) {
      if (c.position.includes('oxidized')) parts.push('It nucleated on oxidized galena — lead molybdate born from the death of lead sulfide. Destruction made the room; the room grew the prize.');
      else parts.push('It grew on galena, drawing lead from the same source mineral.');
    }
    const lastZone = c.zones.length ? c.zones[c.zones.length - 1] : null;
    if (lastZone && lastZone.note) {
      if (lastZone.note.includes('honey')) parts.push('Honey-orange and translucent — light passes through the plates like stained glass.');
    }
    if (c.twinned) parts.push(`Penetration twinned (${c.twin_law}) — two plates interpenetrating, forming a butterfly shape.`);
    parts.push('Wulfenite requires both lead AND molybdenum in an oxidized environment — a narrow window that rewards destroying sulfides in a Mo-bearing system.');
    return parts.join(' ');
  }

  _narrate_goethite(c) {
    const parts = [`Goethite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
    if (c.position.includes('pseudomorph after pyrite')) {
      parts.push("It replaced pyrite atom-for-atom — the classic boxwork pseudomorph. What looks like a rusty pyrite cube is actually goethite that has inherited the sulfide's habit while the Fe-S lattice dissolved and Fe-O-OH precipitated in its place.");
    } else if (c.position.includes('pseudomorph after chalcopyrite')) {
      parts.push("Chalcopyrite oxidized and goethite took its place — a copper sulfide's iron heir. The copper went to malachite; the iron stayed here.");
    }
    if (c.habit === 'botryoidal/stalactitic') {
      parts.push("Built up into stalactitic, botryoidal masses — the velvety black surfaces that collectors call 'black goethite.'");
    } else if (c.habit === 'fibrous_acicular') {
      parts.push('Radiating needle habit — the fibrous goethite that grows as velvet crusts on cavity walls.');
    }
    return parts.join(' ');
  }

  _narrate_uraninite(c) {
    const parts = [`Uraninite #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm ☢️.`];
    parts.push("UO₂ — pitch-black, submetallic, one of Earth's densest oxides. It formed under strongly reducing conditions: any oxygen would have converted it to yellow secondary uranium minerals.");
    if (c.nucleation_temp > 400) {
      parts.push('Pegmatite-scale uraninite, possibly with Th substituting for U and radiogenic Pb accumulating in the structure.');
    } else {
      parts.push('Sedimentary / roll-front style, precipitated where reducing organic matter met U-bearing groundwater.');
    }
    return parts.join(' ');
  }

  _narrate_galena(c) {
    const parts = [`Galena #${c.crystal_id} grew to ${c.c_length_mm.toFixed(1)} mm.`];
    parts.push("PbS — the densest common sulfide (SG 7.6), perfect cubic cleavage, bright lead-gray metallic luster.");
    if (c.twinned) parts.push(`Twinned on the ${c.twin_law} — spinel-law twins create interpenetrating cubes in galena, rare but diagnostic.`);
    if (c.dissolved) parts.push('Oxidation attacked the galena — Pb²⁺ went into solution and can reprecipitate as cerussite, anglesite, or wulfenite (if Mo is present).');
    return parts.join(' ');
  }

  _narrate_mixing_event(batch, event) {
    const mineral_names = new Set(batch.map(c => c.mineral));
    const parts = [];
    if (mineral_names.has('sphalerite') && mineral_names.has('fluorite')) {
      parts.push("When metal-bearing brine met sulfur-bearing groundwater, sphalerite (ZnS) and fluorite (CaF₂) nucleated simultaneously — a classic Mississippi Valley-type precipitation event. The zinc and sulfur couldn't coexist in solution; they combined on contact and the minerals fell out of the fluid like rain.");
    } else if (mineral_names.has('sphalerite')) {
      parts.push("Sphalerite nucleated as zinc-bearing brine mixed with sulfur-rich groundwater. The two fluids were stable apart; together, ZnS became insoluble.");
    }
    return parts.join(' ');
  }

  _narrate_tectonic(batch) {
    const twinned = this.crystals.filter(c => c.twinned);
    if (twinned.length) {
      const names = twinned.map(c => `${c.mineral} #${c.crystal_id}`);
      return ` The stress may have induced twinning in ${names.join(', ')}. Twin planes formed as the crystal lattice accommodated the sudden strain — a record of the event frozen in the structure.`;
    }
    return ' No visible twinning resulted, but the pressure change altered subsequent growth conditions.';
  }

  _narrate_collectors_view() {
    const parts = ['A collector examining this specimen would find:'];
    for (const c of this.crystals) {
      if (c.total_growth_um < 10 && !c.zones.length) continue;

      if (c.mineral === 'quartz') {
        if (c.c_length_mm > 2) {
          let desc = `a ${c.c_length_mm.toFixed(1)}mm quartz crystal`;
          if (c.twinned) desc += ` (${c.twin_law} twinned)`;
          const fi_count = c.zones.filter(z => z.fluid_inclusion).length;
          if (fi_count > 3) desc += ' with visible fluid inclusions';
          parts.push(`  • ${desc}`);
        } else if (c.c_length_mm > 0.1) {
          parts.push('  • tiny quartz crystals on the vug wall');
        }
      } else if (c.mineral === 'calcite') {
        const fl = c.predict_fluorescence();
        let desc = `a ${c.c_length_mm.toFixed(1)}mm ${c.habit} calcite`;
        if (c.twinned) desc += ' (twinned)';
        if (fl.includes('orange')) desc += ' — glows orange under UV';
        else if (fl.includes('quenched')) desc += " — patchy UV response (Mn zones glow, Fe zones dark)";
        parts.push(`  • ${desc}`);
      } else if (c.mineral === 'sphalerite') {
        let desc = `a ${c.c_length_mm.toFixed(1)}mm sphalerite`;
        if (c.twinned) desc += ` (${c.twin_law})`;
        if (c.zones.length) {
          const last_note = c.zones[c.zones.length - 1].note;
          if (last_note.includes('color:')) {
            const color = last_note.split('color:')[1].split(',')[0].trim();
            desc += `, ${color}`;
          }
        }
        parts.push(`  • ${desc}`);
      } else if (c.mineral === 'fluorite') {
        let desc = `a ${c.c_length_mm.toFixed(1)}mm fluorite cube`;
        if (c.twinned) desc += ' (penetration twin)';
        const fl = c.predict_fluorescence();
        if (fl !== 'non-fluorescent' && !fl.includes('opaque')) desc += ` — fluoresces ${fl.split('(')[0].trim()}`;
        parts.push(`  • ${desc}`);
      } else if (c.mineral === 'pyrite') {
        let desc = `a ${c.c_length_mm.toFixed(1)}mm pyrite`;
        if (c.habit === 'framboidal') {
          desc = 'framboidal pyrite aggregate';
        } else if (c.habit === 'pyritohedral') {
          desc += ' pyritohedron';
        } else {
          desc += ' cube';
        }
        if (c.twinned) desc += ` (${c.twin_law})`;
        desc += ' — bright metallic luster';
        if (c.dissolved) desc += ', partially oxidized (limonite staining)';
        parts.push(`  • ${desc}`);
      } else if (c.mineral === 'chalcopyrite') {
        let desc = `a ${c.c_length_mm.toFixed(1)}mm chalcopyrite`;
        if (c.twinned) desc += ` (${c.twin_law})`;
        desc += ' — brassy yellow, greenish tint';
        if (c.dissolved) desc += ', oxidation rind (green Cu carbonate staining)';
        parts.push(`  • ${desc}`);
      } else if (c.mineral === 'hematite') {
        let desc;
        if (c.habit === 'specular') {
          desc = `a ${c.c_length_mm.toFixed(1)}mm specular hematite`;
          if (c.zones.some(z => z.note && z.note.includes('iridescent'))) {
            desc += ' — iridescent rainbow plates';
          } else {
            desc += ' — brilliant metallic silver-black plates';
          }
        } else if (c.habit === 'botryoidal') {
          desc = `a ${c.c_length_mm.toFixed(1)}mm botryoidal hematite — kidney-ore, dark metallic`;
        } else if (c.habit === 'rhombohedral') {
          desc = `a ${c.c_length_mm.toFixed(1)}mm rhombohedral hematite — sharp dark crystals`;
        } else {
          desc = 'earthy red hematite mass';
        }
        if (c.twinned) desc += ` (${c.twin_law})`;
        if (c.dissolved) desc += ', partially dissolved';
        parts.push(`  • ${desc}`);
      } else if (c.mineral === 'malachite') {
        let desc = `a ${c.c_length_mm.toFixed(1)}mm malachite`;
        if (c.habit === 'banded') {
          desc += ' — banded green, concentric layers';
        } else if (c.habit === 'fibrous/acicular') {
          desc += ' — sprays of acicular green needles';
        } else {
          desc += ' — botryoidal green masses';
        }
        if (c.dissolved) desc += ', partially dissolved (acid attack)';
        if (c.position.includes('chalcopyrite')) desc += ' (on chalcopyrite — oxidation paragenesis)';
        parts.push(`  • ${desc}`);
      }
    }

    if (parts.length === 1) return "The vug produced only microscopic crystals — a thin crust on the cavity wall.";
    return parts.join('\n');
  }
}

// ============================================================
// UTILITY
// ============================================================

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ============================================================
// UTILITY
// ============================================================

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const FLUID_PRESETS = {
  silica: {
    label: 'Silica-rich',
    desc: 'High silica (600 ppm SiO₂), moderate Ca, low metals. Quartz-dominant growth.',
    fluid: { SiO2: 600, Ca: 150, CO3: 100, Fe: 8, Mn: 3, Ti: 0.8, Al: 4, F: 10, Zn: 0, S: 0, Cu: 0, O2: 0, pH: 6.5, salinity: 5.0 }
  },
  carbonate: {
    label: 'Carbonate',
    desc: 'Ca-CO₃ rich fluid (Ca 300, CO₃ 250 ppm), moderate Mn. Calcite-dominant.',
    fluid: { SiO2: 80, Ca: 300, CO3: 250, Fe: 10, Mn: 8, Ti: 0.2, Al: 1, F: 5, Zn: 0, S: 0, Cu: 0, O2: 0, pH: 7.0, salinity: 8.0 }
  },
  mvt: {
    label: 'MVT Brine',
    desc: 'Zinc + sulfur-bearing brine (Zn 150, S 120 ppm), high Ca + F. Sphalerite + fluorite + smithsonite potential. Mo flux.',
    fluid: { SiO2: 100, Ca: 350, CO3: 200, Fe: 25, Mn: 5, Ti: 0.3, Al: 2, F: 30, Zn: 150, S: 120, Cu: 0, Mo: 20, O2: 0, pH: 5.5, salinity: 18.0 }
  },
  clean: {
    label: 'Clean/Dilute',
    desc: 'Low-concentration fluid. Slow growth, high purity crystals. Near-equilibrium conditions.',
    fluid: { SiO2: 200, Ca: 80, CO3: 60, Fe: 2, Mn: 1, Ti: 0.1, Al: 1, F: 3, Zn: 0, S: 0, Cu: 0, O2: 0, pH: 7.0, salinity: 2.0 }
  },
  porphyry: {
    label: 'Copper Porphyry',
    desc: 'Cu-Fe-S bearing magmatic fluid (Cu 100, Fe 40, S 80 ppm), reducing. Pyrite + chalcopyrite potential.',
    fluid: { SiO2: 500, Ca: 80, CO3: 50, Fe: 40, Mn: 2, Ti: 0.5, Al: 3, F: 5, Zn: 0, S: 80, Cu: 100, O2: 0.2, pH: 4.5, salinity: 10.0 }
  },
  oxidized_cu: {
    label: 'Oxidized Copper',
    desc: 'Cu-bearing oxidized fluid (Cu 60, Fe 40, O₂ 1.5), CO₃-rich. Malachite + hematite potential. Low temperature favored.',
    fluid: { SiO2: 100, Ca: 150, CO3: 200, Fe: 40, Mn: 3, Ti: 0.2, Al: 1, F: 5, Zn: 0, S: 5, Cu: 60, O2: 1.5, pH: 6.0, salinity: 5.0 }
  },
  radioactive: {
    label: 'Radioactive Pegmatite',
    desc: 'U-bearing pegmatite: high silica, uranium-rich. Uraninite crystallizes first, quartz grows around it, radiation darkens quartz over deep time. ☢️',
    fluid: { SiO2: 800, Ca: 50, CO3: 20, Fe: 40, Mn: 5, Ti: 0.5, Al: 3, F: 15, Zn: 0, S: 30, Cu: 0, U: 100, Pb: 20, O2: 0, pH: 6.0, salinity: 5.0 }
  }
};

// ============================================================
// GROOVE AXES (for Record Groove rendering)
// ============================================================
const GROOVE_AXES = [
  { name: 'Temperature', key: 'temperature', color: '#ff8844' },
  { name: 'Growth rate', key: 'thickness_um', color: '#50e0c0' },
  { name: 'Fe', key: 'trace_Fe', color: '#cc6644' },
  { name: 'Mn', key: 'trace_Mn', color: '#ffaa44' },
  { name: 'Al', key: 'trace_Al', color: '#8888cc' },
  { name: 'Ti', key: 'trace_Ti', color: '#88cc88' },
];

// ============================================================
// AGENT API — Game State
// ============================================================
let gameSim = null;
let gameActive = false;
let gameLog = [];

function getState() {
  if (!gameSim) return null;
  const c = gameSim.conditions;
  return {
    step: gameSim.step,
    temperature: +c.temperature.toFixed(1),
    pressure: +c.pressure.toFixed(2),
    pH: +c.fluid.pH.toFixed(1),
    flow_rate: +c.flow_rate.toFixed(1),
    fluid: {
      SiO2: +c.fluid.SiO2.toFixed(1),
      Ca: +c.fluid.Ca.toFixed(1),
      CO3: +c.fluid.CO3.toFixed(1),
      Fe: +c.fluid.Fe.toFixed(1),
      Mn: +c.fluid.Mn.toFixed(1),
      Al: +c.fluid.Al.toFixed(1),
      Ti: +c.fluid.Ti.toFixed(2),
      F: +c.fluid.F.toFixed(1),
      Zn: +c.fluid.Zn.toFixed(1),
      S: +c.fluid.S.toFixed(1),
      Cu: +c.fluid.Cu.toFixed(1),
      Pb: +c.fluid.Pb.toFixed(1),
      U: +c.fluid.U.toFixed(1),
      O2: +c.fluid.O2.toFixed(1),
    },
    fluid_description: c.fluid.describe(),
    supersaturation: {
      quartz: +c.supersaturation_quartz().toFixed(2),
      calcite: +c.supersaturation_calcite().toFixed(2),
      fluorite: +c.supersaturation_fluorite().toFixed(2),
      sphalerite: +c.supersaturation_sphalerite().toFixed(2),
      pyrite: +c.supersaturation_pyrite().toFixed(2),
      chalcopyrite: +c.supersaturation_chalcopyrite().toFixed(2),
      hematite: +c.supersaturation_hematite().toFixed(2),
      malachite: +c.supersaturation_malachite().toFixed(2),
      uraninite: +c.supersaturation_uraninite().toFixed(2),
      galena: +c.supersaturation_galena().toFixed(2),
      smithsonite: +c.supersaturation_smithsonite().toFixed(2),
      wulfenite: +c.supersaturation_wulfenite().toFixed(2),
    },
    vug_diameter_mm: +c.wall.vug_diameter_mm.toFixed(1),
    wall_dissolved_mm: +c.wall.total_dissolved_mm.toFixed(1),
    redox: c.fluid.O2 > 1.0 ? 'oxidizing' : (c.fluid.O2 < 0.3 && (c.fluid.S > 20 || c.fluid.Fe > 20) ? 'reducing' : 'neutral'),
    radiation_dose: gameSim.radiation_dose || 0,
  };
}

function getCrystals(includeZones) {
  if (!gameSim) return [];
  return gameSim.crystals.map(c => {
    const obj = {
      mineral: c.mineral,
      crystal_id: c.crystal_id,
      nucleation_step: c.nucleation_step,
      nucleation_temp: +c.nucleation_temp.toFixed(1),
      position: c.position,
      c_length_mm: +c.c_length_mm.toFixed(2),
      a_width_mm: +c.a_width_mm.toFixed(2),
      habit: c.habit,
      dominant_forms: c.dominant_forms,
      zones_count: c.zones.length,
      total_growth_um: +c.total_growth_um.toFixed(1),
      twinned: c.twinned,
      twin_law: c.twin_law || null,
      active: c.active,
      dissolved: c.dissolved || false,
      phantom_count: c.phantom_count || 0,
      radiation_damage: c.radiation_damage || 0,
      morphology: c.describe_morphology(),
      fluorescence: c.predict_fluorescence(),
    };
    if (includeZones) {
      obj.zones = c.zones.map(z => ({
        step: z.step,
        temperature: +z.temperature.toFixed(1),
        thickness_um: +z.thickness_um.toFixed(2),
        trace_Fe: +z.trace_Fe.toFixed(2),
        trace_Mn: +z.trace_Mn.toFixed(2),
        trace_Al: +z.trace_Al.toFixed(2),
        trace_Ti: +z.trace_Ti.toFixed(3),
        fluid_inclusion: z.fluid_inclusion,
        inclusion_type: z.inclusion_type || null,
        ca_from_wall: +z.ca_from_wall.toFixed(2),
        is_phantom: z.is_phantom,
        note: z.note || null,
      }));
    }
    return obj;
  });
}

function applyAction(type) {
  if (!gameSim || !gameActive) return { ok: false, error: 'No active game' };

  const c = gameSim.conditions;
  let actionDesc = '';

  switch (type) {
    case 'wait':
      // Only wait advances time
      const log = gameSim.run_step();
      return {
        ok: true,
        step: gameSim.step,
        state: getState(),
        log: log,
        crystals: getCrystals(false),
        action: 'wait — ambient cooling',
      };

    case 'heat':
      c.temperature += 25;
      c.temperature = Math.min(c.temperature, 600);
      actionDesc = `Heat +25°C → ${c.temperature.toFixed(0)}°C`;
      break;
    case 'cool':
      c.temperature -= 25;
      c.temperature = Math.max(c.temperature, 25);
      actionDesc = `Cool −25°C → ${c.temperature.toFixed(0)}°C`;
      break;
    case 'silica':
      c.fluid.SiO2 += 400;
      c.fluid.Al += 2;
      c.fluid.Ti += 0.3;
      actionDesc = `Silica injected — SiO₂ +400 ppm (now ${c.fluid.SiO2.toFixed(0)})`;
      break;
    case 'metals':
      c.fluid.Fe += 40;
      c.fluid.Mn += 15;
      actionDesc = `Metals injected — Fe +40, Mn +15 ppm`;
      break;
    case 'brine':
      c.fluid.Zn += 150;
      c.fluid.S += 120;
      c.temperature -= 10;
      actionDesc = `Brine mixed — Zn +150, S +120 ppm, T −10°C`;
      break;
    case 'fluorine':
      c.fluid.F += 25;
      c.fluid.Ca += 80;
      actionDesc = `Fluorine added — F +25, Ca +80 ppm`;
      break;
    case 'copper':
      c.fluid.Cu = 120.0;
      c.fluid.Fe += 40;
      c.fluid.S += 80;
      c.fluid.SiO2 += 200;
      c.fluid.O2 = 0.3;
      c.temperature += 30;
      c.temperature = Math.min(c.temperature, 600);
      c.flow_rate = 4.0;
      actionDesc = `Copper injection — Cu ${c.fluid.Cu.toFixed(0)} ppm, reducing. T → ${c.temperature.toFixed(0)}°C`;
      break;
    case 'oxidize':
      c.fluid.O2 = 1.8;
      c.fluid.S *= 0.3;
      c.temperature -= 40;
      c.temperature = Math.max(c.temperature, 25);
      actionDesc = `Oxidation — O₂ → ${c.fluid.O2.toFixed(1)}, sulfur depleted. T → ${c.temperature.toFixed(0)}°C. Sulfides unstable!`;
      break;
    case 'tectonic':
      c.pressure += 0.5;
      c.temperature += 15;
      for (const crystal of gameSim.crystals) {
        if (!crystal.twinned && crystal.zones.length > 2 && rng.random() < 0.15) {
          crystal.twinned = true;
          if (crystal.mineral === 'quartz') crystal.twin_law = 'Dauphiné';
          else if (crystal.mineral === 'calcite') crystal.twin_law = 'c-twin {001}';
          else if (crystal.mineral === 'sphalerite') crystal.twin_law = 'spinel-law {111}';
          else if (crystal.mineral === 'fluorite') crystal.twin_law = 'penetration twin {111}';
          else if (crystal.mineral === 'pyrite') crystal.twin_law = 'iron cross {110}';
          else if (crystal.mineral === 'chalcopyrite') crystal.twin_law = 'penetration twin {112}';
          else if (crystal.mineral === 'hematite') crystal.twin_law = 'penetration twin {001}';
        }
      }
      actionDesc = `Tectonic shock — P +0.5 kbar, T +15°C. Crystals stressed!`;
      break;
    case 'flood':
      c.flow_rate = 5.0;
      c.fluid.SiO2 *= 0.6;
      c.fluid.Ca *= 1.3;
      c.fluid.CO3 *= 1.2;
      c.fluid.pH += 0.3;
      actionDesc = `Flood — fresh fluid pulse, silica diluted, carbonates refreshed`;
      break;
    case 'acidify':
      c.fluid.pH -= 2.0;
      c.fluid.pH = Math.max(c.fluid.pH, 2.0);
      actionDesc = `Acidic fluid incursion. pH drops to ${c.fluid.pH.toFixed(1)}. Carbonates unstable.`;
      break;
    case 'alkalinize':
      c.fluid.pH += 2.0;
      c.fluid.pH = Math.min(c.fluid.pH, 10.0);
      actionDesc = `Alkaline fluid incursion. pH rises to ${c.fluid.pH.toFixed(1)}. Carbonate precipitation favored.`;
      break;
    default:
      return { ok: false, error: `Unknown action: ${type}` };
  }

  return {
    ok: true,
    step: gameSim.step,
    state: getState(),
    log: [actionDesc],
    crystals: getCrystals(false),
    action: actionDesc,
  };
}

// ============================================================
// RECORD GROOVE — Headless PNG Rendering
// ============================================================

function renderGrooveSVG(crystal, outputPath) {
  const zones = crystal.zones;
  if (!zones.length) return { ok: false, error: 'Crystal has no zones' };

  const W = 320, H = 320;
  const n = zones.length;
  const cx = 160, cy = 160;
  const maxRadius = 140, minRadius = 15;
  const stepsPerRev = 5;
  const amplitude = 40;

  const norm = (arr) => {
    const mn = Math.min(...arr);
    const mx = Math.max(...arr);
    const range = mx - mn || 1;
    return arr.map(v => (v - mn) / range);
  };

  const nTemp = norm(zones.map(z => z.temperature));
  const nThick = norm(zones.map(z => Math.abs(z.thickness_um)));
  const nFe = norm(zones.map(z => z.trace_Fe));
  const nMn = norm(zones.map(z => z.trace_Mn));
  const nAl = norm(zones.map(z => z.trace_Al));
  const nTi = norm(zones.map(z => z.trace_Ti));

  // Compute groove points (same algorithm as PNG)
  const points = [];
  for (let i = 0; i < n; i++) {
    const z = zones[i];
    const t = i / Math.max(n - 1, 1);
    const baseRadius = minRadius + t * (maxRadius - minRadius);
    const angle = (i / stepsPerRev) * Math.PI * 2;

    const vals = [nTemp[i], nThick[i], nFe[i], nMn[i], nAl[i], nTi[i]];
    const nAxes = GROOVE_AXES.length;

    let wobbleR = 0;
    for (let a = 0; a < nAxes; a++) {
      const freq = a + 1;
      const phase = (a / nAxes) * Math.PI * 2;
      const deviation = (vals[a] - 0.5) * 2;
      wobbleR += deviation * Math.sin(angle * freq + phase) * amplitude * 0.4;
    }
    const wobbleX = wobbleR * Math.cos(angle + Math.PI / 2);
    const wobbleY = wobbleR * Math.sin(angle + Math.PI / 2);

    let dissolutionDip = 0;
    if (z.thickness_um < 0) {
      dissolutionDip = -Math.min(Math.abs(z.thickness_um) * 0.5, amplitude * 0.8);
    }

    const r = baseRadius + dissolutionDip;
    const x = cx + (r * Math.cos(angle)) + wobbleX;
    const y = cy + (r * Math.sin(angle)) + wobbleY;

    points.push({
      x, y, vals, angle,
      isDissolution: z.thickness_um < 0,
      isPhantom: z.is_phantom,
      hasInclusion: z.fluid_inclusion,
      isTwin: !!(z.note && z.note.toLowerCase().includes('twin')),
    });
  }

  // Build SVG
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`;
  svg += `<rect width="${W}" height="${H}" fill="#070706"/>`;

  // Axis guides
  const nAxes = GROOVE_AXES.length;
  for (let a = 0; a < nAxes; a++) {
    const axisAngle = (a / nAxes) * Math.PI * 2;
    const ex = cx + (maxRadius + 10) * Math.cos(axisAngle);
    const ey = cy + (maxRadius + 10) * Math.sin(axisAngle);
    svg += `<line x1="${cx}" y1="${cy}" x2="${ex.toFixed(1)}" y2="${ey.toFixed(1)}" stroke="${GROOVE_AXES[a].color}" stroke-width="1" opacity="0.08"/>`;
  }

  // Rainbow ribbon lanes — use cubic bezier curves for smooth rendering
  const laneSpacing = 2.5;
  const maxLineWidth = 4;
  const minLineWidth = 0.3;
  const tension = 0.3;

  for (let a = 0; a < nAxes; a++) {
    // Pre-compute lane-offset points
    const lanePoints = [];
    for (let i = 0; i < points.length; i++) {
      const p1 = points[i];
      const p2 = points[Math.min(i + 1, points.length - 1)];
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;
      const laneOffset = (a - (nAxes - 1) / 2) * laneSpacing;
      lanePoints.push({ x: p1.x + nx * laneOffset, y: p1.y + ny * laneOffset, val: p1.vals[a] });
    }

    // Draw segments with bezier curves, varying width by splitting into sub-paths
    for (let i = 0; i < lanePoints.length - 1; i++) {
      const val = lanePoints[i].val;
      const width = minLineWidth + Math.cbrt(val) * (maxLineWidth - minLineWidth);
      if (width < 0.15) continue;

      const p0 = lanePoints[Math.max(0, i - 1)];
      const p1 = lanePoints[i];
      const p2 = lanePoints[i + 1];
      const p3 = lanePoints[Math.min(lanePoints.length - 1, i + 2)];

      const cp1x = p1.x + (p2.x - p0.x) * tension;
      const cp1y = p1.y + (p2.y - p0.y) * tension;
      const cp2x = p2.x - (p3.x - p1.x) * tension;
      const cp2y = p2.y - (p3.y - p1.y) * tension;

      const alpha = (0.4 + val * 0.6).toFixed(2);
      svg += `<path d="M${p1.x.toFixed(1)},${p1.y.toFixed(1)} C${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}" fill="none" stroke="${GROOVE_AXES[a].color}" stroke-width="${width.toFixed(1)}" opacity="${alpha}" stroke-linecap="round"/>`;
    }
  }

  // Dissolution overlay
  for (let i = 1; i < points.length; i++) {
    if (points[i].isDissolution) {
      svg += `<line x1="${points[i-1].x.toFixed(1)}" y1="${points[i-1].y.toFixed(1)}" x2="${points[i].x.toFixed(1)}" y2="${points[i].y.toFixed(1)}" stroke="#cc4444" stroke-width="2.5"/>`;
    }
  }

  // Phantom boundaries
  for (const p of points) {
    if (p.isPhantom) svg += `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4" fill="rgba(90,74,48,0.8)"/>`;
  }

  // Fluid inclusions
  for (const p of points) {
    if (p.hasInclusion) svg += `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3.5" fill="#50e0c0"/>`;
  }

  // Twin events
  for (const p of points) {
    if (p.isTwin) {
      svg += `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="5" fill="#bb66ee"/>`;
      svg += `<line x1="${(p.x-4).toFixed(1)}" y1="${p.y.toFixed(1)}" x2="${(p.x+4).toFixed(1)}" y2="${p.y.toFixed(1)}" stroke="#ddaaff" stroke-width="1"/>`;
      svg += `<line x1="${p.x.toFixed(1)}" y1="${(p.y-4).toFixed(1)}" x2="${p.x.toFixed(1)}" y2="${(p.y+4).toFixed(1)}" stroke="#ddaaff" stroke-width="1"/>`;
    }
  }

  // Nucleation dot
  if (points.length) {
    svg += `<circle cx="${points[0].x.toFixed(1)}" cy="${points[0].y.toFixed(1)}" r="4" fill="#f0c050"/>`;
  }

  // Label
  svg += `<text x="${W-10}" y="${H-10}" fill="#5a4a30" font-family="monospace" font-size="9" text-anchor="end">${crystal.mineral} #${crystal.crystal_id} — ${zones.length} zones</text>`;

  svg += '</svg>';

  const fs = require('fs');
  const pathMod = require('path');
  const dir = pathMod.dirname(outputPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(outputPath, svg);
  return {
    ok: true, path: outputPath, size: svg.length, format: 'svg',
    mime: 'image/svg+xml',
    data_base64: Buffer.from(svg).toString('base64'),
    crystal_id: crystal.crystal_id,
    mineral: crystal.mineral,
    zone_count: zones.length,
  };
}

function renderGroovePNG(crystal, outputPath) {
  let createCanvas;
  try {
    createCanvas = require('canvas').createCanvas;
  } catch (e) {
    // Fallback to SVG when canvas package isn't available
    const svgPath = outputPath.replace(/\.png$/i, '.svg');
    return renderGrooveSVG(crystal, svgPath);
  }

  const W = 320, H = 320;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = '#070706';
  ctx.fillRect(0, 0, W, H);

  const zones = crystal.zones;
  if (!zones.length) return { ok: false, error: 'Crystal has no zones' };

  const n = zones.length;
  const cx = 160, cy = 160;
  const maxRadius = 140, minRadius = 15;
  const stepsPerRev = 5; // 1 revolution per 5 zones
  const amplitude = 40;

  // Normalize all values
  const norm = (arr) => {
    const mn = Math.min(...arr);
    const mx = Math.max(...arr);
    const range = mx - mn || 1;
    return arr.map(v => (v - mn) / range);
  };

  const nTemp = norm(zones.map(z => z.temperature));
  const nThick = norm(zones.map(z => Math.abs(z.thickness_um)));
  const nFe = norm(zones.map(z => z.trace_Fe));
  const nMn = norm(zones.map(z => z.trace_Mn));
  const nAl = norm(zones.map(z => z.trace_Al));
  const nTi = norm(zones.map(z => z.trace_Ti));

  // Compute groove points
  const points = [];
  for (let i = 0; i < n; i++) {
    const z = zones[i];
    const t = i / Math.max(n - 1, 1);
    const baseRadius = minRadius + t * (maxRadius - minRadius);
    const angle = (i / stepsPerRev) * Math.PI * 2;

    const vals = [nTemp[i], nThick[i], nFe[i], nMn[i], nAl[i], nTi[i]];
    const nAxes = GROOVE_AXES.length;

    let wobbleR = 0;
    for (let a = 0; a < nAxes; a++) {
      const freq = a + 1;
      const phase = (a / nAxes) * Math.PI * 2;
      const deviation = (vals[a] - 0.5) * 2;
      wobbleR += deviation * Math.sin(angle * freq + phase) * amplitude * 0.4;
    }
    const wobbleX = wobbleR * Math.cos(angle + Math.PI / 2);
    const wobbleY = wobbleR * Math.sin(angle + Math.PI / 2);

    let dissolutionDip = 0;
    if (z.thickness_um < 0) {
      dissolutionDip = -Math.min(Math.abs(z.thickness_um) * 0.5, amplitude * 0.8);
    }

    const r = baseRadius + dissolutionDip;
    const x = cx + (r * Math.cos(angle)) + wobbleX;
    const y = cy + (r * Math.sin(angle)) + wobbleY;

    points.push({
      x, y, vals, angle,
      isDissolution: z.thickness_um < 0,
      isPhantom: z.is_phantom,
      hasInclusion: z.fluid_inclusion,
      isTwin: !!(z.note && z.note.toLowerCase().includes('twin')),
    });
  }

  // Draw axis guides (faint)
  ctx.globalAlpha = 0.08;
  for (let a = 0; a < GROOVE_AXES.length; a++) {
    const axisAngle = (a / GROOVE_AXES.length) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + (maxRadius + 10) * Math.cos(axisAngle), cy + (maxRadius + 10) * Math.sin(axisAngle));
    ctx.strokeStyle = GROOVE_AXES[a].color;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  ctx.globalAlpha = 1.0;

  // Draw rainbow ribbon lanes
  const nAxes = GROOVE_AXES.length;
  const laneSpacing = 2.5;
  const maxLineWidth = 4;
  const minLineWidth = 0.3;

  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];

    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;

    const p0 = points[Math.max(0, i - 1)];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    const tension = 0.3;

    for (let a = 0; a < nAxes; a++) {
      const laneOffset = (a - (nAxes - 1) / 2) * laneSpacing;
      const ox = nx * laneOffset;
      const oy = ny * laneOffset;

      const val = p1.vals[a];
      const width = minLineWidth + Math.cbrt(val) * (maxLineWidth - minLineWidth);
      if (width < 0.15) continue;

      const s1x = p1.x + ox, s1y = p1.y + oy;
      const s2x = p2.x + ox, s2y = p2.y + oy;
      const cp1x = s1x + (p2.x + ox - (p0.x + ox)) * tension;
      const cp1y = s1y + (p2.y + oy - (p0.y + oy)) * tension;
      const cp2x = s2x - (p3.x + ox - (p1.x + ox)) * tension;
      const cp2y = s2y - (p3.y + oy - (p1.y + oy)) * tension;

      ctx.beginPath();
      ctx.moveTo(s1x, s1y);
      ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, s2x, s2y);
      ctx.strokeStyle = GROOVE_AXES[a].color;
      ctx.globalAlpha = 0.4 + val * 0.6;
      ctx.lineWidth = width;
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1.0;

  // Dissolution overlay (red)
  for (let i = 1; i < points.length; i++) {
    if (points[i].isDissolution) {
      ctx.beginPath();
      ctx.moveTo(points[i - 1].x, points[i - 1].y);
      ctx.lineTo(points[i].x, points[i].y);
      ctx.strokeStyle = '#cc4444';
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }
  }

  // Phantom boundaries
  for (let i = 0; i < points.length; i++) {
    if (points[i].isPhantom) {
      ctx.beginPath();
      ctx.arc(points[i].x, points[i].y, 4, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(90, 74, 48, 0.8)';
      ctx.fill();
    }
  }

  // Fluid inclusions (teal dots)
  for (let i = 0; i < points.length; i++) {
    if (points[i].hasInclusion) {
      ctx.beginPath();
      ctx.arc(points[i].x, points[i].y, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = '#50e0c0';
      ctx.fill();
    }
  }

  // Twin events (purple)
  for (let i = 0; i < points.length; i++) {
    if (points[i].isTwin) {
      ctx.beginPath();
      ctx.arc(points[i].x, points[i].y, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#bb66ee';
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(points[i].x - 4, points[i].y);
      ctx.lineTo(points[i].x + 4, points[i].y);
      ctx.moveTo(points[i].x, points[i].y - 4);
      ctx.lineTo(points[i].x, points[i].y + 4);
      ctx.strokeStyle = '#ddaaff';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  // Nucleation dot (gold)
  if (points.length) {
    ctx.beginPath();
    ctx.arc(points[0].x, points[0].y, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#f0c050';
    ctx.fill();
  }

  // Zone count label
  ctx.fillStyle = '#5a4a30';
  ctx.font = '9px monospace';
  ctx.textAlign = 'right';
  ctx.fillText(`${crystal.mineral} #${crystal.crystal_id} — ${zones.length} zones`, W - 10, H - 10);

  // Write PNG
  const fs = require('fs');
  const path = require('path');
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(outputPath, buffer);
  return {
    ok: true, path: outputPath, size: buffer.length, format: 'png',
    mime: 'image/png',
    data_base64: buffer.toString('base64'),
    crystal_id: crystal.crystal_id,
    mineral: crystal.mineral,
    zone_count: zones.length,
  };
}

// ============================================================
// MAIN — stdin/stdout JSON Protocol
// ============================================================

const readline = require('readline');
const path = require('path');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: false });

rl.on('line', (line) => {
  let cmd;
  try {
    cmd = JSON.parse(line.trim());
  } catch (e) {
    console.log(JSON.stringify({ ok: false, error: 'Invalid JSON' }));
    return;
  }

  switch (cmd.cmd) {
    case 'start': {
      const preset = cmd.preset || 'clean';
      const presetData = FLUID_PRESETS[preset];
      if (!presetData) {
        console.log(JSON.stringify({ ok: false, error: `Unknown preset: ${preset}. Available: ${Object.keys(FLUID_PRESETS).join(', ')}` }));
        return;
      }
      const temp = cmd.temperature || 300;
      const pressure = (cmd.pressure || 1.5);
      const seed = cmd.seed || Date.now();

      rng = new SeededRandom(seed);

      const fluidParams = Object.assign({}, presetData.fluid);
      if (cmd.fluid) Object.assign(fluidParams, cmd.fluid);
      const fluid = new FluidChemistry(fluidParams);
      const wall = new VugWall({ composition: 'limestone', thickness_mm: 500, vug_diameter_mm: 50, wall_Fe_ppm: 2000, wall_Mn_ppm: 500, wall_Mg_ppm: 1000 });
      const conditions = new VugConditions({ temperature: temp, pressure, fluid, wall });

      gameSim = new VugSimulator(conditions, []);
      gameActive = true;
      gameLog = [];

      console.log(JSON.stringify({
        ok: true,
        message: `Game started. Preset: ${presetData.label}. T=${temp}°C, P=${pressure} kbar. Seed: ${seed}`,
        state: getState(),
        crystals: [],
        available_actions: ['wait', 'heat', 'cool', 'silica', 'metals', 'brine', 'fluorine', 'copper', 'oxidize', 'tectonic', 'flood', 'acidify', 'alkalinize'],
        available_presets: Object.keys(FLUID_PRESETS),
      }));
      break;
    }

    case 'action': {
      if (!gameSim || !gameActive) {
        console.log(JSON.stringify({ ok: false, error: 'No active game. Send {"cmd":"start"} first.' }));
        return;
      }
      const result = applyAction(cmd.type);
      if (result.log) gameLog.push(...result.log);
      console.log(JSON.stringify(result));
      break;
    }

    case 'status': {
      if (!gameSim) {
        console.log(JSON.stringify({ ok: false, error: 'No active game.' }));
        return;
      }
      console.log(JSON.stringify({
        ok: true,
        step: gameSim.step,
        state: getState(),
        crystals: getCrystals(false),
      }));
      break;
    }

    case 'finish': {
      if (!gameSim) {
        console.log(JSON.stringify({ ok: false, error: 'No active game.' }));
        return;
      }
      gameActive = false;

      const summary = gameSim.format_summary();
      const crystals = getCrystals(true);

      // Render Record Groove PNGs
      const grooveDir = cmd.groove_dir || './grooves';
      const grooveResults = [];
      for (const crystal of gameSim.crystals) {
        if (crystal.zones.length > 2) {
          const filename = `${crystal.mineral}-${crystal.crystal_id}.png`;
          const result = renderGroovePNG(crystal, path.join(grooveDir, filename));
          grooveResults.push(result);
        }
      }

      console.log(JSON.stringify({
        ok: true,
        summary_text: summary.join('\n'),
        crystals,
        grooves: grooveResults,
        total_steps: gameSim.step,
        log_length: gameLog.length,
      }));
      break;
    }

    case 'help': {
      console.log(JSON.stringify({
        ok: true,
        commands: {
          start: 'Begin a new game. Options: preset, temperature, pressure, seed, fluid (overrides)',
          action: 'Take an action. Types: wait, heat, cool, silica, metals, brine, fluorine, copper, oxidize, tectonic, flood, acidify, alkalinize. Only "wait" advances time.',
          status: 'Get current state without advancing.',
          finish: 'End the game. Returns full summary, crystal data with zones, and Record Groove images (PNG or SVG). Each groove includes data_base64 for inline display/attachment.',
          help: 'Show this help.',
        },
        presets: Object.keys(FLUID_PRESETS).map(k => ({ id: k, label: FLUID_PRESETS[k].label, desc: FLUID_PRESETS[k].desc })),
        tip: 'Play blind. 200 steps. See your records at the end. Write about what you see.',
      }));
      break;
    }

    default:
      console.log(JSON.stringify({ ok: false, error: `Unknown command: ${cmd.cmd}. Try: start, action, status, finish, help` }));
  }
});

rl.on('close', () => {
  process.exit(0);
});
