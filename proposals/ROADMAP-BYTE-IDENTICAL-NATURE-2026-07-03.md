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
| **T0 — genre** | a mineralogist names the SPECIES from the render alone | the boss's eye; any field guide | largely held for the shipped tenants (Wulff forms, calcite morphology, sceptres, hourglass selenite, diaphaneity) |
| **T1 — locality** | they name the LOCALITY (Elmwood vs Naica vs Grimsel habit+colour+association) | provenance-known specimens; the image-corpus method | partial — scenario-tuned habits exist; colour is still the class palette |
| **T2 — specimen-metric** | rendered metrics match a SPECIFIC catalog specimen within measured tolerance (interfacial angles, aspect ratios, size distribution, CIELAB colour under a known illuminant) | `tools/specimen-bench.mjs` (§2, to be built) against catalog measurements | **does not exist — the keystone gap** |
| **T3 — specimen twin** | given a specimen, the sim grows ITS digital twin: a fluid history is inverse-fitted within geologic plausibility and the twin passes T2 on held-out metrics | held-out metrics + defer-to-geology constraints | far |
| **T4 — process identity** | the twin passes T2 with NO fitting — measured kinetics + real thermodynamics end-to-end predict the specimen | everything below feeding forward | the asymptote |

The metric of the whole project from here on: **specimen-bench pass rate, by tier.** Green CI
stays "not yet falsified"; the bench is where falsification gets teeth
(`feedback_terminal_verification_specimens` — the boss: "the final end of checking will be
verifying everything against the real minerals").

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
| **A2 — capture protocol** | `proposals/SPECIMEN-CAPTURE-PROTOCOL.md` + per-anchor shot list | Standardized re-shoots the boss can run with the existing iPhone pipeline: scale reference in frame, grey/white card under a fixed illuminant for colour truth, 3 canonical angles + a face-on macro per measurable face, UV set where relevant. Agents write the protocol + shot lists; the boss's hands do the shooting at his pace. Archive photos serve where they already carry scale cues. | S to write; capture is ongoing |
| **A3 — metric extraction** | `tools/specimen-metrics.mjs` + measured rows in specimen-anchors.json | From protocol photos: aspect ratios, interfacial angles (photogrammetry-lite: face-on shots + known geometry class beat full 3D reconstruction), CIELAB colour off the grey card, druse crystal-size counts off plate shots. Each value stored WITH error bars and the photo id it came from — a measurement column, same discipline as the optics `source` column. | M |
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
| **C0 — calcite σ/Ca:CO₃ lever** | **boss stone #2, unchanged** — dogtooth↔nailhead as an earned chemistry readout (the 4a.7 wulfenite recipe: probe → law → calibrate at true g → sweep → ship) | Orme 2001 / Davis 2000 already in-tree. Bench tie-in: calcite is the catalog's deepest bench (153) — pick one dogtooth + one nailhead anchor in A1 and C0 ships with the project's FIRST T2 acceptance pair | M · render-only if it rides the classifier |
| **C1 — local-σ depletion field** | **boss stone #3, unchanged** — σ history shapes form; mass-conservation EV check FIRST (`feedback_gamble_ev_check` generalizes: budget the solute books before trusting emergent behavior) | the voxel grid + per-cell fluid store (js/24, js/20d) is the prepared seam | L–XL · SIM bump + full rebake ritual |
| **C2 — face-specific rate laws** | replace per-tenant habit heuristics with R(σ,T) per face family where measurable: BCF spiral / birth-and-spread regimes | Burton–Cabrera–Frank 1951; calcite step kinetics Teng–Dove–De Yoreo 2000 (GCA 64:2255) [from-memory, verify]; barite Pina et al. 1998 (Nature 395:483) [from-memory, verify]. **Paywall risk HIGHEST here — mitigation is the bench-as-calibration-set (§2)** | XL · per-tenant increments, each byte-identical-or-bump |
| **C3 — surface microtopography** | hillocks/vicinals/striations as displacement+normal maps GENERATED from the same kinetic parameters (hillock slope = step height/spacing), not noise textures | ships per-tenant after its C2 rung so the bedrock exists; quartz m-face striations are the iconic first target (179 quartz specimens to check against) | M per tenant · render-only |
| **C4 — twin geometry** | render the twin laws the data+roll already carry: gypsum swallowtail, fluorite penetration, quartz Japan-law, calcite butterfly; twin = crystallographic operation applied to the existing Wulff polyhedron | staurolite (10+2 specimens, "twin xls" literally in the catalog labels) is a future add-mineral + twin tenant in one | M per law · render-only |
| **C5 — crystal size distributions** | druse populations follow measured CSD shapes; compare sim per-vug histograms against A3 plate counts | Kile & Eberl (Am. Min., CSD growth laws) [from-memory, verify]; honest successor to the rejected per-vertex flip (scale-starved) — statistics, not per-vertex placement | M · likely SIM-neutral (analysis + placement tuning) |

## 5. W-D — optics completion (order set by the boss, not by ease)

| rung | status + plan | size |
|---|---|---|
| **D0 — lustre** | **PARKED by boss call 2026-07-03 — data exists in text form, that is enough; do not build unprompted.** Listed only so the map is complete. | (easy, and that doesn't matter) |
| **D1 — Depth-C body colour** | **on boss call, can jump the queue any time (render-only).** Chromophore column in minerals.json with source discipline (Fe²⁺/Fe³⁺/Mn²⁺/Cu²⁺ intrinsic; smoky/amethyst as irradiation+trace flags the sim's water already knows about). Data: **Caltech Mineral Spectroscopy Server — free, verified today ([minerals.gps.caltech.edu](http://minerals.gps.caltech.edu/), 1000+ ASCII visible/IR spectra)** + Nassau's colour-cause taxonomy; absorption→CIELAB→albedo per species, THEN per-crystal modulation from the sim's own fluid (B4 feeds this: sphalerite Fe-darkening). Acceptance: colour ΔE against A3's grey-card CIELAB rows — colour is what a specimen falsifies fastest. | L |
| **D2 — zoned colour + phantoms** | colour as a function of growth-zone history riding the sector-zoning vertexColors rails (amethyst phantoms, banded fluorite). The zone recorder already exists; this is D1 × time. | M after D1 |
| **D3 — inclusions** | chlorite phantoms (alpine cleft), rutile needles in quartz, the two-phase fluid inclusions Naica is famous for — each a declared, sourced tenant, not a generic speckle shader | M per tenant |
| **D4 — fluorescence** | UV render mode driven by activator data (Mn²⁺ calcite, Eu²⁺ fluorite); ground truth = the catalog's first-class 365/310/255 nm photo sets. A delight rung — schedule late, it will land like the sonifier. | M |

## 6. W-E — worlds & context

| rung | deliverable | size |
|---|---|---|
| **E1 — host rock as material** | the vug's wall rendered as its lithology (limestone vs basalt vs pegmatite — wall composition classes already exist in js/22; field-guide restraint applies: the rock is a supporting actor) | M |
| **E2 — locality scenarios** | Sweetwater snowball barite + Elmwood perimorph (already slated in memory) and successors — **new rule from this roadmap: every new scenario names its bench anchor** (a catalog specimen or an explicit "no specimen yet" debt) | M each |
| **E3 — replacement textures** | pseudomorph/perimorph surface fidelity (the cast exists; the granular replacement texture doesn't) | M |

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
**Phase 2:** A3 metrics + A4 bench (passive) + B2 PHREEQC instrument + B3 debt closure.
**Phase 3:** C1 depletion field (boss stone, EV check first) · then B1 Pitzer against B2's table.
**Phase 4:** B5 speciation solver · C2 face-rate laws bench-calibrated, tenant by tenant · C4 twins.
**Phase 5+:** C3 microtopography · C5 CSD · D2/D3/D4 · E rungs interleaved.
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
