// ============================================================
// js/44c-split-growth.ts — W-F O5: the SPLITTING ladder (crystal that grew apart)
// ============================================================
// The SPLITTING half of ontogeny rung O5. The masking half shipped (O5a/b/c +
// the masking sceptre, js/44b, SIM 222–224) and DEFERRED this rung to "its own
// state (branching/curvature, not coverage)". Design + science: research-first
// proposal PROPOSAL-O5-SPLITTING-LADDER-2026-07-10.md (two citation-verified
// passes, boss-reviewed §9a — APPROVED FOR S-a).
//
// THE SCIENCE IN ONE NUMBER. Growth splitting is a continuous morphological
// series whose single ordering parameter is CUMULATIVE MISORIENTATION — the sum
// of many small non-crystallographic branching events (Shtukenberg, Punin, Gunn
// & Kahr, "Spherulites," Chem. Rev. 2012, 112(3), 1805–1838). The ladder:
//     none → curved (saddle, Rung 1) → split → sheaf/bowtie → spherulite (Rung 4)
// The sim already PAINTS this ladder as keyword-scored HABIT WORDS (js/07:
// saddle_rhomb / sheaf / spherulitic / radial_spray) and mostly has the render
// primitives (js/99i _makeSaddleRhomb, the hemimorphite fan, rosette sprays) —
// but nothing EARNS a crystal's place on it from growth conditions. This rung
// gives the ladder a driver, exactly as O3 earned the palisade the sim painted.
//
// TWO ROUTES, ONE INDEX — the load-bearing honesty (boss §9a #1: "do not flatten
// A and B into one monotonic 'more σ = more split' law; the opposite-σ gypsum
// fact is load-bearing"). The two routes pull OPPOSITE ways on supersaturation:
//   • A — impurity/additive autodeformation (Shtukenberg–Punin): incorporated
//     mismatch → coherency strain → the lattice bends then splits. IMPURITY is
//     the driver; fires even at LOW σ (Punin & Artamonova 2001: gypsum bending
//     STRENGTHENS at lower supersaturation). Saddle dolomite's low rung lives here.
//   • B — spherulitic crystallisation from HIGH supersaturation / gel (Beck &
//     Andreassen 2010: spherulitic CaCO₃ sets in above SI ≈ 2–3; below → faceted
//     single crystals). Impurity NOT required. The Deccan zeolite sheaves live here.
// Route C (concentric botryoidal / colloform aggregation — malachite, kidney ore)
// is NOT single-crystal splitting and is EXCLUDED (boss §9a #5).
//
// HONESTY CLAUSE (the σ*(φ) discipline, reused). The MICROPHYSICS of branching —
// WHY a lattice splits by small angles — is an OPEN question (the Chem. Rev.
// review says it "is often not addressed"). This rung renders the PHENOMENON and
// its one-index ladder, not a crowned microphysics: a coarse-grained cumulative
// index, the same discipline that let σ*(φ) ship on a threshold-shape without
// choosing between competing branching models.
//
// STAGING (the O3a/O3b · O5a/O5b template — record-unread, then flip):
//   • S-a — THIS FILE ships O5_SPLITTING_ENABLED = false. `_split` is ACCRUED on
//     crystals each growth step (the two-route integral) and the `splitAbility`
//     gate + rung bands EXIST, but NO habit/render path reads `rung`. Byte-
//     identical fleet-wide (0/38): the index is recorded, never read; consumes
//     ZERO shared RNG; touches no fluid / T / zone. tools/o5-split-census.mjs
//     pre-registers the movers + certifies noncollision with the deformation
//     saddle set (boss §9a #4).
//   • S-b — flip the flag TRUE: `rung` drives the habit choice + the existing
//     render params (saddle curvature, sheaf splay, spherulite radial fraction);
//     movers == the S-a census's split set; the deformation-saddle set is left
//     byte-identical (the two-mechanism invariant). SIM bump. First content =
//     extending the existing deccan_zeolite scenario (B-route sheaf→sphere) +
//     a saddle-dolomite scenario (A-route low rung). Calibrate the constants.

// Master switch. S-a ships FALSE (index accrued + recorded, read by NOTHING →
// byte-identical). S-b flips it TRUE in the habit/render consumers. The accrual
// itself is UNCONDITIONAL (the O3a-draw idiom: the writer always runs so the
// census observes a real index; only the CONSUMERS are gated), so this flag is
// defined-but-unread in S-a exactly as GEOMETRIC_SELECTION_ENABLED was in O3a.
let O5_SPLITTING_ENABLED = true;
function setO5SplittingEnabled(v: boolean): void { O5_SPLITTING_ENABLED = !!v; }

