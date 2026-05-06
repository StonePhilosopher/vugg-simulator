// ============================================================
// js/26-mineral-paragenesis.ts — substrate affinity + paragenesis tables
// ============================================================
// Per PROPOSAL-PARAGENESIS-OVERGROWTH-CRUSTIFICATION-PSEUDOMORPHS.md.
// Empty in this commit (Q1a) — types + table scaffolding only, no
// behavior change. Q1b populates the table from documented MVT/
// supergene/pegmatite mineral pairs; Q1c wires the σ-discount into
// nucleation thresholds.
//
// Two tables, one Set:
//
//   SUBSTRATE_NUCLEATION_DISCOUNT[host_mineral][nucleating_mineral]
//     = sigma_discount_factor (0..1).
//   A factor of 0.6 means "this mineral nucleates at sigma_threshold
//   * 0.6 when this substrate is available" — heterogeneous
//   nucleation reduces the interfacial-free-energy barrier compared
//   to bare-wall nucleation. 1.0 = no discount (treat as bare wall).
//   Below 0.5 = strong epitaxy (close lattice match: e.g.
//   sphalerite-on-pyrite at ~0.2% misfit, Ramdohr 1980).
//
//   EPITAXY_PAIRS = Set<'<nucleating>><host>'>
//   Documented strict-epitaxy pairs only (low lattice misfit, real
//   crystallographic orientation relationship). Pairs in this set
//   get a habit override that aligns to host facets. Pairs in the
//   discount table but NOT in EPITAXY_PAIRS use orientation-
//   independent heterogeneous nucleation (general substrate
//   stickiness, not strict lattice match).
//
//   PSEUDOMORPH_ROUTES — list of {parent, child, trigger,
//   shape_preserved} entries that document the documented coupled
//   dissolution-precipitation routes (Putnis 2002, 2009). Q2 adds
//   entries; Q3 wires the renderer to inherit parent outline when
//   shape_preserved is true.

// Phase 1 paragenesis types — see PROPOSAL-PARAGENESIS for the science.
type SubstrateAffinityTable = Record<string, Record<string, number>>;
type PseudomorphRoute = {
  parent: string;
  child: string;
  trigger: string;            // 'oxidative' | 'low_co3' | 'thermal' | 'acid' | 'silica_pulse' | 'hydration'
  shape_preserved: boolean;   // true => Q3 renderer inherits parent outline
};

// Empty in Q1a. Populated in Q1b with ~30 documented pairs. Lookup
// shape: SUBSTRATE_NUCLEATION_DISCOUNT[host_mineral][nucleating_mineral].
// Missing host or missing nucleating-on-host entry => no discount
// (nucleate as if on bare wall).
const SUBSTRATE_NUCLEATION_DISCOUNT: SubstrateAffinityTable = {
  // --- examples (commented out until Q1b lands them with citations) ---
  // pyrite: {
  //   sphalerite: 0.5,    // ZnS on FeS2, ~0.2% misfit, Ramdohr 1980
  //   galena:     0.7,    // PbS on FeS2, ~9% misfit, semi-coherent
  //   marcasite:  0.5,    // shared S-S geometry
  // },
  // ...
};

// Empty in Q1a. Populated in Q1b alongside the discount table.
// Format: '<nucleating>><host>' — e.g. 'sphalerite>pyrite'.
const EPITAXY_PAIRS: Set<string> = new Set();

// Empty in Q1a. Populated in Q2.
const PSEUDOMORPH_ROUTES: PseudomorphRoute[] = [];

// Pick a substrate for a nucleating mineral, weighted by available
// hosts and their per-pair discount factors. Pure helper — called by
// VugSimulator._pickSubstrate which threads the live crystal list +
// rng. Returns null when no discounted substrate is available; the
// caller falls back to its own default ('vug wall' or whatever
// engine-specific preference it has).
//
// Returns: { host: Crystal, discount: number } | null.
//
// Q1a contract: with the empty table, this always returns null —
// every nucleation falls back to caller's existing behavior. Q1b
// populates the table; Q1c wires this into nucleation σ checks.
function pickSubstrateForMineral(
  mineral: string,
  crystals: any[],
  rng: any,
): { host: any; discount: number } | null {
  // Eligible hosts: any non-dissolved, non-enclosed crystal whose
  // mineral is a key in SUBSTRATE_NUCLEATION_DISCOUNT and offers a
  // discount for the nucleating mineral.
  const candidates: Array<{ host: any; discount: number; weight: number }> = [];
  for (const c of crystals) {
    if (c.dissolved || c.enclosed_by != null) continue;
    const hostEntry = SUBSTRATE_NUCLEATION_DISCOUNT[c.mineral];
    if (!hostEntry) continue;
    const discount = hostEntry[mineral];
    if (typeof discount !== 'number' || discount >= 1.0) continue;
    // Weight by inverse discount (stronger epitaxy = stronger
    // preference) and by host crystal size (bigger host = more
    // surface area for heterogeneous nucleation). Empirical for now;
    // Q1c can refine if calibration drift is too aggressive.
    const sizeFactor = Math.max(1.0, c.c_length_mm || 0);
    const weight = (1.0 - discount) * sizeFactor;
    candidates.push({ host: c, discount, weight });
  }
  if (candidates.length === 0) return null;
  // Weighted random pick.
  let total = 0;
  for (const x of candidates) total += x.weight;
  let pick = (rng && rng.random ? rng.random() : Math.random()) * total;
  for (const x of candidates) {
    pick -= x.weight;
    if (pick <= 0) return { host: x.host, discount: x.discount };
  }
  return { host: candidates[candidates.length - 1].host, discount: candidates[candidates.length - 1].discount };
}
