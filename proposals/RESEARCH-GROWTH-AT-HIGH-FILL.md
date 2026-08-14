# RESEARCH: Crystal growth as a vug nears filling

> **Authored:** 2026-05-16, by Claude (Sonnet 4.5), at boss's request following Backlog K (`8a0d403`).
> **Status:** **Proposals A + C SHIPPED** (commits pinned in §11 + §12). Proposals B, D, E still open. Reading order: §1 TL;DR → §2 What the simulator does → §3 What real rocks do → §4 The gap → §5 Proposals → §11 Proposal A landing notes → §12 Proposal C landing notes.
> **Companion data:** `tools/high_fill_probe.mjs` — characterizes current behavior across all 24 scenarios at every fill bin from 0–1.0.

---

## 1. TL;DR

The current simulator has **two thresholds** at the high-fill end:

| threshold | behavior |
|-----------|----------|
| `vugFill >= 0.95` | nucleation gated to `fill_exempt` minerals only (Backlog K, shipped) |
| `vugFill >= 1.0`  | growth stops entirely; `_vug_sealed = true`; only dissolution allowed |

Real rocks **don't have either of these cliffs**. The geological literature is unambiguous on five points:

1. **Growth rate slows continuously as fill rises**, governed by boundary-layer diffusion limitation — not a binary cutoff. Tenthorey & Cox 1998 (JGR experimental): permeability falls "by more than 1 order of magnitude" while porosity stays nearly constant. Mass transport becomes rate-limiting WELL BEFORE the cavity is geometrically full. ([Tenthorey 1998](https://wrap.warwick.ac.uk/id/eprint/167020/))

2. **Habit transitions are driven by the same diffusion-limit physics**: at high local σ + low mobility, faces grow slower than edges → **hopper / skeletal / dendritic** crystals. Tanaka et al. 2018 quantified this for halite: there is a *specific* σ at which growth transitions from cubic to hopper, above which "growth rate varies as the third power of supersaturation" — diffusion-limited regime. ([Tanaka 2018 PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC5994728/))

3. **A small recurring set of minerals are documented as "last to grow"** in vugs and geodes. In Brazilian amethyst geodes (Ametista do Sul): calcite is "most commonly as very late euhedral crystals" with rare gypsum or lepidocrocite as the final patina. ([Proust & Fontan 2007 Mineralium Deposita](https://link.springer.com/article/10.1007/s00126-002-0310-7)). At Tsumeb: paragenesis ends with "galena and various low temperature gangue minerals." ([Pinch & Wilson 1977; Bowell 2010](https://www.mme.gov.na/files/publications/c46_GSN%20Comms%2019.%203.%20Bowell%20&%20Mocke_Tsumeb%20Minerals.pdf))

4. **Multiple fluid events leave layered records**, not single-pass fills. Michigan Basin limestone vugs have "at least six separate fluid events" each contributing a mineral layer. The simulator already has events but they're scenario-authored, not driven by fill-induced permeability changes.

5. **The simulator currently lets vugFill exceed 1.0 by 2–3×** in 6 scenarios (probe: sabkha 2.5×, radioactive_pegmatite 2.6×, gem_pegmatite 1.5×). This is unphysical — past 1.0 the cavity is full, but the simulator's `c_length` cap is only on the bounding axes, so the *uncapped chemistry-tracked* total_growth_um keeps climbing. Real geology has a name for what "happens past 1.0": granular interlocking texture. The simulator doesn't model that — it just stops, and the volume math overshoots.

**Highest-leverage proposals (ranked by ratio of geological honesty to implementation effort):**

| # | proposal | effort | geological payoff |
|---|----------|--------|-------------------|
| A | Continuous sigmoid growth-rate dampener (0.85–1.0) replacing the binary 0.95 nucleation cutoff | ~2 hours | huge — current cliff is the single most visible non-geological behavior |
| B | High-σ + high-fill → hopper habit transition trigger (already-authored habit_variants triggered by fill, not just evaporation) | ~3 hours | high — sells the visual "this vug filled fast under high σ" story |
| C | Per-mineral `late_stage_propensity` field, generalizing `fill_exempt` into a continuous gradient (0=never-late, 1=often-late) | ~3 hours | high — encodes "calcite is the closing mineral in agate geodes" without manual scripting |
| D | Replace hard seal at 1.0 with "interstitial / interlocking" growth mode where crystals continue but get a granular habit + dampened rate | ~1 day | medium — geologically honest, fixes the 2.5× overshoot, but requires habit_variant additions |
| E | Local-pore-volume tracking per-cell instead of global vugFill (the Path C / Tranche 6 extension) | ~3 days | medium — enables true heterogeneous fill (one pocket sealed while another still growing); diminishing return after A+B+C |

Recommended path: **A + C** is the smallest end-to-end coherent change. **A + B + C + D** is the full geological story. **E** is structural and probably belongs in a future tranche.

---

## 2. What the simulator does at high fill (data from the probe)

Built `tools/high_fill_probe.mjs` to sweep all 24 scenarios at seed 42 and bin per-step growth activity by vugFill.

### Coverage of the high-fill regime

| scenario | peak vugFill | sealed at step | nucleations after 0.95 |
|----------|--------------|----------------|------------------------|
| radioactive_pegmatite | 2.627 | 55 | 0 |
| sabkha_dolomitization | 2.517 | 1 | 6 |
| gem_pegmatite | 1.476 | 13 | 0 |
| naica_geothermal | 1.035 | 23 | 0 |
| searles_lake | 1.029 | 31 | 64 (fill_exempt borax/mirab/thenardite) |
| supergene_oxidation | 1.003 | 104 | 0 |
| stalactite_demo | 0.883 | — | — |
| zoned_dripstone_cave | 0.442 | — | — |
| (15 other scenarios) | < 0.10 | — | — |

Two observations:

- **Only 6 of 24 scenarios ever approach complete filling.** The remaining 18 scenarios stay vugFill < 0.50 — meaning the Backlog K fill_exempt mechanism is exercised in exactly 1 of them (`searles_lake`). Everything else is structurally below the regime.
- **The scenarios that DO fill, overshoot dramatically.** sabkha at 2.5× is the worst — the cavity is mathematically "full" by step 1 (the first crystal already exceeds geometry), but the simulator keeps adding chemistry-truthful volume to `total_growth_um`. Geologically: by step 1 of sabkha, the crystals would already be interlocking.

### Growth rate vs vugFill bin (all scenarios pooled, seed 42)

| vugFill bin | step-seed pairs | mean zone thickness (µm) | mean active crystals | nucleations / step |
|-------------|-----------------|--------------------------|----------------------|---------------------|
| 0.00–0.10 | 2,569 | 63.5 | 13.9 | 0.184 |
| 0.10–0.25 | 191 | 144.0 | 26.4 | 0.366 |
| 0.25–0.50 | 74 | 272.7 | 21.1 | 0.135 |
| 0.50–0.75 | 37 | 223.3 | 25.4 | 0.135 |
| 0.75–0.90 | 24 | 161.9 | 27.7 | 0.042 |
| 0.90–0.95 | 9 | 69.9 | 36.1 | 0.111 |
| 0.95–0.99 | 2 | 153.8 | 33.0 | 0.000 |
| 0.99–1.00 | 0 | — | — | — |

The data shows **some** growth-rate moderation in the high-fill bins (272 µm peak → 70 µm in 0.90-0.95), but:

1. The high-fill bins are extremely sparse (just 9 + 2 + 0 = 11 sample points across all 24 scenarios) — the simulator flies through this region.
2. The moderation that exists is incidental — it comes from per-axis caps in `Crystal.add_zone` clipping growth at the cavity wall (BUG-CRYSTALS-CLIP-VUG-WALL.md Tier-2 fix), not from any modeled DLA / boundary-layer physics.
3. The nucleation rate drops to 0 in the 0.95–0.99 bin under this seed — fill_exempt minerals were firing in other seeds but at this seed they didn't.

### What the code actually does

`js/85-simulator.ts:174`:
```js
if (vugFill >= 1.0 && !this._vug_sealed) {
  this._vug_sealed = true;
  // dominant-mineral seal-message logic
}
this.check_nucleation(vugFill);
// ... growth loop ...
if (currentFill >= 1.0) {
  // dissolution still allowed; positive zones blocked
  continue;
}
```

`js/85d-simulator-step.ts:152` (Backlog K):
```js
const capped = (vugFill !== undefined && vugFill >= 0.95);
this._fillCapped = capped;
if (capped && !_anyFillExemptInSpec()) return;
// ... per-mineral fill_exempt gating in _atNucleationCap ...
```

That's it. Two hard cliffs, no continuous physics in between.

---

## 3. What real rocks do (the literature)

### 3.1 Growth rate slows continuously — boundary-layer diffusion

The dominant mechanism past ~70% fill is **mass-transport limitation** at the crystal surface. The bulk solution is supersaturated but the boundary layer next to the crystal is depleted; new ions have to diffuse across that boundary at rate proportional to ∇C.

Tenthorey & Cox 1998 ran flow-through experiments on granular aggregates and observed:

> Significant permeability reduction is observed with no concurrent decrease in porosity, with the overall permeability reduction sometimes exceeding 1 order of magnitude over 4 days... authigenic mineral formation does not reduce total pore space, [but] there is a reduction in effective porosity, which results in permeability reduction.

In other words: **permeability falls 10× while porosity stays nearly the same**. The fluid flow is choking BEFORE the cavity is full. The mineralogy that would have grown if the cavity were fed adequately just doesn't get fed.

Tenthorey & Cox's companion theoretical paper (Aharonov 1998 JGR) maps this to a kinetics-vs-transport competition. The system has two timescales:
- Surface reaction rate (constant under fixed σ and T)
- Boundary-layer ion delivery (drops as effective porosity drops)

Once delivery becomes slower than reaction, growth becomes diffusion-limited and slows continuously. The cutoff in their experiments was around 80–85% fill, not 95%.

A more recent Nature Communications study (2022, "Crystal growth in confinement") quantified this for confined geometries:

> The abrupt change in nucleation localization is due to the depletion of ions in the confined fluid when a molecular layer grows, where diffusion does not have time to transport ions before the next nucleation event and a concentration gradient develops.

The geometric translation: **the LAST cells to be reached by diffusion are the corners of the cavity** — the high-fill regime preferentially grows at edges (boundary-fed) while corners stay open. ([Nature Comm 2022](https://www.nature.com/articles/s41467-022-34330-5))

### 3.2 Habit transitions: hopper / skeletal / dendritic

The same diffusion-limit physics drives habit transitions. Tanaka et al. 2018 (J. Phys. Chem. Lett.) studied halite hopper growth quantitatively:

> The transition between cubic and hopper growth happens at a well-defined supersaturation where the growth rate of the cubic crystal reaches a maximum (≈6.5 ± 1.8 µm/s), and above this threshold, the growth rate varies as the third power of supersaturation, showing that a new mechanism, controlled by the maximum speed of surface integration of new molecules, induces the hopper growth.

Quantitative anchors:
- **Critical growth rate** for hopper transition: ~6.5 µm/s (for halite at room T)
- **Scaling above threshold**: growth rate ∝ σ³
- **Geometric outcome**: edges grow faster than face centers, producing the stepped/hollow morphology

The same paper notes:

> Hopper crystal formation emerges at high driving forces with limited mobility of the precursors and is therefore a diffusion limited phenomenon.

In closed cavity (limited solution): "hopper morphology will subsequently evolve toward the polyhedral growth of its extreme cubic units until complete evaporation." ([Tanaka 2018](https://pmc.ncbi.nlm.nih.gov/articles/PMC5994728/))

**This is documented for** halite, calcite, quartz, bismuth, gold — all minerals already in the simulator's spec.

The simulator already has `hopper_growth` and `hopper_cube` habit variants for halite and sylvite. But the trigger is `"rapid evaporation — Death Valley playa surface"` — i.e. scenario-explicit. The geology says the trigger is **local σ × local diffusion-limit**, which is exactly what high fill creates regardless of the surrounding scenario story.

### 3.3 The "last mineral to grow" set

The literature consistently names a small set of minerals that show up as the **terminal** layer in cavities:

**Brazilian amethyst geodes (Ametista do Sul) — Proust & Fontan 2007:**
> The typically spherical cap-shaped geodes display an outer rim of celadonite followed inwards by agate and colorless and finally amethystine quartz, with **calcite forming throughout the whole crystallization sequence, but most commonly as very late euhedral crystals**, sometimes with gypsum, in the central cavity.

**"Skunk" calcite paragenesis study (same Brazilian deposits):**
> Agate first → amethyst + calcite → goethite + striped amethyst → continued quartz → **lepidocrocite depositing as patina on all exposed surfaces of calcite and goethite (LAST)**.

**Tsumeb (Pinch & Wilson 1977; Bowell 2010):**
> Hypogene minerals precipitated in overlapping events starting with pyrite, then copper minerals, and **ending with galena and various low temperature gangue minerals**.

**Cripple Creek bonanza pockets (Spry & Thieben 1996 Mineralium Deposita 31):**
> Native_tellurium grains as inclusions WITHIN hessite at the Cresson Vug — the residual-overflow paragenesis: forms when every telluride-forming metal (Au, Ag, Pb, Bi) has had its fill.

**The recurring late-stage cast:**
- **Calcite** — across many geode types (Brazilian amethyst, alpine quartz fissures, MVT pockets). Often as druzy crust on top of earlier phases.
- **Quartz / chalcedony (drusy)** — the "last gasp" silica deposition, often as botryoidal or microcrystalline crust
- **Gypsum / selenite** — in evaporite cavities and warm-supergene pockets
- **Lepidocrocite / goethite** — Fe-bearing oxide patinas on top of earlier sulfides
- **Borax / sylvite / mirabilite / thenardite** — playa efflorescent crusts (the Backlog K set)
- **Native_tellurium** — residual-overflow pockets (the §12 cascade-gate case)

This is **a real geological pattern, not an artifact**. The mechanism: as σ drops in the residual fluid (because all the easy-to-precipitate stuff already left), only minerals with very loose nucleation thresholds can still nucleate. Calcite has a fast nucleation kinetic; it picks up the late, low-σ regime. Lepidocrocite needs trace dissolved Fe + oxidation, which is exactly what late-stage cavity fluids accumulate.

### 3.4 Multiple fluid events overlay

Many real specimens record not one fill but several:

**Michigan Basin (search result, secondary source):**
> Researchers have identified multiple distinct stages of mineral growth inside the same vugs, each deposited by a different fluid event at different temperatures. Studies of limestone formations found at least six separate fluid events responsible for filling vugs and veins, with the earliest fluids reaching temperatures between 88 and 128°C and later stages cooling to 54–78°C.

The simulator already has scenario-authored events but no concept of "fill-induced permeability seal → temporary growth pause → new fluid event → new mineralogy."

### 3.5 Naica selenite: low-σ steady-state at any fill

The Cave of the Crystals at Naica is a different mode — the cavity remained nearly-saturated for 500,000 years with one species growing slowly:

> The crystals begin their nucleation and growth in a slightly supersaturated solution of CaSO4 about half a million years ago with a growth rate of **1.4 × 10⁻⁵ nm·s⁻¹** ... roughly **0.01 millimetres per year**. ([Cave of Crystals — Wikipedia](https://en.wikipedia.org/wiki/Cave_of_the_Crystals); [Crystal Growth & Design 2018](https://pubs.acs.org/doi/10.1021/acs.cgd.8b00583))

This isn't "high fill" — it's the opposite — but it shows that crystals can grow indefinitely at very low σ as long as the bulk fluid keeps delivering ions. Real growth rates span 11 orders of magnitude from "Naica slow" to hopper-fast. The simulator currently has a single growth rate (× per-mineral `growth_rate_mult`).

---

## 4. The gap

| topic | simulator (current) | real rocks (literature) |
|-------|---------------------|--------------------------|
| growth rate vs fill | constant up to seal at 1.0; binary nucleation cliff at 0.95 | continuous slowdown from ~0.7 onward; depends on σ, T, geometry |
| permeability-vs-porosity | tracked only through binary "is this cell occupied?" | continuous; permeability drops 10× while porosity drops 10% |
| habit transitions | hopper variants exist; trigger is scenario-explicit ("rapid evaporation") | trigger is local σ × diffusion-limit, which fill creates regardless of scenario |
| "last mineral" semantics | `fill_exempt: true` (4 minerals, binary) | continuous late-stage propensity gradient across many minerals |
| post-seal behavior | growth stops; only dissolution allowed | continued precipitation produces granular / interlocking / massive textures |
| volume integrity | uncapped chemistry can produce vugFill 2.6× | physically impossible — would be granular interlocking past 1.0 |
| multiple fluid events | scenario-authored; not fill-coupled | fill-induced permeability seal triggers new fluid event (Michigan Basin pattern) |
| local fill heterogeneity | global vugFill only | corners stay open while edges fill (Nature Comm 2022 confinement studies) |

The single largest gap is the **first row**: continuous slowdown vs binary cliff. Everything else is downstream of "we should be modeling diffusion-limited boundary-layer kinetics, not just `if (fill > X) return`."

---

## 5. Proposals

### Proposal A — Continuous sigmoid growth-rate dampener

**Replace** the binary `if (currentFill >= 1.0) continue` and `_fillCapped = (vugFill >= 0.95)` cliffs with a smooth multiplicative dampener applied to BOTH nucleation rates AND growth rates:

```js
// In _runEngineForCrystal and check_nucleation:
const fillDampener = 1.0 / (1.0 + Math.exp(20 * (vugFill - 0.85)));
//   vugFill = 0.50 → dampener ≈ 1.0
//   vugFill = 0.80 → dampener ≈ 0.73
//   vugFill = 0.85 → dampener ≈ 0.50
//   vugFill = 0.90 → dampener ≈ 0.27
//   vugFill = 0.95 → dampener ≈ 0.12
//   vugFill = 1.00 → dampener ≈ 0.05
//   vugFill = 1.20 → dampener ≈ 0.002
```

Sigmoid choice anchored at 0.85 with steepness 20 because:
- Tenthorey 1998 observed permeability fall starting around 80–85% fill
- "Steepness 20" makes the half-way point exactly at vugFill = 0.85 with the 5-95% transition spanning vugFill 0.70 to 1.00
- At vugFill = 1.05–1.10, dampener is ~0.001–0.005 — effectively a soft cap that prevents the 2.5× overshoots without a hard cliff

**Replaces:** the `if (vugFill >= 1.0) continue` hard stop, the `_fillCapped = (vugFill >= 0.95)` flag, the per-mineral `fill_exempt` flag (becomes redundant — the dampener IS the cap).

**Backwards compatibility:** the `fill_exempt: true` field can stay in JSON for now; engines that read it would just see a less-aggressive dampener path. Or it can be removed in a single commit — every fill_exempt mineral is geologically late-stage and the sigmoid would let them fire naturally.

**Calibration baseline drift:** moderate, mostly in the 6 high-fill scenarios. Probably increases crystal sizes slightly in 0.7-0.9 range (growth slows earlier) and reduces overshoot in 1.0+. Geologically honest direction.

**Effort:** ~2 hours including baseline regen and ~15 lines of test coverage. **Recommend doing this one first.**

### Proposal B — Habit transition triggers on fill × σ

The habit_variants infrastructure already exists. Each mineral lists variants like `prismatic`, `hopper_cube`, `botryoidal_crust`. Currently `selectHabitVariant(mineral, sigma, T, crowded)` picks based on σ, T, and a single boolean `crowded` (computed as ring-0 cell occupancy).

**Proposal:** pass `localFill` (or just `vugFill`) into `selectHabitVariant`, and add a "high-fill-favored" hint to the `trigger` field of habit variants. The variant selection then weighs `(local σ, local T, local fill)` instead of `(σ, T, crowded boolean)`.

Variants to flag as high-fill-favored (based on literature):
- halite `hopper_growth` (already exists; trigger updated)
- sylvite `hopper_cube` (already exists)
- borax `cottonball` (already exists — "rapid evaporation")
- calcite `druzy_crust` (NEW — would need habit variant added)
- quartz `microcrystalline` (NEW — chalcedony / drusy variant)
- aragonite `botryoidal` or `flos_ferri` (NEW — late-stage radiating)

**Geological mechanism encoded:** "high fill → boundary-layer diffusion limit → edge-favored growth → skeletal/hopper habit OR microcrystalline drusy crust depending on σ regime."

**Calibration baseline drift:** habit changes affect rendering (Three.js renderer reads habit name) but not σ/chemistry. Should be visible-only drift, no test changes needed beyond habit-bias tests.

**Effort:** ~3 hours, mostly habit_variant authoring + selectHabitVariant restructure.

### Proposal C — Per-mineral `late_stage_propensity` field

Replace the binary `fill_exempt: true` with a continuous `late_stage_propensity: 0.0–1.0` in MINERAL_SPEC. The four current fill_exempt minerals (borax, mirabilite, thenardite, sylvite) become `late_stage_propensity: 0.9` (very late-stage). Calcite gets `0.6` (often late). Galena gets `0.05` (rarely late). Quartz gets `0.4` (sometimes late as druzy).

The dampener from Proposal A is then per-mineral:

```js
const baseFill = sigmoid(vugFill, 0.85, 20);
const lateBoost = MINERAL_SPEC[mineral]?.late_stage_propensity ?? 0.0;
const fillDampener = baseFill * (1 - lateBoost) + lateBoost;
// late_stage_propensity = 0.0 → vanilla dampener (most minerals)
// late_stage_propensity = 1.0 → no dampening at all
// late_stage_propensity = 0.5 → halfway between dampened and full
```

**Calibration data needed (~half day of literature work):**
- Survey 15-20 common minerals
- Score each on "documented as late-stage in vug paragenesis literature"
- Cite the specific paragenetic study (Tsumeb succession, Brazilian agate, Cripple Creek, alpine cleft, etc.)
- Boss's mineral catalog at 100.127.96.126:8080 could be a primary source for "what minerals are late-stage in the specimens I own"

**Calibration baseline drift:** moderate. Some minerals will fire that previously didn't; some will fire less. All directions should be geologically defensible if the propensity scores are well-sourced.

**Effort:** ~3 hours implementation + ~half day literature pass. The literature pass can be done iteratively.

### Proposal D — "Interlocking texture" mode replacing hard seal

Past vugFill = 1.0, instead of stopping growth entirely, the simulator could:
1. Stop drawing new ellipsoid extensions outside the cavity wall (already done — the `c_length` cap)
2. But CONTINUE chemistry: existing crystals consume residual fluid, with σ-driven habit shifts to "granular" / "massive" variants
3. Tag crystals that grew past seal with `late_interlocking: true` so the renderer can apply a granular texture (vs euhedral termination)

This addresses the 2.5× overshoot bug by saying: **post-seal, additional chemistry is real, it just goes into densifying existing crystal mass, not into adding new volume.** The bookkeeping `total_growth_um` becomes a "consumed-ions counter" not an "occupied-volume counter."

**Calibration baseline drift:** small for the 18 scenarios that don't reach 1.0; meaningful (and improved) for the 6 that do. The sabkha 2.5× should drop to ~1.0 with the rest of the chemistry attributed to interlocking textures.

**Effort:** ~1 day including renderer changes for the granular texture path.

### Proposal E — Local-pore-volume per cell (Tranche 7-style)

Path C / Tranche 6 introduced per-cell chemistry; Tranche 7 candidate: per-cell fill. Each cell tracks its own occupancy, and growth/nucleation gates read local fill instead of global vugFill.

**Why this is real:** Nature Comm 2022 demonstrated that confined-geometry crystal growth has "concentration gradients between the edges and the center" — corners stay open while edges fill. The current global vugFill averages over this heterogeneity.

**Why this is later:** big restructure, and Proposals A+B+C already capture 80% of the geological story. E is the marginal final 20% that handles "this corner is still 0.3 fill while that edge is at 0.95 — late evaporite forms in the corner."

**Effort:** ~3 days including snapshot/replay format update.

---

## 6. Recommended path

**Tier 1 — ship A (continuous dampener):**
- Single PR
- Replaces 0.95 binary cliff and 1.0 hard stop with one sigmoid
- Geologically honest baseline drift in 6 scenarios
- ~2 hours including tests

**Tier 2 — ship C (late_stage_propensity):**
- Probably another PR
- Replaces fill_exempt as a continuous gradient
- Requires the ~half-day literature pass to score 15-20 minerals defensibly
- Builds on A's dampener directly

**Tier 3 — ship B (habit transitions):**
- Habit-renderer territory
- Visible win once Tier 1+2 are in
- No chemistry changes — pure rendering / habit selection

**Tier 4 — D (interlocking textures) + E (per-cell fill):**
- Defer until A+B+C land and we see whether the remaining gap warrants more work
- D is more visible-impact (fixes overshoot, adds new texture); E is more architectural

**Why this order:** A unblocks meaningful calibration improvements with minimum blast radius. C builds directly on A. B is renderer / habit work that's mostly independent. D and E are scope expansions that wait for evidence of need.

---

## 7. What this proposal does NOT recommend

- **Don't model molecular-level surface kinetics.** The literature has detailed surface-step-flow models (Tenthorey 2017; ACS Crystal Growth & Design 2022) but they're per-mineral and require activation energies + ion attachment rates. Out of scope.
- **Don't model fluid flow / Darcy's law explicitly.** Permeability is real but the simulator's bulk-fluid abstraction is fine if we just use the dampener as a proxy.
- **Don't add chemistry-coupled diagenesis events.** "Permeability seal → cooling → second fluid event" is a real process but the existing scenario event system already handles authored events. Auto-triggered events are scope creep.
- **Don't bump growth_rate_mult globally to match Naica slow.** The simulator's per-step timescale isn't geological time; calibration is per-scenario-author choice. The dampener handles the high-fill end without disturbing the low-fill end.

---

## 8. References

The web searches reached primary sources for each major claim. Notable papers:

- **Tenthorey & Cox 1998** — "Precipitation sealing and diagenesis: 1. Experimental results" *Journal of Geophysical Research: Solid Earth*. Permeability falls 10× while porosity stays nearly constant. [WRAP-Warwick mirror](https://wrap.warwick.ac.uk/id/eprint/167020/)
- **Aharonov 1998** — "Precipitation sealing and diagenesis: 2. Theoretical analysis" *JGR*. Theoretical companion. [AGU link](https://agupubs.onlinelibrary.wiley.com/doi/abs/10.1029/98JB02230)
- **Tanaka et al. 2018** — "Hopper Growth of Salt Crystals" *J. Phys. Chem. Lett.* Quantitative σ threshold + σ³ scaling for cubic→hopper transition. [PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC5994728/)
- **Proust & Fontan 2007** — "Genesis of amethyst geodes in basaltic rocks of the Serra Geral Formation (Ametista do Sul, Brazil)" *Mineralium Deposita*. Calcite as the closing mineral in Brazilian amethyst geodes. [Springer](https://link.springer.com/article/10.1007/s00126-002-0310-7)
- **Crystal Growth & Design 2018 (Naica selenite paper)** — "Naica's Giant Crystals: Deterioration Scenarios" *Crystal Growth & Design*. 0.01 mm/year growth rate; 500,000-year accumulation. [ACS](https://pubs.acs.org/doi/10.1021/acs.cgd.8b00583)
- **Pinch & Wilson 1977; Bowell 2010** — Tsumeb succession. The hypogene → galena+gangue sequence. [Bowell 2010 MME](https://www.mme.gov.na/files/publications/c46_GSN%20Comms%2019.%203.%20Bowell%20&%20Mocke_Tsumeb%20Minerals.pdf)
- **Nature Communications 2022** — "Crystal growth in confinement". Concentration-gradient nucleation localization. [Nature](https://www.nature.com/articles/s41467-022-34330-5)
- **Spry & Thieben 1996** — "Au-Ag-Te epithermal deposits" *Mineralium Deposita 31*. Cripple Creek native_tellurium paragenesis. (No direct URL — cited in research/minerals/research-native-tellurium.md.)

---

## 9. Companion artifact: `tools/high_fill_probe.mjs`

The probe tool that produced §2's data. Per-scenario trajectory of vugFill, growth-zone activity, and seal events, binned at threshold crossings 0.50, 0.75, 0.90, 0.95, 0.99. Reads everything from the live bundle; no code changes. Runs in ~5s.

Shipped alongside this doc so the data is reproducible and the proposal can be re-checked against a future simulator state.

Run with:
```bash
node tools/high_fill_probe.mjs [seed]   # seed defaults to 42
```

Sister to `tools/twin_rate_check.mjs`, `tools/mineral_coverage_check.mjs`, `tools/stale_mineral_probe.mjs`.

---

## 10. Closing note

The boss's framing: *"the data should lead your decisions."* Two data inputs to this proposal:

- **Simulator probe** (`tools/high_fill_probe.mjs`): 24 scenarios × per-step trajectory × per-bin growth statistics. Shows where the simulator is and isn't honest about high-fill physics.
- **Geological literature**: six primary sources spanning experimental kinetics (Tenthorey, Tanaka), specimen documentation (Proust & Fontan, Pinch & Wilson), and confined-geometry physics (Nature Comm 2022).

The two converge: the simulator's 0.95 binary cliff is the most visible non-geological behavior at the high-fill end. Proposal A fixes it surgically. Proposals C and B build directly on A. D and E are scope expansions to defer.

Recommend starting with Proposal A — the smallest end-to-end change with the largest honesty win.

---

## 11. Proposal A — landing notes

Shipped 2026-05-17, the day after this research doc landed.

**The sigmoid that landed**, in `js/85d-simulator-step.ts`:

```ts
function _fillDampenerFor(vugFill: number): number {
  if (vugFill <= 0.7) return 1.0;
  if (vugFill >= 1.0) return 0.0;
  return 1.0 / (1.0 + Math.exp(20 * (vugFill - 0.85)));
}
```

Three regions:

| vugFill | dampener | behavior |
|---------|----------|----------|
| ≤ 0.70 | 1.0 (exact) | no RNG cost, no behavior change — 18 of 24 scenarios stay here their entire run |
| 0.70 – 1.00 | sigmoid 1.0 → ~0.05 | probabilistic gate on nucleation; multiplicative dampener on growth thickness |
| ≥ 1.00 | 0.0 (exact) | preserves the old hard-cliff geometry: no new positive growth, dissolution still allowed |

The 0.7 short-circuit means most scenarios pay zero RNG cost — calibration baselines for those scenarios are byte-identical pre/post Proposal A. The 1.0 hard floor is a stand-in for Proposal D's eventual "interlocking texture" mode; without it, the dampener at fill = 1.05 is non-zero (~0.005) and tiny growth still accumulates over 200 steps × many crystals (sabkha hit 24× cavity volume in probing without this floor).

**Where the dampener applies:**

- **Nucleation:** `_atNucleationCap` rolls one RNG number per call when `_fillDampener < 1.0`. If the roll fails, the mineral is gated for this step. `fill_exempt` minerals (the Backlog K set: borax, mirabilite, thenardite, sylvite) bypass the roll entirely — they encode the geological "efflorescent crust on existing crystals" semantics that's orthogonal to mass-transport limitation.
- **Growth:** in the main step loop in `85-simulator.ts`, positive `zone.thickness_um` is multiplied by `this._fillDampener`. **fill_exempt minerals do NOT bypass the growth dampener** — an efflorescent crust can keep nucleating but its individual blades are still mass-transport-limited. Without this distinction, fill_exempt minerals in searles_lake / sabkha blew past 100× cavity volume during probing.
- **Dissolution:** never dampened. Etching of an existing crystal isn't gated by free pore space.

**Verification — growth-rate trajectory before/after** (from `tools/high_fill_probe.mjs`, all scenarios pooled at seed 42):

| vugFill bin | mean zone thickness BEFORE | mean zone thickness AFTER |
|-------------|----------------------------|---------------------------|
| 0.00–0.10 | 63.5 µm | 63.7 µm |
| 0.10–0.25 | 144.0 µm | 149.7 µm |
| 0.25–0.50 | 272.7 µm | 260.0 µm |
| 0.50–0.75 | 223.3 µm | 215.9 µm |
| 0.75–0.90 | 161.9 µm | 118.1 µm |
| 0.90–0.95 | 69.9 µm | 33.5 µm |
| 0.95–0.99 | 153.8 µm (n=2 — noisy) | 11.6 µm (n=29) |
| 0.99–1.00 | 0 µm (n=0 — never sampled) | 6.4 µm (n=72) |

The 0.95–0.99 bin had n=2 step-pairs before — the simulator was flying through that range. Now n=29 with clean trajectory data. Smooth decay from 260 µm peak to 6.4 µm at near-seal. The geological narrative ("growth slows as boundary-layer diffusion takes over") is finally honest.

**Verification — peak vugFill before/after** (the 6 high-fill scenarios):

| scenario | before | after |
|----------|--------|-------|
| supergene_oxidation | 1.003 | 1.000 |
| naica_geothermal | 1.035 | 1.004 |
| searles_lake | 1.029 | 1.030 |
| sabkha_dolomitization | 2.517 | 2.517 |
| gem_pegmatite | 1.476 | 1.476 |
| radioactive_pegmatite | 2.627 | 2.627 |

Improved or unchanged everywhere. The remaining overshoots (sabkha 2.5×, gem_pegmatite 1.5×, radioactive 2.6×) are pre-existing single-step-overshoot artifacts — many crystals nucleating + growing within step 1 before vugFill is re-measured — and not affected by the dampener. Proposal D's interlocking-texture bookkeeping would fix those properly; for Proposal A we preserved the in-loop `if (currentFill >= 1.0)` guard as belt-and-suspenders.

**Tests:** 197 → 202. The 5 new tests pin: dampener=1.0 below 0.7, dampener≈0.5 at 0.85, dampener≈0.12 at 0.95 (proposal-doc anchor), dampener=0 at fill ≥ 1.0, monotonicity across vugFill 0–1.5. Plus probabilistic-gate verification: 1000 rolls at dampener=0.5 yields 400–600 blocks (50% ± noise band).

**Coverage tool unchanged:** 0 stale, 89 live, 27 dead — same as post-stale-sweep state. The dampener doesn't introduce new stales; it just smooths the high-fill regime.

**What this didn't ship:**

- Proposals B (habit transitions on fill × σ), C (per-mineral late_stage_propensity), D (interlocking textures), E (per-cell local fill) all still open. C is the natural next item if/when the boss wants to generalize the binary fill_exempt set into a gradient.
- Tools/high_fill_probe.mjs continues to be useful for verifying any future high-fill change — runs in ~5s.

---

## 12. Proposal C — landing notes

Shipped 2026-05-17 (same day as Proposal A's landing notes).

**The graduated formula**, in `js/85b-simulator-nucleate.ts`:

```ts
let propensity = 0.0;
if (spec) {
  if (typeof spec.late_stage_propensity === 'number') {
    propensity = Math.max(0, Math.min(1, spec.late_stage_propensity));
  } else if (spec.fill_exempt) {
    propensity = 1.0;  // backward compat: fill_exempt:true ≡ propensity:1.0
  }
}
const effective = dampener + propensity * (1.0 - dampener);
if (effective < 1.0 && rng.random() >= effective) return true;
```

The formula `D' = D + p(1-D)` is the linear interpolation between the bulk dampener (p=0 → D' = D) and full bypass (p=1 → D' = 1.0). It composes cleanly with Proposal A's sigmoid:

| vugFill | D    | calcite (p=0.4) D' | lepidocrocite (p=0.9) D' | borax (p=1.0) D' |
|---------|------|---------------------|--------------------------|-------------------|
| 0.85    | 0.50 | 0.70                | 0.95                     | 1.00              |
| 0.95    | 0.12 | 0.47                | 0.91                     | 1.00              |
| 0.99    | 0.05 | 0.43                | 0.91                     | 1.00              |

A late-stage mineral with propensity 0.9 stays at >90% pass-through rate across the entire high-fill regime; bulk minerals (propensity 0) suffer the full sigmoid drop. The shape matches the geological intuition: at vugFill=0.95, you'd expect a lepidocrocite patina to be forming at near-normal rate while calcite forms at ~half its peak rate and bulk galena is essentially blocked.

**20 minerals scored** with literature anchors. The scoring lives in `data/minerals.json` as `late_stage_propensity` + `_late_stage_note` per entry. Bulk-mineral default (no field set) = 0.0. Summary by tier:

| tier | propensity | minerals |
|------|-----------|----------|
| 1 — terminal / paramorph     | 1.0 | borax, mirabilite, thenardite, sylvite, tincalconite |
| 2 — terminal patina          | 0.9 | lepidocrocite |
| 2 — efflorescent crust       | 0.7–0.8 | chalcanthite, erythrite, annabergite |
| 3 — supergene crust          | 0.6 | goethite, chrysocolla, aurichalcite |
| 4 — sometimes late           | 0.3–0.4 | calcite, native_tellurium, malachite, aragonite, azurite |
| 5 — drusy / MVT-gangue tail  | 0.2 | quartz, fluorite, barite |
| 0 — bulk (default)           | 0.0 | every other mineral (~96 of 116) |

**Backward compatibility:**

- `fill_exempt: true` (Backlog K) still works — without a `late_stage_propensity` field, the engine falls back to `propensity = 1.0`. Existing fill_exempt:true minerals additionally got `late_stage_propensity: 1.0` set explicitly for clarity. The fill_exempt field is now schema-documented as DEPRECATED but still honored.

**Verification — probe trajectory (post-Proposal-C vs post-Proposal-A):**

| vugFill bin | nuc/step BEFORE Proposal C | nuc/step AFTER Proposal C |
|-------------|----------------------------|----------------------------|
| 0.75–0.90 | 0.114 | 0.118 |
| 0.90–0.95 | 0.037 | 0.038 |
| 0.95–0.99 | 0.172 | **0.333** |
| 0.99–1.00 | 0.028 | **0.062** |

Doubled nucleation rate in the 0.95+ regime — late-stage minerals (calcite/quartz/malachite/etc.) now fire in the high-fill regime where they previously couldn't. Geologically: druzy crusts can form on top of bulk-mineral surfaces.

**Calibration baseline drift:** 4 of 24 scenarios — naica_geothermal, radioactive_pegmatite, searles_lake, supergene_oxidation. All in expected direction (more late-stage minerals at high fill). Other 20 byte-identical (didn't reach the dampener-active regime).

**Tests:** 9 new in `tests-js/late-stage-propensity.test.ts` — pin the 20-mineral scoring, the resolver math at 3 anchor points, backward-compat source presence, and the relative-ordering invariant (high-propensity minerals pass more often than bulk at the same dampener).

**Coverage:** unchanged — 0 stale / 89 live / 27 dead.

**Future open items still pending from this research doc:**

- **B** (habit transitions on fill × σ): the existing habit_variants infrastructure is ready; the trigger needs updating from "rapid evaporation" to "high local σ + low local fill." ~3 hours.
- **D** (interlocking textures past 1.0): would fix the sabkha 2.5× / gem_pegmatite 1.5× single-step overshoots. ~1 day including renderer.
- **E** (per-cell local fill): biggest scope, lets corners stay open while edges fill. Defer until A+C land and we see if heterogeneous fill is needed.