// W-K VOL-NEUTRAL (the heavy debt — MEASUREMENT phase). When true, a split
// crystal's c_length_mm is compacted by splitGrowthMult(index) at CONSTANT
// _volume_mm3 (add_zone re-derives a_width from the same volume, so a_width
// auto-WIDENS to conserve it — the needle→sphere at same material). Default
// FALSE: the js/85 growth loop passes extentMult 1 → add_zone is byte-identical,
// the whole fleet unchanged. tools/o5-volneutral-census.mjs toggles this at
// RUNTIME (live binding) to MEASURE the blast radius: c_length_mm feeds O3
// geometric-selection (js/44a, js/85b) + enclosure (js/85c) + paragenesis
// (js/26), so compacting it can cascade to NON-split minerals. The sixteenth
// keystone's "~8 sites / census-bounded" was optimism; this flag measures the
// truth before we choose honest-physics vs a display-only decouple.
let O5_VOLNEUTRAL_ENABLED = false;
function setO5VolNeutral(v: boolean): void { O5_VOLNEUTRAL_ENABLED = !!v; }

// The two route gains + the B-route spherulitic onset. CALIBRATED in S-b by the
// 4a.7 recipe (tools/o5-split-census.mjs σ-spread instrument): SPLIT_K_A/B are
// tuned low so a realistic impurity load (A) and a far-from-equilibrium pulse (B)
// walk a crystal up a rung or two over a full run's growth, not pinned at
// spherulite instantly. `let` so the calibration sweep rebinds without a rebuild.
let SPLIT_K_A = 0.8;                  // A-route (impurity autodeformation) gain
let SPLIT_K_B = 0.8;                  // B-route (high-σ spherulitic) gain
function setSplitKA(v: number): void { SPLIT_K_A = +v; }
function setSplitKB(v: number): void { SPLIT_K_B = +v; }

// The B-route spherulitic onset is PER-MINERAL, anchored to each mineral's own
// nucleation threshold σ_crit (MINERAL_GATES) — the far-from-equilibrium sibling
// of the masking gate's σ*₀ (proposal §3.6). WHY per-mineral, not a global
// constant: the sim's σ scale is wildly mineral-specific (dolomite σ_crit = 10,
// calcite = 1.5, and σ tails to ~1e5 at seed 42 — the census σ-spread caught it).
// A single global threshold would never fire for the high-σ_crit minerals and
// always fire for the low ones. Onset = FACTOR × σ_crit puts the spherulitic
// regime a fixed multiple ABOVE nucleation (the SI ≈ 2–3 far-from-eq image, Beck
// & Andreassen), on every mineral's own scale. The DRIVE it feeds is bounded in
// [0,1] (accrueSplitIndex) so the σ outliers saturate the B contribution rather
// than pinning the index. `let` for the sweep.
let SPLIT_SPHERULITE_FACTOR = 2.5;   // spherulitic onset = 2.5 × σ_crit (per mineral)
const SPLIT_SIGMA_CRIT_FALLBACK = 1.5;   // minerals with no MINERAL_GATES entry
function setSplitSpheruliteFactor(v: number): void { SPLIT_SPHERULITE_FACTOR = +v; }

// The mineral's nucleation threshold σ_crit, from the shared gates registry
// (js/42) the masking gate + nucleation dispatchers already read. Fallback for
// the (few) split-able minerals with no gate entry.
function sigmaCritFor(mineral: string): number {
  const reg = (typeof MINERAL_GATES_REGISTRY !== 'undefined') ? MINERAL_GATES_REGISTRY : null;
  const g = reg && reg[mineral];
  return (g && Number.isFinite(g.sigma_crit)) ? g.sigma_crit : SPLIT_SIGMA_CRIT_FALLBACK;
}
// The B-route onset for a mineral. Exposed (not inlined) so the census + tests
// compute the same boundary the accrual uses.
function sigmaSpheruliteFor(mineral: string): number {
  return SPLIT_SPHERULITE_FACTOR * sigmaCritFor(mineral);
}

