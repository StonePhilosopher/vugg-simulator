// ============================================================
// js/18a-mineral-gates-types.ts — MineralGates interface (shared)
// ============================================================
// Loaded right after 18-constants.ts so every supersat + nucleation
// file (and the initiative module + library card) can use it.
//
// v127 (2026-05-21): Each supersat engine file declares one
// MINERAL_GATES_<mineral> constant of this type. The constant carries
// the σ_crit threshold (used by the nucleation file's nucleation gate),
// composition gates, T/pH/O2 ranges, and surface energy category. The
// initiative module + library card read from these constants without
// parsing source files.
//
// Fields are optional EXCEPT sigma_crit + surface_energy:
//   - sigma_crit:        nucleation threshold (σ ≤ this → no nucleation)
//   - T_min/T_max:       hard cutoffs (σ → 0 outside this range)
//   - T_optimal:         used by initiative temperature modifier
//   - fluid_min:         per-species composition floor (σ → 0 below)
//   - pH_min/pH_max:     hard pH cutoffs
//   - O2_min/O2_max:     redox windows (for oxidizing- or reducing-only minerals)
//   - surface_energy:    γ_sl category (per 01-geochemical-grounding.md)
//   - _sources:          literature / engine references
//   - _notes:            free-form notes
//
// Conventions:
//   - "Hard cutoff" means σ → 0 (mineral cannot fire). "Attenuation"
//     (exponential decay above some threshold) is engine-specific and
//     stays inline in the supersat function — gates carry only the
//     hard cutoffs.
//   - σ_crit is the LOWEST σ-threshold in the nucleation file. If
//     a mineral has secondary nucleation gates (e.g., lepidocrocite
//     σ > 1.7 for additional crystals), that's not in MINERAL_GATES.

interface MineralGates {
  sigma_crit: number;
  T_min?: number;
  T_max?: number;
  T_optimal?: number;
  fluid_min?: Record<string, number>;
  pH_min?: number;
  pH_max?: number;
  O2_min?: number;
  O2_max?: number;
  surface_energy: 'very_low' | 'low' | 'medium' | 'high' | 'very_high';
  _sources?: string[];
  _notes?: string;
}
