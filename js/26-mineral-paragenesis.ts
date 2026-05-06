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

// Q1b: populated. Lookup shape:
// SUBSTRATE_NUCLEATION_DISCOUNT[host_mineral][nucleating_mineral].
// Missing host or missing nucleating-on-host entry => no discount
// (nucleate as if on bare wall).
//
// Two tiers per boss directive 2026-05-06:
//   0.5× — low-misfit lattice match OR strong CDR route
//   0.7× — moderate misfit / facet-selective heterogeneous
//          nucleation / general substrate stickiness
//
// Citations: Ramdohr 1980 (Ore Minerals and Their Intergrowths) for
// sulfide pairs; Putnis 2002/2009 for CDR pseudomorph routes;
// Sangster 1983/1990 for MVT paragenetic associations; Heyl 1968
// for UMV district textures (Cave-in-Rock calcite-on-fluorite).
//
// Q1b is data-only. Q1c wires this table into the nucleation
// σ-threshold check. Until then this sits unused.
const SUBSTRATE_NUCLEATION_DISCOUNT: SubstrateAffinityTable = {
  // ---- Sulfide hosts ----
  pyrite: {
    sphalerite:   0.5,    // ZnS a=5.41 / FeS2 a=5.42 — ~0.2% misfit, Ramdohr 1980
    marcasite:    0.5,    // shared S-S geometry, structural twinning common
    galena:       0.7,    // PbS a=5.94 — ~9% misfit, semi-coherent (Ramdohr)
    chalcopyrite: 0.7,    // documented MVT/porphyry pairing
    goethite:     0.5,    // CDR oxidation route — pyrite -> goethite (Putnis)
    lepidocrocite: 0.7,   // CDR oxidation, less common product
  },
  marcasite: {
    pyrite:       0.5,    // reverse polymorphic pair
    sphalerite:   0.5,    // shared S geometry as with pyrite
    galena:       0.7,    // MVT-common
    goethite:     0.5,    // CDR oxidation route — "museum rot"
  },
  sphalerite: {
    galena:       0.5,    // MVT classic pairing — common but ~10% misfit (Ramdohr)
    chalcopyrite: 0.5,    // "chalcopyrite disease" texture (Sangster 1983)
    barite:       0.7,    // snowball-barite seed (Sweetwater MO; Cave-in-Rock IL)
    smithsonite:  0.5,    // CDR oxidation route — sphalerite -> ZnCO3
    aurichalcite: 0.7,    // supergene Zn-Cu carbonate over Zn sulfide
    rosasite:     0.7,    // supergene Cu-Zn carbonate
    fluorite:     0.7,    // documented MVT pairing
  },
  galena: {
    sphalerite:   0.5,    // reverse direction — equally common
    cerussite:    0.5,    // CDR — galena -> PbCO3 (acid)
    anglesite:    0.5,    // CDR — galena -> PbSO4 (oxidative)
    barite:       0.7,    // MVT pairing (Sangster)
    fluorite:     0.7,    // MVT pairing
  },
  chalcopyrite: {
    bornite:      0.7,    // supergene enrichment
    chalcocite:   0.7,    // supergene enrichment
    covellite:    0.7,    // supergene enrichment
    malachite:    0.7,    // supergene Cu carbonate over Cu sulfide
    azurite:      0.7,
  },
  cobaltite: {
    erythrite:    0.5,    // CDR — cobaltite -> Co arsenate (Schneeberg, Bou Azzer)
  },
  nickeline: {
    annabergite:  0.5,    // CDR — nickeline -> Ni arsenate (Schneeberg)
    erythrite:    0.7,    // co-occurrence in Co-Ni arsenide veins
  },

  // ---- Oxide / hydroxide hosts ----
  cuprite: {
    native_copper: 0.7,    // primary Cu metal precipitate inside Cu2O
    malachite:    0.5,    // CDR — cuprite + CO3 -> malachite
    azurite:      0.7,    // requires CO3-rich fluid
    chrysocolla:  0.5,    // "enamel on cuprite" — Bisbee signature
  },
  hematite: {
    goethite:     0.7,    // common Fe-oxide overprint
  },
  magnetite: {
    hematite:     0.7,    // martitization overprint
    goethite:     0.7,
  },
  goethite: {
    lepidocrocite: 0.7,   // FeOOH polymorphs co-occur
  },

  // ---- Carbonate hosts ----
  fluorite: {
    calcite:      0.7,    // Cave-in-Rock stack — facet-selective, NOT epitaxy
    quartz:       0.7,    // Cumbria/Cornwall perimorph host
    barite:       0.7,    // documented MVT pairing
    sphalerite:   0.7,    // MVT pairing
  },
  calcite: {
    fluorite:     0.7,    // less common reverse than calcite-on-fluorite
    sphalerite:   0.7,    // common in MVT carbonate-host vugs
    barite:       0.7,
    aragonite:    0.7,    // polymorph paramorph (handled by PARAMORPH_TRANSITIONS,
                          // but late nucleation on host calcite happens too)
  },
  azurite: {
    malachite:    0.5,    // STRONG CDR route — Putnis canonical example
    chrysocolla:  0.5,    // CDR, silica-driven
  },
  malachite: {
    chrysocolla:  0.5,    // CDR continuation
    azurite:      0.7,    // cyclic CO3 chemistry can reverse
  },

  // ---- Native element hosts ----
  native_copper: {
    cuprite:      0.5,    // CDR oxidation — Cu(s) -> Cu2O surface skin
    malachite:    0.7,    // late-stage Cu carbonate over native Cu
    chrysocolla:  0.7,    // botryoidal crust over native Cu sheets
  },
  native_silver: {
    acanthite:    0.5,    // CDR tarnish — Ag(s) + S2- -> Ag2S surface (Boyle 1968)
  },

  // ---- Silicate hosts ----
  quartz: {
    feldspar:     0.7,    // pegmatite intergrowth
    topaz:        0.7,    // pegmatite + greisen
    barite:       0.7,    // late hydrothermal overprint
  },
  topaz: {
    quartz:       0.7,    // reverse pegmatite intergrowth
  },
};

// Q1b: populated. Strict-epitaxy pairs only — documented low-misfit
// pairs with real crystallographic orientation relationships.
// Format: '<nucleating>><host>' — e.g. 'sphalerite>pyrite'.
//
// Boss directive 2026-05-06: orientation-independent for v1. This
// set stays scaffolded but UNUSED by the renderer until wireframe
// primitives support parent-relative orientation. Once Q3 ships
// renderer support, pairs in this set get habit alignment to host
// facets (e.g. sphalerite tetrahedra on pyrite cube faces).
const EPITAXY_PAIRS: Set<string> = new Set([
  'sphalerite>pyrite',     // ~0.2% misfit, Ramdohr 1980
  'marcasite>pyrite',      // shared S-S, structural twinning
  'pyrite>marcasite',      // reverse polymorph
  'sphalerite>marcasite',  // shared S geometry
  'pyrite>sphalerite',     // reverse direction
  'marcasite>sphalerite',  // reverse direction
]);

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