// ── splitAbility — the structure-specific gate, PER ROUTE (boss §9a #3) ──────
// { a, b } in [0,1]²: how readily this structure splits by the A route (impurity
// autodeformation — bending/curved/fishtail) vs the B route (high-σ spherulitic —
// sheaf/sphere). PER-ROUTE because the two mechanisms are MINERAL-SPECIFIC, not
// interchangeable (the census caught the scalar model letting high-σ GYPSUM take
// the B route → 18 false spherulites; gypsum autodeforms, it does NOT spherulite):
//   • gypsum/selenite, saddle dolomite, curved barite → A-dominant (a≫b)
//   • zeolites, aragonite flos-ferri, siderite, radial phosphates → B-dominant (b≫a)
//   • split calcite does BOTH moderately.
// Hand-seeded from the literature's mechanism assignment (auditable like the
// fluorescence gates; a structural proxy is named-not-built). UNLISTED → {0,0}
// (splitAbilityA/B) — the safe byte-identical default honoring "don't let O5 eat
// every radiating thing" (§9a #5). Quartz/feldspar/etc. carry EXPLICIT {0,0}
// (load-bearing §9a #3: "else high σ is a nonsense wand"); cerussite (cyclic
// twinning) + malachite (C aggregation) EXPLICIT {0,0} (§9a #5 exclusions).
const SPLIT_ABILITY: Record<string, { a: number; b: number }> = {
  // ── carbonates — the fleet's core; the calibration anchor class ──
  dolomite:      { a: 0.9, b: 0.2 },   // saddle/baroque dolomite — THE A-route low-rung showcase
  calcite:       { a: 0.5, b: 0.4 },   // split calcite (A) + spherulitic calcite (B) — genuinely both
  aragonite:     { a: 0.3, b: 0.7 },   // flos ferri (Erzberg) — radial, B-dominant
  siderite:      { a: 0.2, b: 0.8 },   // spherulitic / sphaerosiderite — B
  rhodochrosite: { a: 0.3, b: 0.5 },   // radial botryoid interiors — B micro-texture
  magnesite:     { a: 0.4, b: 0.4 },
  smithsonite:   { a: 0.2, b: 0.4 },
  strontianite:  { a: 0.3, b: 0.5 },   // radiating acicular sprays
  witherite:     { a: 0.3, b: 0.3 },
  hydrozincite:  { a: 0.2, b: 0.3 },
  // ── sulfates — gypsum is the A-route classic; barite curves (A rung 1) ──
  selenite:      { a: 0.9, b: 0.05 },  // gypsum autodeformation (fishtail/ram's-horn) — A ONLY, never spherulitic
  barite:        { a: 0.5, b: 0.15 },  // curved barite (Rung 1, A); the snowball is masking, not this
  celestine:     { a: 0.4, b: 0.2 },
  // ── zeolites + fibrous / chain silicates — the Deccan B-route suite ──
  stilbite:      { a: 0.15, b: 0.9 },  // wheat-sheaf bowties (Rung 3) — B
  scolecite:     { a: 0.1, b: 0.9 },   // radial sprays — B
  mesolite:      { a: 0.1, b: 0.9 },   // hair-fine radial sprays — B
  thomsonite:    { a: 0.1, b: 0.8 },   // radial spheres — B
  heulandite:    { a: 0.2, b: 0.6 },
  chabazite:     { a: 0.1, b: 0.3 },
  prehnite:      { a: 0.1, b: 0.8 },   // botryoidal-radial spheres (Rung 4) — B
  pectolite:     { a: 0.2, b: 0.7 },   // radiating acicular ("pectolite spray") — B
  wollastonite:  { a: 0.2, b: 0.5 },   // fibrous / radiating
  // ── fibrous chain silicates (asbestiform / byssolite) — B ──
  tremolite:     { a: 0.2, b: 0.6 }, actinolite: { a: 0.2, b: 0.6 }, anthophyllite: { a: 0.1, b: 0.5 },
  chrysotile:    { a: 0.1, b: 0.5 }, amosite:    { a: 0.1, b: 0.5 }, crocidolite:   { a: 0.1, b: 0.5 },
  // ── phosphates / arsenates — radiating families, B ──
  erythrite:     { a: 0.2, b: 0.6 },   // radiating_fibrous rosettes
  annabergite:   { a: 0.2, b: 0.5 },   // erythrite sibling
  legrandite:    { a: 0.2, b: 0.5 },   // radiating golden sprays
  pyromorphite:  { a: 0.2, b: 0.3 }, mimetite: { a: 0.2, b: 0.3 },
  // ── hydroxides / oxides — radial fibre (botryoid interiors are B) ──
  goethite:      { a: 0.1, b: 0.4 },   // velvety radial; kidney-ore botryoid macro-form stays C
  millerite:     { a: 0.2, b: 0.5 },   // radiating brass hair
  // ── EXPLICIT ZEROES (documented, load-bearing — not merely absent) ──
  quartz:    { a: 0, b: 0 },           // framework silica — the gwindel TWIST is a separate mechanism
  feldspar:  { a: 0, b: 0 }, albite: { a: 0, b: 0 },   // framework — "high σ must not become a nonsense wand"
  topaz:     { a: 0, b: 0 }, beryl: { a: 0, b: 0 }, emerald: { a: 0, b: 0 }, aquamarine: { a: 0, b: 0 },
  fluorite:  { a: 0, b: 0 },           // isometric — cleaves, does not split-grow
  cerussite: { a: 0, b: 0 },           // snowflake = cyclic (110) twinning, NOT splitting (§9a #5)
  malachite: { a: 0, b: 0 },           // botryoidal = Class-C aggregation, NOT this rung (§9a #5)
};
function splitAbilityA(mineral: string): number {
  const v = SPLIT_ABILITY[mineral];
  return v && Number.isFinite(v.a) ? v.a : 0;   // unlisted → 0
}
function splitAbilityB(mineral: string): number {
  const v = SPLIT_ABILITY[mineral];
  return v && Number.isFinite(v.b) ? v.b : 0;   // unlisted → 0
}
// "Can this mineral split at all" — the census roster gate + the accrual's
// early-out. max(a,b) so a mineral susceptible to EITHER route counts.
function splitAbleFor(mineral: string): number {
  return Math.max(splitAbilityA(mineral), splitAbilityB(mineral));
}

