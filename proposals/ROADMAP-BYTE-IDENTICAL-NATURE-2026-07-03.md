# ROADMAP — byte-identical to nature

**2026-07-03 · the convergence master plan · boss directive: "detailed actionable plans to take
vugg simulator from its current level of detail to a true byte identical reproduction of nature…
broken into actionable parts. the data needed for this project might not be freely available.
i have a lot of primary sources in the form of identified crystals."**

This document is the map for the multi-year climb. It changes NO current priorities — the
boss-set stones (calcite σ/Ca:CO₃ lever, then the local-σ depletion field, Depth-C colour on
call, Depth-B lustre parked) remain exactly as recorded in
`HANDOFF-FROZEN-G-AND-OPTICS-A-2026-07-02.md`. What this adds is the frame those stones sit in,
the workstreams behind them, and the answer to the data problem — which turns out to live in a
drawer cabinet, not a journal paywall.

> **AMENDED 2026-07-03 (same day, boss follow-up — "the big ask"):** *"the strange
> interpenetrations of crystals growing together, the way one side of a crystal may grow
> differently than another side. how uneven mineral inclusions can alter later layers of growth.
> right now the sim is focused on creating the idealized geometric forms rather than the complex
> and incomplete way they form in nature."* That field has a name — MINERAL ONTOGENY — and it is
> now **workstream W-F** (§6b) with its own researched, citation-verified arc proposal:
> **`PROPOSAL-ONTOGENY-2026-07-03.md`**. Two more corrections from the same message: the catalog
> is only **~1/5th of the collection the boss has access to** (the W-A bench ceiling is ~5×
> higher than §2's census), and T0 below now reads honestly — held for isolated individuals,
> idealized at the aggregate.

---

## 0. What "byte-identical to nature" means here — the convergence ladder

In this repo "byte-identical" already has a precise meaning: two runs produce the same bytes.
Nature doesn't emit bytes, so against nature the term is an asymptote — but an asymptote with a
measurable distance. The operational definition: **the sim is byte-identical to nature at the
precision of our instruments when the specimen bench (§2) cannot tell the render from the rock
on any metric we can afford to measure.** Every rung below either shrinks that distance or
sharpens the instrument that measures it. The ladder, so progress is falsifiable at every tier:

| tier | claim | who/what falsifies it | status today |
|---|---|---|---|
| **T0 — genre** | a mineralogist names the SPECIES from the render alone | the boss's eye; any field guide | held for shipped tenants **as isolated individuals**; the AGGREGATE is idealized — real druses are contact faces, buried losers, asymmetric individuals (boss call 2026-07-03 → W-F) |
| **T1 — locality** | they name the LOCALITY (Elmwood vs Naica vs Grimsel habit+colour+association) | provenance-known specimens; the image-corpus method | partial — scenario-tuned habits exist; colour is still the class palette |
| **T2 — specimen-metric** | rendered metrics match a SPECIFIC catalog specimen within measured tolerance (interfacial angles, aspect ratios, size distribution, CIELAB colour under a known illuminant) | `tools/specimen-bench.mjs` (§2, to be built) against catalog measurements | **does not exist — the keystone gap** |
| **T3 — specimen twin** | given a specimen, the sim grows ITS digital twin: a fluid history is inverse-fitted within geologic plausibility and the twin passes T2 on held-out metrics | held-out metrics + defer-to-geology constraints | far |
| **T4 — process identity** | the twin passes T2 with NO fitting — measured kinetics + real thermodynamics end-to-end predict the specimen | everything below feeding forward | the asymptote |

The metric of the whole project from here on: **specimen-bench pass rate, by tier.** Green CI
stays "not yet falsified"; the bench is where falsification gets teeth
(`feedback_terminal_verification_specimens` — the boss: "the final end of checking will be
verifying everything against the real minerals").

**Fidelity budget per tier** (added 2026-07-03 from the rockbot review, point #8 — "how close
is close enough" so effort allocates correctly; don't spend T4 precision on T0 phenomena):

| tier | error budget | how measured |
|---|---|---|
| T0 | expert consensus (formally: >2 blind identifications agree; practical proxy today: the boss + a field guide) | blind survey / the confrontation ritual (A5) |
| T1 | "same field-guide page" — locality named or shortlisted | image-corpus method against provenance-locked photos |
| T2 | within the bench measurement's OWN error bars (each A3 row carries them) | A4 harness |
| T3 | inverse-fitted fluid history stays inside geologic plausibility bounds (T, pH, fO₂ ranges) | PHREEQC cross-check (B2) + literature ranges |
| T4 | forward prediction inside the parameter-uncertainty envelope (ensemble runs, 95% CI) | ensemble + bench |

**T4 stop condition** (the review's phrasing, adopted verbatim): *"adding a new specimen doesn't
require a new fitted parameter — the existing physics-constrained ensemble predicts it within
bench error bars."* Generalization, applied to geological simulation. That is what "done"
means at the top of the ladder.

---

## 1. The gap census — what nature does that the sim doesn't yet

Grounded in the tree as of `69203ad` (SIM 214). "Have" means shipped and tested, not perfect.

| dimension | have (in-tree today) | gap (the nature-side remainder) | workstream |
|---|---|---|---|
| **thermo/aqueous** | Davies activity coefficients (js/20a, valid to I≈0.5); Bjerrum carbonate speciation + open-system DIC (js/20b); Ksp(T)/pK(T) for carbonates+sulfates; Nernst Eh/pe (js/20c); thermo-coverage self-check | Pitzer for I=3–5 MVT/halite brines (already flagged in-tree as the known follow-up); full multi-element speciation solve (ion pairs beyond carbonate); solid solutions + trace partitioning; ΔH/ΔGf debts (dolomite/siderite ΔH, witherite ΔGf) | **W-B** |
| **kinetics** | per-mineral σ engines + σ_crit gates; PWP carbonate rate law (js/52b); graduated competition; per-cell strangulation; nucleation seeds | face-specific rate laws R(σ,T) per face family (the physics under habit); the local-σ depletion field (boss stone #3 — bulk σ provably can't shape form) | **W-C** |
| **form** | Wulff central-distance model, 6 tenants / 5 crystal systems, live-maturing g (4a.8); morphology registry 8 tenants; habit variants; earned-form chemistry levers (wulfenite Pb:Mo); spontaneous-twin roll (85b) + twin-law data in minerals.json | Wulff coverage beyond 6 tenants; twin LAWS as rendered geometry (swallowtail, penetration, Japan-law — the roll exists, the body doesn't); crystal-size-distribution statistics on plates | **W-C** |
| **surface** | calcite terraces; pyrite striations; etch overprint (SIM 212); CDR/frost states | growth hillocks + vicinal faces from the same kinetic params; striation generalization (quartz m-face transverse striations); cleavage/fracture on broken faces | **W-C** |
| **optics** | Depth-A diaphaneity SHIPPED (94/180 two-source verified → % translucency); lustre data recorded (parked, boss call); trace-cation colour dispatchers (V⁴⁺, smoky, garnet Cr/Mn/Fe) | Depth-C body colour (class palette → species/chemistry colour); zoned colour + phantoms; inclusions (chlorite/rutile/two-phase); fluorescence render (chemistry-side UV exists in zone bars; no emissive render) | **W-D** |
| **context** | 37 scenarios; paragenesis/substrate affinity (js/26); open_system walls; wall composition classes | host-rock lithology as a rendered material (the vug sits in a rock, not a void); matrix/gangue textures; more locality scenarios (Sweetwater, Elmwood slated) | **W-E** |
| **ontogeny (individual + aggregate)** | ideal convex Wulff bodies (full polyhedra, base-at-anchor); enclosure/liberation bookkeeping the renderer never reads (js/85c:672-751); spontaneous-twin roll; sceptre/etch as DECLARED overprints; c-axis hard-coded wall-normal | attachment half-forms; unequal face development (per-face h_i — the kernel already stores {n,d} per face; js/46:431 is the single broadcast point); induction/contact surfaces (neighbor meshes interpenetrate freely today); EARNED geometric selection; engulfment render; ELO phantoms/sceptres; hopper+recovery | **W-F** |
| **cavity (the stage itself)** | sphere-union profile builder + 5 architecture archetypes + per-scenario knobs (js/22); per-cell dissolution recession (ring 0 ONLY — dynamically 2D); star-convex topology ceiling | genesis-shaped cavities (the alpine-cleft scenarios are round 'pocket' cavities today); 3D wall microtexture (zero exists); primer coats + substrate conditioning; substrate-aware botryoidal (the 4-blob ignores the wall); precursor-dissolution genesis (Chowns & Elkins ✓) | **W-K** |
| **verification** | cold-ci; canary; seed-42 baselines + strip archive/differ; probe/census/sweep idiom; optics-audit; image-corpus method | **the specimen bench — NOTHING today verifies against a real rock quantitatively.** The apex instrument is missing; everything else is proxies | **W-A** |

---

## 2. W-A — THE SPECIMEN BENCH (keystone: the boss's primary sources become the dataset)

The boss's sentence "the data needed might not be freely available — I have a lot of primary
sources in the form of identified crystals" is the load-bearing insight of this whole plan. The
scarcest data in this field is not thermodynamics (free, §7) — it is **measured visual/geometric
ground truth with known provenance**. Mindat is bot-walled; journal figures are paywalled and
uncalibrated. A 1,217-specimen catalog with photos, localities, and a capture pipeline is a
dataset the literature cannot buy. Census (run 2026-07-03 on the preserved 2026-05-11 snapshot;
live host unreachable today — recount when it's back):

- **98 of the sim's 180 species have ≥1 specimen in the catalog; 1,044/1,217 specimens (86%)
  match a sim species** — before name-bridging. Bridges found and verified in-tree: catalog
  "celestite"→`celestine`, "thompsonite"→`thomsonite`, "garnet"→`grossular`, "sulphur"/"copper"/
  "silver"/"gold"→`native_*`. Post-bridge the overlap is ~105+/180 species.
- Deep benches where it matters: **quartz 179, calcite 153, rhodochrosite 49, fluorite 44,
  azurite 30, tourmaline 28, barite 27, selenite 27, pyrite 23, vanadinite 22, wulfenite 21,
  sphalerite 16, galena 10** — five of the six Wulff tenants have double-digit specimen benches;
  the calcite lever (boss stone #2) has the deepest bench in the collection.
- 1,953 photos across 367 specimens (snapshot); UV photography (365/310/255 nm) is first-class
  in the capture design — that is D4's ground truth, already planned for.

| rung | deliverable | detail | size |
|---|---|---|---|
| **A1 — bridge + anchors** | `data/specimen-anchors.json` + the species bridge table | Map catalog labels→sim keys (the 4 bridges above + a full pass over the 150 unmatched labels). Select ~24 ANCHOR specimens spanning the scenario space (MVT: fluorite/galena/sphalerite/barite; alpine: quartz; supergene: azurite/malachite/wulfenite/vanadinite; evaporite: selenite/halite; carbonate: calcite dogtooth AND nailhead, rhodochrosite). Anchor = catalog id + species + locality + which scenario claims it. **Privacy rule: the public repo carries id/species/locality/measurements ONLY — never valuations, dealers, provenance notes; photos never leave the LAN** (the harness resolves catalog ids against the local snapshot/host via env var). | S — read-only on the snapshot, one session |
| **A2 — capture protocol** | **✅ DELIVERED 2026-07-03 as `SPECIMEN-DIGITIZATION-TEMPLATE-2026-07-03.md`** (boss ask, same day) — the full data contract: 5-block record (identity/capture-slots/measurements/grow/biography) with evidence levels, 3 tiers (S survey / D document / B bench), the ~20-shot slot manifest, verified UV practice (exciter+barrier filters; FMDB-style per-λ eye-reads ARE the datum), hardware ladder D0→D3 ending at 🪨's Eyes (the rose-engine design, mirrored in-tree; OpenScan Mini is the validated open-source precedent). Pilot before protocol-final: agent batch pass on the Thompsonite flat. | delivered; capture is ongoing |
| **A3 — metric extraction** | `tools/specimen-metrics.mjs` + measured rows in specimen-anchors.json | From protocol photos: aspect ratios, interfacial angles (photogrammetry-lite: face-on shots + known geometry class beat full 3D reconstruction), CIELAB colour off the grey card, druse crystal-size counts off plate shots. **Plus the W-F ontogeny metrics (added 2026-07-03, review point #5): contact fraction, asymmetry index (h_i variance within a form), survivor density vs height, intergrowth count** — see `PROPOSAL-ONTOGENY-2026-07-03.md` §4. Each value stored WITH error bars and the photo id it came from — a measurement column, same discipline as the optics `source` column. | M–L (re-sized with the ontogeny metrics) |
| **A4 — the bench harness** | `tools/specimen-bench.mjs` | For each anchor: run its claimed scenario headless (agent-api/gen-baseline idiom), extract THE SAME metrics from the rendered mesh (kernel-truth path — the wulff sweep tools already read mesh geometry), compare within the anchor's error bars. **PASSIVE first** (`feedback_passive_instrument_not_gate`): it accretes a per-anchor record like canary; individual metrics get promoted to pinned tests only once stable. Wire a nightly row into vugg-canary. | M |
| **A5 — the confrontation ritual** | `tools/specimen-contact-sheet.mjs` + a standing session ritual | Render-vs-photo side-by-side sheets per anchor for the boss's eye — his geometric intuition is the best detector in the loop; the sheet is the tool that feeds it. Ritual: every shipped habit/colour/paragenesis names its specimen-debt in the commit; the bench pays debts down; the sheet is how a debt gets marked paid. | S |

W-A has no dependencies and its first two rungs are cheap. It is also what rescues W-C's data
problem (below): where face-kinetics tables are paywalled, **the anchors become the calibration
set — fit the rate-law parameters so rendered habit metrics match measured specimens.** The
rocks replace the missing tables. That is T2 discipline producing T4 progress.

## 3. W-B — aqueous bedrock (the water must be true before its diary can be)

Bedrock-over-effect-hacks applies hardest here: everything downstream (form levers, colour
chemistry, depletion) reads the fluid. In-tree comments already name B1 as the known follow-up.

| rung | deliverable | data + source | size / SIM |
|---|---|---|---|
| **B1 — Pitzer for brines** | Pitzer-HMW84 activity model behind the existing `speciesActivity()` seam, engaged above I≈0.5 (Davies keeps the low-I regime — it's within ~10% of Pitzer there and cheap) | Harvie–Møller–Weare 1984 (GCA 48:723) coefficients; PHREEQC's `pitzer.dat` (USGS, public domain) as the machine-readable source | L · SIM bump + rebake; MVT + evaporite scenarios move, that's the point |
| **B2 — PHREEQC cross-check instrument** | `tools/phreeqc-crosscheck.mjs`: run the canonical scenario waters through PHREEQC (free USGS binary, offline tool — never a sim dependency), table our SI vs theirs per (water, mineral, T) | PHREEQC 3 + wateq4f/pitzer databases, all free | M · instrument only, no SIM change — **build BEFORE B1 so Pitzer lands against a truth table** (extends the thermo-coverage-check discipline) |
| **B3 — close the ΔH/ΔGf debts** | dolomite/siderite ΔH, witherite ΔGf (the OPEN items in `project_vugg_thermo_verification`) + any B2 flags | Robie & Hemingway 1995, USGS Bulletin 2131 — **free, verified today: [pubs.usgs.gov/publication/b2131](https://pubs.usgs.gov/publication/b2131)** | S · data fix + rebake if SI shifts |
| **B4 — solid solutions + trace partitioning** | (Zn,Fe)S with Fe/Zn from the fluid (the sphalerite amber→black axis — a bedrock feed for Depth-C, not an effect hack); Mg-calcite already has an axis; (Ba,Sr)SO₄; partition coefficients as a sourced data column like optics | Lorens 1981 (GCA 45:553, Sr/Mn in calcite) and kin — scattered, partly paywalled [from-memory citation, verify at build time]; mitigation: abstracts + the bench (fit D_Fe so rendered sphalerite colour matches the 16 catalog specimens' localities) | M–L · SIM bump |
| **B5 — full speciation solver** | Newton mass-action + mass-balance across the ~10 master elements per scenario, replacing per-class supersat shortcuts where they diverge; ion pairs (CaSO₄⁰, PbCl⁺…) | equilibrium constants from wateq4f (free); B2 is the acceptance instrument | XL · SIM bump; **performance risk, see §8 mitigation** |

## 4. W-C — kinetics & form (the boss's next stones live here)

| rung | deliverable | notes | size / SIM |
|---|---|---|---|
| **C0 — calcite σ/Ca:CO₃ lever** ✅ SIM 217 (`299a270`, 2026-07-06) | SHIPPED by the 4a.7 recipe: calciteMorphForm gains the Ω branch (OMEGA_SCALENO=12, placed in the fleet's own measured gap; subaqueous-gated per Weremeichik 2024; González/Carpenter/Lohmann 1992 + García-Carmona 2003 direction). Sweep: ONE flip (deccan → its iconic golden dogtooth, locked), all other genres HOLD, elmwood dual-fenced (Mg AND Ω — the fragility fixed). Render rider: calcite Wulff biasC=B(Ω̄) integral, id-hash retired (2nd tenant after wulfenite). **The Ca:CO₃ HALF: recorded (_wulffCalInt molar-r) but NO sim signal (bookkeeping pool, not activity) — its gate PRE-REGISTERED for B5.** OPEN: the T2 acceptance pair still wants A1 anchors (specimen 1298 named); probe: tools/c0-calcite-form-probe.mjs | SIM bump (one word flip; 0/38 counts, 0/38 strip content) |
| **C1 — local-σ depletion field** ◐ directional half ✅ 2026-07-07 (`e08ab3d`) | EV check done (`tools/c1-depletion-ev-probe`, the pre-registered mass-conservation check): solute books BALANCE, the field is real (34% of 1131 fluid crystals see local σ ≥10% off bulk, 31% carry a base→tip gradient). Key finding — RATE already reads local (`_runEngineForCrystal` swaps in cell.fluid); only FORM read bulk/frozen. Shipped the three DIRECTIONAL consumers (O1a real exposure + O1b shadow + O2 integrated weights) as ONE render-only tranche — baseline byte-identical, NO rebake (the L–XL "SIM bump + full rebake" was pessimistic; the frozen-param converse came back empty). DEFERRED with numbers: the SCALAR-chemistry half (biasC/form reading cell σ) is a no-op today — only 1 calcite Wulff tenant fleet-wide and its local Ω sits in a flat band; re-opens when B5 sharpens σ or more chemically-levered Wulff tenants join. | directional shipped render-only; scalar half awaits tenants / B5 |
| **C2 — face-specific rate laws** | replace per-tenant habit heuristics with R(σ,T) per face family where measurable: BCF spiral / birth-and-spread regimes | Burton–Cabrera–Frank 1951; calcite step kinetics Teng–Dove–De Yoreo 2000 (GCA 64:2255) [from-memory, verify]; barite Pina et al. 1998 (Nature 395:483) [from-memory, verify]. **Paywall risk HIGHEST here — mitigation is the bench-as-calibration-set (§2)** | XL · per-tenant increments, each byte-identical-or-bump |
| **C3 — surface microtopography** | hillocks/vicinals/striations as displacement+normal maps GENERATED from the same kinetic parameters (hillock slope = step height/spacing), not noise textures | ships per-tenant after its C2 rung so the bedrock exists; quartz m-face striations are the iconic first target (179 quartz specimens to check against) | M per tenant · render-only |
| **C4 — twin geometry** | render the twin laws the data+roll already carry: gypsum swallowtail, fluorite penetration, quartz Japan-law, calcite butterfly; twin = crystallographic operation applied to the existing Wulff polyhedron | staurolite (10+2 specimens, "twin xls" literally in the catalog labels) is a future add-mineral + twin tenant in one | M per law · render-only |
| **C5 — crystal size distributions** | druse populations follow measured CSD shapes; compare sim per-vug histograms against A3 plate counts | Kile & Eberl (Am. Min., CSD growth laws) [from-memory, verify]; honest successor to the rejected per-vertex flip (scale-starved) — statistics, not per-vertex placement | M · likely SIM-neutral (analysis + placement tuning) |

## 5. W-D — optics completion (order set by the boss, not by ease)

| rung | status + plan | size |
|---|---|---|
| **D0 — lustre** | **PARKED by boss call 2026-07-03 — data exists in text form, that is enough; do not build unprompted.** Listed only so the map is complete. | (easy, and that doesn't matter) |
| **D1 — Depth-C body colour** | **on boss call, can jump the queue any time (render-only).** Chromophore column in minerals.json with source discipline (Fe²⁺/Fe³⁺/Mn²⁺/Cu²⁺ intrinsic; smoky/amethyst as irradiation+trace flags the sim's water already knows about). Data: **Caltech Mineral Spectroscopy Server — free, verified today ([minerals.gps.caltech.edu](http://minerals.gps.caltech.edu/), 1000+ ASCII visible/IR spectra)** + Nassau's colour-cause taxonomy; absorption→CIELAB→albedo per species, THEN per-crystal modulation from the sim's own fluid (B4 feeds this: sphalerite Fe-darkening). **ON-RAMP SHIPPED 2026-07-07 (`86fa07e`): LOCAL CRYSTAL COLOUR** — per-crystal chemistry TONE (trace load → deepening, no hue claim) + a deterministic legibility floor, so same-species neighbours read apart today; D1's per-species HUE composes OVER this tone when it lands. Acceptance: colour ΔE against A3's grey-card CIELAB rows — colour is what a specimen falsifies fastest. | L |
| **D2 — zoned colour + phantoms** | colour as a function of growth-zone history riding the sector-zoning vertexColors rails (amethyst phantoms, banded fluorite). The zone recorder already exists; this is D1 × time. | M after D1 |
| **D3 — inclusions** | chlorite phantoms (alpine cleft), rutile needles in quartz, the two-phase fluid inclusions Naica is famous for — each a declared, sourced tenant, not a generic speckle shader | M per tenant |
| **D4 — fluorescence** | UV render mode driven by activator data (Mn²⁺ calcite, Eu²⁺ fluorite); ground truth = the catalog's first-class 365/310/255 nm photo sets. A delight rung — schedule late, it will land like the sonifier. | M |

## 6. W-E — worlds & context

| rung | deliverable | size |
|---|---|---|
| **E1 — host rock as material** | the vug's wall rendered as its lithology (limestone vs basalt vs pegmatite — wall composition classes already exist in js/22; field-guide restraint applies: the rock is a supporting actor) | M |
| **E2 — locality scenarios** | Sweetwater snowball barite + Elmwood perimorph (already slated in memory) and successors — **new rule from this roadmap: every new scenario names its bench anchor** (a catalog specimen or an explicit "no specimen yet" debt) | M each |
| **E3 — replacement textures** | pseudomorph/perimorph surface fidelity (the cast exists; the granular replacement texture doesn't) | M |

## 6b. W-F — ontogeny: the imperfect real (added 2026-07-03 — THE BIG ASK)

The full arc lives in **`PROPOSAL-ONTOGENY-2026-07-03.md`** (researched + citation-verified the
same day: Kolmogorov 1949 geometric selection, Self & Hill 2003 induction surfaces, Takahashi
et al. 2004 ELO sceptre mechanism, Shtukenberg et al. 2012 splitting grades, Sizaret et al.
2006 flow asymmetry, Norris & Watson 2009 kinematics — plus the census that found the Wulff
kernel already stores d per individual face, so unequal development is a data-generation
change, not kernel surgery). Rungs in brief:

| rung | one line | SIM |
|---|---|---|
| **O0** ✅ SIM 215 (2026-07-03) | attached crystals become HALF-FORMS clipped at the wall with a real contact scar | render-only |
| **O1** ✅ O1a real exposure + O1b shadow ✅ 2026-07-07 (`e08ab3d`, C1 tranche, render-only) | unequal face development: per-crystal kExp now read from the interior voxel field's growth-weighted base(d=0)/tip(d=max) σ gradient (js/45 _o1aExp), retiring the fleet-wide 0.18 constant the c1-depletion-ev-probe exposed as a fiction — the 13 Wulff tenants are the CALM well-fed minerals and symmetrize toward their true near-isotropic form (live kernel-truth: y-asymmetry 6–10× down). O1b neighbor-shadow reinforces it from the O2 pre-pass. Per-FACE directional shadow pre-registered. Steno held. | render-only, 0/38 |
| **O2** ✅ 2026-07-06 (`eea52bc`) + integrated-growth weights ✅ 2026-07-07 (`e08ab3d`, C1) | induction/contact surfaces: crystals clipped at growth-rate-weighted meeting planes, cuts capped MATTE. The probe (`tools/o2-contact-probe.mjs`) reshaped it — the Wulff face-space clip reached only 7 crystals, so O2 ships a GENERIC convex-mesh clipper (`_clipConvexGeom`, js/46) reaching 622 contacted convex crystals fleet-wide. Meeting plane now weighted by INTEGRATED growth (total_growth_um), current-size fallback — faithful for the dissolved/anisotropic drift population. Concave (hopper/botryoidal/twin, ~174) still DEFERRED. 0/38 drift | render-only |
| **O3** | EARNED geometric selection: random nucleation tilt + competitive burial; analytic oracle = Gray's d^(−1/2) survivor law | SIM bump |
| **O4** | engulfment made visible (the enclosure mechanic EXISTS sim-side, renderer never reads `enclosed_by`) + coats_front/embedded inclusion classes | render + adjacency fix |
| **O5** | inclusion-perturbed regrowth: ELO phantom/sceptre earned from per-face-class masking; split-growth ladder to spherulite | SIM bump |
| **O6–O8** | flow one-sidedness (Sizaret) · hopper+recovery (Berg/σ*) · texture classifier + cockade substrates | mixed |

**Prior-art note:** no published simulator applies competitive faceted-polyhedra growth to
druses (closest: crack-seal vein models, Bons 2001 / Nollet 2005). This workstream is novel
territory on 75-year-old verified mathematics.

## 6c. W-G — atomistic parameterization (future research stub, named 2026-07-03 per the rockbot review)

Not scheduled; named so the door exists. C2's face-specific rate laws take parameters that
atomistic theory (BCF, Kossel-site kinetics) predicts and paywalled experiments measure. The
bench substitutes for now (fit to anchors). If open kinetics tables appear, an interlibrary
channel opens, or author copies land, **this is the plug point**: replace bench-fitted C2
parameters with measured/derived ones, tenant by tenant, and re-run the same sweeps. Each
substitution moves that tenant from T2-calibrated toward T4-predicted — the fidelity budget's
top tier is reached exactly here.

## 6d–6f. The horizon ladders (added 2026-07-03, proposed by rockbot 🪨✍️, evaluated + accepted)

Post-Phase-5+ directions that are genuinely new architecture, not more rungs. Named now so the
ledger has letters for them; NOT scheduled. (Letter bookkeeping: the review's passing mention
of "W-H: texture classification" is superseded — photo-side texture ML stays unnamed until it
is ever real; the letters below are canonical.)

### 6d. W-H — the inverse solver (specimen → scenario; the T3→T4 bridge)

Given a specimen's bench measurements, SEARCH the scenario space for the fluid history that
produces it — constrained by geology, verified on held-out metrics. rockbot is right that this
is a new tool class (`tools/vugg-inverse.mjs`), and it has both a modern method family and a
geological precedent, both verified today:

- **Method class: simulation-based inference** — vugg is exactly the setting SBI exists for (a
  high-fidelity forward simulator with no tractable likelihood): Cranmer, Brehmer & Louppe
  2020, PNAS 117(48):30055-30062, doi:10.1073/pnas.1912789117 (✓ verified). ABC/Bayesian
  search produces posterior DISTRIBUTIONS over histories, not point fits — which is the T3
  overfit guard (roadmap risk #2) made structural, and makes W-H and W-I siblings.
- **Geological precedent: petrology has inverted growth records since 1983** — Spear &
  Selverstone, "Quantitative P-T paths from zoned minerals," CMP 1983 (✓ verified; modern kin:
  brute-force P-T inversion CMP 2014, MRF inversion CMP 2011). T3 is that method generalized
  from a P-T path to a full fluid history, from one zoning profile to the whole crystal record.

Design cautions recorded now: (i) parameterize over SCENARIO INPUTS (initial fluid, event
sequence, timings) — NOT derived quantities like σ, which the thermo engine computes; rockbot's
"(T, pH, σ, …)" sketch would search a dependent variable. (ii) The space is mixed
discrete/continuous (event sequences are combinatorial) — coarse-to-fine over event templates,
continuous refinement within. (iii) Defer-to-geology becomes a PRIOR, formally: B2's
plausibility bounds are the prior's support. (iv) Hold the seed fixed during search or
marginalize over seeds — which is W-I's machinery. Depends on: A3/A4 (something to condition
on), cheap headless forward runs (exists), W-I.

### 6e. W-I — ensemble + uncertainty propagation (T4 made statistical)

Accepted as the IMPLEMENTATION of what the fidelity budget's T4 row already promises (ensemble
runs, 95% CI — rockbot's own review point #8): without ensembles T4 is a point claim. Two
distinct uncertainty sources to propagate, and the tree is unusually well prepared for both:
**parameter uncertainty** (draws within bench error bars on fitted params) × **realization
uncertainty** (seed variation — the per-mineral seed streams, SIM 198, make seed
marginalization clean and attributable). vugg-canary is the natural host: nightly, PASSIVE,
accreting envelopes per scenario the way it accretes regressions now. Probe per-run cost
before architecture — ensembles multiply compute; overnight-batch scale is the budget.

### 6f. W-J — paragenetic sequences (the deposit above the vug)

Accepted, with an honest census first: more of W-J exists in embryo than the pitch implies —
events already sequence fluid changes within a scenario (the movements arc + event
subsumption), substrate-affinity/paragenesis tables (js/26) already stack generations, and
gen-1→etch→gen-2 (reactivated_fluorite_vein), paramorphs, and perimorphs are shipped
multi-generation tenants. The genuinely NEW architecture is three things:

1. **Geometry-modifying events** — fracture/brecciation that changes the WALL and breaks
   existing crystals (ties to the census's cleavage/fracture gap and the deformation arc; O8's
   cockade clasts live at this boundary).
2. **Scenario composition as syntax** — `then:` chains in scenarios.json5 (scenario A → 
   transition event → scenario B), with prior generations persisting as substrate.
3. **Multi-vug correlation** — several cavities driven by ONE regional fluid timeline. And
   here the bench connection is exact: **the catalog's LOT entity is W-J's ground truth** — a
   flat of specimens from one pocket must be predicted by the SAME fluid history, specimen by
   specimen. The boss's lot-based ingestion design and this workstream are the same idea seen
   from opposite ends.

## 6g. W-K — vug genesis: the cavity's own ontogeny (added 2026-07-03 — boss ask, researched same day)

Full arc: **`PROPOSAL-VUG-GENESIS-2026-07-03.md`** (8-agent census + research, citations
verified — both boss claims CONFIRMED in the literature: precursor-dissolution genesis is
Chowns & Elkins 1974's canonical geode model, Crossref-verified; botryoids-on-modeled-surfaces
is Self & Hill's substrate selection, fetched verbatim). Rungs in brief:

| rung | one line | SIM |
|---|---|---|
| **V0** ✅ SIM 215 cleft tranche (2026-07-03) | archetype truth: the cleft scenarios have a real planar cleft (grimsel/tormiq re-genred off 'pocket'); the all-38 wall-block audit against the genesis taxonomy stays OPEN as V0's remaining tranche | bump, per-scenario staged |
| **V1** | wall microtexture per genesis: Blumberg-Curl scallops (flow-velocity-parameterized), cleft fracture steps, sediment rind, vesicle glass | render-only |
| **V2** | primer coats (Deccan green celadonite Stage-0) + substrate-conditioning decay s(d)=exp(−d/d₀) in nucleation | bump |
| **V3** | substrate-aware botryoidal/colloform (convexity-biased hemispheres, contour-then-relax banding, Roedder crystalline anchor) — **retires the 4-blob** | render-first |
| **V4** | geometry-aware nucleation (curvature input; unifies with W-F O3; shared Krapivsky oracle) | bump |
| **V5** | precursor-dissolution genesis: precursor-shape × two-clock rigidity × fill_fraction; first tenant = the Tennessee silicified-anhydrite geode. **W-J's first paying customer** | bump + scenarios |
| **V6–V7** | whole-wall dissolution dynamics · topology breakers (two-wall fissures, boxwork — needs a successor representation, honestly deferred) | bump / XL unscheduled |

---

## 7. The data-availability map (the boss's stated worry, answered)

| data class | free source | status | catalog-substitutable? |
|---|---|---|---|
| thermodynamics (ΔG/ΔH/Ksp) | Robie & Hemingway B2131 (USGS); PHREEQC databases (wateq4f, pitzer, llnl) | **verified free today** | no need |
| activity/speciation models | published equations (Davies in-tree; HMW84 coefficients ship inside pitzer.dat) | free | no need |
| crystal structures / face geometry | AMCSD + Crystallography Open Database CIFs | free [high confidence, re-verify at build] | no need |
| diaphaneity / lustre / habit text | webmineral + Handbook of Mineralogy PDFs (rruff.net/doclib/hom) | proven this session (94 species fetched) | already done |
| visible absorption spectra (colour) | Caltech Mineral Spectroscopy Server; RRUFF (Raman/chemistry) | **verified free today** | catalog adds locality-specific truth on top |
| face-specific step kinetics | mostly **PAYWALLED** (GCA/JCG); abstracts + occasional author copies | the one genuinely hard class | **YES — the bench is the substitute: fit rate laws to measured anchor specimens** |
| trace-element partitioning | scattered; older GCA partly open | partly paywalled | partially (fit D from locality colour/zoning) |
| provenance-locked visual ground truth | mindat BOT-BLOCKED; auction archives unreliable | the class money can't buy | **THIS IS THE CATALOG. 1,217 specimens, 86% sim-matched, UV first-class** |
| locality fluid chemistry | USGS/state-survey reports free; ore-deposit monographs paywalled | mixed | indirectly (T3 inverse-fitting recovers plausible waters) |

Bottom line: only one data class is truly locked (step kinetics), and the boss's drawers are the
published literature's missing instrument for exactly that class. The plan needs no purchases to
start; interlibrary/author-copy requests are a nice-to-have for C2, not a blocker.

## 8. Sequencing — phases, ritual, risk

**Phase 1 (next sessions):** C0 calcite lever (boss stone) + A1 bridge/anchors + A2 protocol.
C0 ships with the first T2 acceptance pair; A1/A2 are cheap and unlock everything.
**✅ C0's CODE SHIPPED SIM 217 (`299a270`, 2026-07-06 — the Ω branch + the biasC integral;
see the C0 row above). The T2 acceptance pair remains OPEN pending A1's dogtooth + nailhead
anchor picks (specimen 1298 already named for the dogtooth side).**
**Phase 1.5 (the big ask's visible foundation, amended 2026-07-03):** O0 half-forms → O1
unequal development → O2 induction surfaces — the render-only ontogeny core; each is a
byte-identity candidate shipped by the standing ritual. **✅ O0 (SIM 215) + O1a + O2
(`eea52bc`) SHIPPED — the render-only core stands; OPEN within it: O1b neighbor-shadow, O2
concave forms + integrated-growth weights.**
**Phase 2:** A3 metrics + A4 bench (passive) + B2 PHREEQC instrument + B3 debt closure · W-K's
visible foundation (V0 cleft truth + V1 wall microtexture; V3/V4 later share W-F O2/O3's era —
same induction-surface and selection mathematics, one oracle).
**Phase 3:** C1 depletion field — ◐ directional half ✅ 2026-07-07 (`e08ab3d`: O1a real
exposure + O1b shadow + O2 integrated weights, render-only); the scalar-chemistry half
(biasC reads cell σ) DEFERRED — 1 calcite Wulff tenant fleet-wide, re-opens with B5 / more
tenants · O3 geometric selection · then B1 Pitzer against B2's table.
**Phase 4:** B5 speciation solver · C2 face-rate laws bench-calibrated, tenant by tenant · C4
twins · O4 engulfment + O5 perturbed regrowth (share C1-era rebake windows).
**Phase 5+:** C3 microtopography · C5 CSD · O6–O8 · D2/D3/D4 · E rungs interleaved.
**Any time the boss calls it:** D1 colour (render-only, jumps the queue). **Never unprompted:** D0.

Every rung ships by the standing ritual — probe first, law with a source column, calibrate at the
renderer's TRUE parameters, sweep instrument with exit-1 genre guards, byte-identical or
SIM-bump + full rebake + strip archive, dense commit, push = deploy. The frozen-param converse
applies to every calibration this roadmap adds: pin band edges at BOTH ends of any newly-live path.

**Named risks and my own blind spots** (`feedback_complementary_blindness`):
1. **I have not seen the photos.** The 86% overlap is label-math on a 52-day-old snapshot; photo
   measurability (scale cues, sharpness, face visibility) is unverified. A1 must sample actual
   photos before anchor selection is trusted, and the live host was unreachable today — recount.
2. **T3 inverse-fitting can overfit** — a fitted water can match a rock for wrong reasons. Guards:
   held-out metrics per anchor, geologic-plausibility constraint set (defer-to-geology), and
   fits reported with the same disagreement-record honesty as the optics batches.
3. **B5/C1 performance** — speciation per step × per voxel cell is unaffordable naively. Mitigation:
   solve at event/movement boundaries (event subsumption already gives the rails), cache +
   interpolate between; budget with an explicit probe before committing the architecture.
4. **Photoreal pull vs field-guide soul** — T2/T3 are about MEASURED properties, not render
   glamour. `transmission: 0` (no faked refraction) stands until the boss reopens it; chrome
   stays lean; the science remains the spectacle.
5. **The catalog is security-sensitive and local-only.** The bench ships measurements, never the
   ledger: no valuations, no dealer names, no photos in the public repo. Ever.
6. **The archivists' window** (`project_mineral_catalog_archivists`) — locality assertions feed
   T1/T2 anchors, and that knowledge is fading. Not this repo's task, but this roadmap is one
   more reason the catalog's provenance-capture work matters soon. Noted, not directed.
7. **Estimates are S/M/L/XL sessions, not calendar** — erosion is the formation mechanism; the
   phases are ordered by dependency, not by date.

---

The dream in the current handoff — shape, clarity, and colour all readouts of the recorded water,
until the only difference between the screen and the specimen is which one casts a shadow — is
T3 in this ladder's terms. This roadmap is that sentence turned into rungs. The rocks in the
drawers were always going to be the final examiners; the plan just gives them the bench to sit at.