// ── impurity_factor mineral hint (boss §9a #2: max of three sources) ──────────
// The A-route needs an impurity signal. v1 draws it from three sources and takes
// the MAX (splitImpurityFactor): (1) the masking half's `_film` φ — wired FIRST,
// it exists and is testable, and ties the two O5 halves (one dusting both masks a
// front AND seeds splitting); (2) a scenario trace proxy (a fluid-load field no
// scenario sets yet — the S-b content hook); (3) this per-mineral hint — the
// INTRINSIC autodeformation propensity a mineral carries with no external film.
// Seeded only where the science names a structural driver: saddle dolomite's
// Mg-excess (Ca-excess dolomite incorporates Mg on the wrong site → the coherency
// strain that bends {104}). Kept minimal; most A-route firing comes from films/
// traces so an unfilmed clean crystal of most species does NOT autodeform.
const SPLIT_IMPURITY_HINT: Record<string, number> = {
  dolomite: 0.3,        // Mg-excess incorporation — the saddle autodeformation seed
};

// ── SPLIT_RADIAL_HINT — the B-route's INTRINSIC baseline (symmetric to the A-hint) ──
// Some minerals are radial/fibrous/spherulitic by STRUCTURE, not by supersaturation:
// the natrolite-group chain silicates (scolecite/mesolite) are fibrous at ALL
// conditions; stilbite is intrinsically sheafy; prehnite/thomsonite botryoidal-
// radial. In the sim these never reach the far-from-eq σ band (the census caught
// the Deccan zeolites accruing ~0), yet the sheaf/sphere is their SIGNATURE. So the
// B-drive floors at this intrinsic baseline: bDrive = max(σ far-from-eq, radialHint).
// This mirrors the A-route's SPLIT_IMPURITY_HINT (dolomite Mg) — an intrinsic seed
// the extrinsic driver (σ / impurity) adds to. Carbonates get NONE (calcite/dolomite
// spherulite ONLY when driven far-from-eq, not intrinsically). Seeded from the
// structural habit; a structural proxy is named-not-built.
const SPLIT_RADIAL_HINT: Record<string, number> = {
  // natrolite-group + framework zeolites — intrinsically fibrous/sheafy/radial
  scolecite: 0.85, mesolite: 0.85, stilbite: 0.8, thomsonite: 0.7,
  heulandite: 0.5, chabazite: 0.35, prehnite: 0.7, pectolite: 0.7,
  // fibrous chain / asbestiform silicates
  tremolite: 0.55, actinolite: 0.55, anthophyllite: 0.5, wollastonite: 0.45,
  chrysotile: 0.6, amosite: 0.6, crocidolite: 0.6,
  // radial carbonate/oxide/phosphate/sulfide habits (structural, not σ)
  aragonite: 0.4,      // flos ferri coralloid-radial
  siderite: 0.4,       // sphaerosiderite botryoid-radial
  erythrite: 0.45, annabergite: 0.4, legrandite: 0.4,
  goethite: 0.35, millerite: 0.5, rhodochrosite: 0.3, smithsonite: 0.3,
};
// A structurally-radial mineral expresses its habit once it has grown past this
// size — below it, even a fibrous zeolite is only a nucleation speck, not yet a
// sheaf/sphere. The radial floor ramps linearly to full over [0, this]. Small
// (~0.3 mm) so the Deccan zeolites (0.3–1.7 mm at seed 42) express, while a 7 µm
// speck stays 'none'. The growth-integrated accrual still governs the σ/impurity
// routes; this floor only lifts the INTRINSICALLY radial minerals to their rung.
const SPLIT_RADIAL_REF_MM = 0.3;

// The rung bands. PLACEHOLDER cuts for S-a (unread); S-b calibrates them against
// the SPLIT_K_A/B scale so a realistic run distributes crystals sensibly across
// the ladder rather than piling at one rung. Mirrors §4's worked example.
function splitRung(index: number): string {
  if (!(index > 0)) return 'none';
  if (index >= 0.85) return 'spherulite';
  if (index >= 0.55) return 'sheaf';
  if (index >= 0.25) return 'split';
  if (index >= 0.08) return 'curved';   // saddle / bent — Rung 1
  return 'none';
}

// ── the SIM effect (S-b): axial growth throttle by split index ────────────────
// A splitting crystal packs the same material into a compact radial/branched form,
// so its coherent MAX AXIAL EXTENT is less than the single crystal that material
// would otherwise have built — a spherulite's diameter < the needle's length it
// replaced (Beck & Andreassen 2010: spherulites REPLACE faceted single crystals
// above the onset; Sunagawa's morphodrom packs the split/dendritic forms at high
// driving force). So the per-step axial increment is throttled by the accrued
// index: 1.0 at the base (no split) down to SPLIT_AXIAL_FLOOR at full spherulite.
// FLOORED (never arrests — a split crystal keeps growing, just less axially; this
// is not O3 burial nor O5 masking). Gated by O5_SPLITTING_ENABLED at the js/85
// call site: flag off → mult is never applied → byte-identical.
let SPLIT_AXIAL_FLOOR = 0.7;   // spherulite grows its axis at 70% — compact, not arrested
function setSplitAxialFloor(v: number): void { SPLIT_AXIAL_FLOOR = +v; }
function splitGrowthMult(index: number): number {
  const x = Math.max(0, Math.min(1, index || 0));
  return 1 - (1 - SPLIT_AXIAL_FLOOR) * x;   // 1 at index 0 → SPLIT_AXIAL_FLOOR at index 1
}

// impurity_factor = max(film φ, scenario trace, mineral hint). Pure, DOM-free.
function splitImpurityFactor(crystal: any, conditions: any): number {
  const filmPhi = crystal && crystal._film
    ? Math.max(crystal._film.phi_term || 0, crystal._film.phi_prism || 0) : 0;
  // Scenario trace proxy — a fluid impurity-load field the S-b content hook sets
  // (no fleet scenario sets it yet → 0 today, so this source is dark until S-b).
  const trace = conditions && conditions.wall && typeof conditions.wall.split_trace === 'number'
    ? Math.max(0, Math.min(1, conditions.wall.split_trace)) : 0;
  const hint = (crystal && SPLIT_IMPURITY_HINT[crystal.mineral]) || 0;
  return Math.max(filmPhi, trace, hint);
}

// ── the accrual — the two-route cumulative-misorientation integral ────────────
// Called from the growth loop (js/85) each positive-growth step, right before
// crystal.add_zone. Integrates rateA + rateB over the realized growth increment
// into crystal._split.index, updates the rung + the REQUIRED route provenance
// (boss §9a #1: `_split.route` is not optional narration — a saddle earned by A
// and one reached by B are different records). CONTRACT (the S-a byte-identity
// guarantee): consumes ZERO RNG; reads only the crystal's σ (via its
// supersaturation fn, the js/85 masking-gate pattern) + film/impurity; MUTATES
// ONLY crystal._split. Read by nothing in S-a → the fleet is byte-identical.
//
// Byte-identity of the untouched fleet falls out of the ARITHMETIC, no `if`
// guard: a crystal with splitAbility 0 (quartz, feldspar, everything unlisted),
// OR with impurity 0 AND σ ≤ σ_spherulite*, accrues rate 0 → `_split` is never
// written → serialized output never widens (the `_deformation` idiom). The split
// set is exactly {split-able minerals that are dusted/impure (A) OR far-from-
// equilibrium (B)} — census-bounded, the O4b/O5b certificate pattern.
function accrueSplitIndex(crystal: any, conditions: any, dGrowthUm: number): void {
  if (!crystal || !(dGrowthUm > 0)) return;
  const abilityA = splitAbilityA(crystal.mineral);
  const abilityB = splitAbilityB(crystal.mineral);
  if (abilityA <= 0 && abilityB <= 0) return;     // structure-gate: never splits (either route)

  const impurity = splitImpurityFactor(crystal, conditions);

  // σ_local — the crystal's supersaturation for its mineral (the exact source the
  // O5b masking gate reads; S-b may refine to the per-cell C1 σ). Pure calculator;
  // absent fn → 0 (can't measure = can't drive the B route).
  let sig = 0;
  const sfn = conditions && conditions['supersaturation_' + crystal.mineral];
  if (typeof sfn === 'function') {
    try { const v = sfn.call(conditions); if (Number.isFinite(v)) sig = v; } catch (_e) { sig = 0; }
  }

  // B-route far-from-equilibrium DRIVE, bounded in [0,1]: how far past this
  // mineral's spherulitic onset (2.5 × its own σ_crit) the crystal sits, saturating
  // at 1 one onset-width above. Bounded so a σ outlier (dolomite can see σ ~1e5)
  // saturates the B contribution instead of pinning the index in a single step.
  const sigmaSpherulite = sigmaSpheruliteFor(crystal.mineral);
  const bDriveSigma = sigmaSpherulite > 0
    ? Math.max(0, Math.min(1, (sig - sigmaSpherulite) / sigmaSpherulite)) : 0;
  // B-drive floors at the mineral's INTRINSIC radial baseline — a structurally
  // fibrous zeolite reaches its sheaf/sphere even when the sim never drives it
  // far-from-eq; a carbonate (no radial hint) needs the σ drive.
  const bDrive = Math.max(bDriveSigma, SPLIT_RADIAL_HINT[crystal.mineral] || 0);
  const rateA = SPLIT_K_A * impurity * abilityA;  // impurity-driven, σ-agnostic (fires even at low σ)
  const rateB = SPLIT_K_B * bDrive * abilityB;    // spherulitic: per-mineral σ onset ∨ intrinsic radial
  if (rateA <= 0 && rateB <= 0) return;           // nothing accrues → no state churn

  const dGrow = dGrowthUm / 1000;                 // µm → mm, the integral's length scale
  const prev = crystal._split || { index: 0, sumA: 0, sumB: 0 };
  const sumA = (prev.sumA || 0) + rateA * dGrow;
  const sumB = (prev.sumB || 0) + rateB * dGrow;
  let index = Math.max(0, Math.min(1, (prev.index || 0) + (rateA + rateB) * dGrow));
  // STRUCTURAL FLOOR — intrinsically radial minerals (natrolite-group zeolites,
  // stilbite, prehnite, byssolite) express their sheaf/sphere by STRUCTURE, not by
  // accumulated growth: a small scolecite is still a radial spray. So the index
  // floors at the mineral's radial baseline, RAMPED by size (a nucleation speck is
  // not yet a sphere; a matured crystal sits at its floor). Growth-integration
  // still governs the σ/impurity routes above; this only lifts the structural set.
  const radialFloor = SPLIT_RADIAL_HINT[crystal.mineral] || 0;
  if (radialFloor > 0) {
    const grownMm = (crystal.total_growth_um || 0) / 1000;
    const ramp = Math.max(0, Math.min(1, grownMm / SPLIT_RADIAL_REF_MM));
    index = Math.max(index, radialFloor * ramp);
  }
  // route provenance (REQUIRED): which route(s) actually contributed. 'both' when
  // each fired at least once; else the lone route. `dominant` records which
  // supplied more of the accumulation, for S-b narration.
  const route = (sumA > 0 && sumB > 0) ? 'both' : (sumA > 0 ? 'A' : 'B');
  crystal._split = {
    index,
    rung: splitRung(index),
    route,
    dominant: sumA >= sumB ? 'A' : 'B',
    sumA, sumB,
    driver: { sigma: sig, impurity },
  };
}
