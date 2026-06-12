# RESEARCH — Calcite growth morphology as a function of supersaturation + impurities

*Compiled 2026-06-11 for the "stepped calcite" feature. Saved per boss
directive ("be sure to save the research data you use for later
verification"). This is the geological oracle the morphology engine is
built FROM — verify the engine against this doc, not against a plausible
story. Companion to the Movements research (RESEARCH-vug-fluid-evolution-
2026-06-01.md): that doc drives the fluid CURVES; this doc says what those
curves do to crystal SHAPE.*

---

## 0. The boss's framing (the north star for this feature)

> "if the data produces multiple morphologies so should the game."

So the deliverable is NOT a single hand-picked "stepped" habit. It is a
**morphology diagram**: one engine that reads the local growth conditions
(supersaturation σ, impurity load, and — uniquely available to us now —
the supersaturation HISTORY from the Movements layer) and lets the whole
documented spectrum of calcite forms EMERGE, the way it emerges in rock.
Stepped/macrostepped calcite is one band of that spectrum; smooth spar,
dendrite, hopper/skeletal, and spherulite are its neighbors. Following the
science means producing all of them from the same mechanism.

---

## 1. The two growth regimes (the spine of the whole thing)

Calcite grows by adding material at **steps** on its surface. Where those
steps come from sets everything else.

**Regime A — spiral (dislocation) growth.** At LOW supersaturation, steps
are supplied by screw dislocations: a single dislocation winds out a
growth spiral (a vicinal hillock), steps flow laterally, and the face
stays macroscopically **smooth and rational** — the classic euhedral
rhombohedron / scalenohedron. This is what the sim grows today.

**Regime B — two-dimensional (2D) surface nucleation.** As supersaturation
RISES, the crystal can nucleate brand-new islands directly on a flat
terrace, faster than spirals can blanket it. Growth becomes **layer-by-
layer** from many island sources at once.

The transition is the whole feature. Key measured facts:

- The crossover sits around a reduced supersaturation of **σ ≈ 0.8** on
  the {10.4} cleavage face (σ defined as σ = ln(a_Ca·a_CO3 / Ksp); σ=0 is
  equilibrium). Below it, step flow at defects dominates; above it, 2D
  nucleation "becomes increasingly important." [Teng, Dove & De Yoreo 2000]
- Crystal SIZE matters: for crystals larger than ~1 µm, slow boundary-
  layer diffusion holds the SURFACE supersaturation low even when the BULK
  is high, so big crystals keep favoring spiral growth unless the bulk σ is
  genuinely high (Sbulk ≳ 3). 2D nucleation dominating outright needs high
  σ AND small size. [Wolthers et al., *Calcite Kinetics for Spiral Growth
  and Two-Dimensional Nucleation*, Cryst. Growth Des. 2022]

**Why this is the spine:** smooth-vs-stepped is not a cosmetic toggle, it
is which regime the face is in. The sim already computes a per-step σ for
calcite (`supersaturation_calcite()`); the regime — and therefore the
habit — is a readout of that number's level and history.

---

## 2. Step bunching → the visible "steps" of stepped calcite

2D-nucleation / layer growth produces *elementary* steps (one molecular
layer). The macroscopic terraces you see on a hand specimen are those
elementary steps **bunched** into **macrosteps**:

- Step bunching is a morphological instability: a regular train of evenly
  spaced steps spontaneously decomposes into low-density regions
  (terraces) and high-density regions (bunches), which condense into
  macrosteps. [step-bunching literature, general]
- It is **driven by impurity binding to the surface** (impurities pin
  steps; faster steps catch up and pile into the pinned ones) and by
  **fluctuations in growth conditions** — every surge in supersaturation
  lays down a fresh burst of steps that bunch against the previous front.
- As a bunch grows taller it can transition from a 2D to a **3D**
  nucleation mechanism on the macrostep riser, locking the terrace in.

**The load-bearing connection to Movements:** real macrostep trains record
*fluctuating* growth. The Movements engine (shipped v169–v186) drives
exactly that — oscillatory / pulsed supersaturation via pH/Eh/chemistry
curves. So in this sim the stepped habit should EMERGE from a movement-
driven or OU-textured σ history, not from a constant flag. The steps are
the chemistry curve made solid. (This is the single most important design
consequence in this doc.)

---

## 3. The full morphology diagram (low → high supersaturation)

Increasing supersaturation walks calcite through a documented sequence.
The game should reproduce the whole walk:

This walk follows the **Sunagawa progression** — the canonical mapping of
driving force (Δμ/kT) onto interface roughness and habit: as the driving
force rises a crystal goes **polyhedral → hopper/skeletal → dendritic →
spherulitic** [Sunagawa 1981; *Crystals: Growth, Morphology, and
Perfection*, 2005].

| σ band (qualitative) | regime | morphology | what you SEE |
|---|---|---|---|
| very low | spiral, near-equilibrium | euhedral, **smooth** rhomb/scalenohedron | glassy spar faces |
| low–moderate | spiral → onset 2D | well-formed faces, faint vicinal steps | sharp spar, subtle striae |
| **moderate–high** | **2D nucleation + step bunching** | **macrostepped / terraced faces** | **stepped calcite** — stair-step rhomb/scalenohedron |
| high | **onset of morphological (diffusional) instability** — edges/corners outrun the face centers | **skeletal / hopper** | hollow funnel faces, still recognizably faceted |
| very high | the same instability **taken further** — protrusions branch | **dendritic** | branched trunks + side arms |
| extreme | stress + secondary nucleation | **spherulitic** | radiating fibrous balls |

**ORDERING CORRECTION (2026-06-11, peer review — keep this, it was caught
before it reached the engine):** an earlier draft of this table placed
*dendritic* BEFORE *hopper/skeletal*. That is backwards. Hopper/skeletal is
the ONSET of instability: corners and edges sit in a richer part of the
diffusion field and outrun the face centers, hollowing the faces into
funnels while the crystal is still faceted. Dendrites are that instability
developed further — the protrusions grow into branched trunks with side
arms. So hopper/skeletal sits BETWEEN the stepped regimes and full
dendrites, never after them. The mis-order would have said "branches appear
before the faces even start to hollow," which contradicts the physics. The
classifier and the fleet map were corrected to the Sunagawa order.

Sources for the high-σ end:
- Sunagawa, I., *Crystals: Growth, Morphology, and Perfection*, Cambridge
  Univ. Press (2005); and "Characteristics of crystal growth in nature,"
  *Bull. Minéral.* 104 (1981) 81. — the driving-force → polyhedral → hopper
  → dendrite → spherulite progression (the load-bearing ORDER).
- "an increase in supersaturation induces dendritic morphologies, and very
  high levels induce spherulites by accumulation of stresses and secondary
  nucleation." [*Towards a morphology diagram for terrestrial carbonates*,
  Geochim. Cosmochim. Acta 2021]
- "interfacial instability drives skeletal/hopper crystals where edges grow
  faster than faces… linked to very rapid 2D-nucleation growth possible
  only at very high supersaturation." [hopper/tabular calcite under
  confinement, Cryst. Growth Des. 2023]

Note hopper, dendrite, and clean macrosteps are RELATIVES on ONE instability
axis: all are 2D-nucleation / rough-interface products; clean macrosteps are
the mild end, hopper the onset of face-hollowing, dendrite the runaway.
Good for us — one mechanism, dialled by σ.

---

## 4. The second axis — impurities (the habit elongation control)

Supersaturation sets smooth↔stepped↔hopper. Impurities set the FORM the
steps build into (rhomb vs scalenohedron / dogtooth) and bias bunching.
The canonical impurity is **Mg²⁺**:

- Mg²⁺ substitutes for Ca²⁺ (ionic radii 0.86 vs 1.14 Å) → lattice strain,
  raised solubility, and a real **growth-inhibition** effect that scales
  with aqueous Mg concentration. [De Yoreo / Davis et al.; AFM Mg studies]
- At **Mg/Ca ≈ 0.2**, new faces appear at the edges and corners of the
  pure-calcite rhombohedron — i.e. Mg **elongates** calcite toward the
  c-axis / **scalenohedral (dogtooth)** habit. Higher Mg/Ca eventually
  pushes toward aragonite (out of scope here). [*Evolution of calcite
  growth morphology in the presence of magnesium*, GCA 2015]
- Other classic step-specific modifiers (out of scope for v1 but worth a
  note): Sr²⁺, SO₄²⁻, and organics (aspartic acid) alter step-edge free
  energy and morphology dramatically. [Teng/Dove 1998 biomineral baseline]

**Design consequence:** the existing sim already partitions Mn/Fe and has a
manganocalcite branch. Mg is the right SECOND knob: high Mg/Ca → bias the
emergent form toward scalenohedral/dogtooth + sharpen step bunching; low Mg
→ rhombohedral. This composes with, and does not replace, the σ axis.

**SHIPPED (Phase 4, SIM 187, 2026-06-11) — calibration evidence.** Both
knobs landed, thresholds set by fleet observation (a k∈{0, 0.4, 0.8}
sweep over every calcite scenario at seed 42):
- *Form elongation*: `calciteMorphForm` (Mg:Ca > 0.15 OR T > 200 →
  scalenohedral) drives the habit form everywhere (smooth spar included —
  elongation is form-level physics, regime-independent). Exactly four
  Mg-dominated waters flip: sabkha (Mg:Ca 3.3), searles (1.6),
  ultramafic (10), zoned_dripstone (0.75). The MVT brines (~0.075)
  correctly stay rhombohedral — Tri-State spar is rhombs, not dogtooth.
- *Bunching bias*: effective σ × (1 + 0.4·min(Mg:Ca, 1)) before the
  regime cut (engine + map tool in sync). k=0.4 chosen because Jeffrey
  Mine (Mg:Ca 0.84, serpentinite water) visibly shifts toward stepped
  (smooth 52%→37%, stepped 46%→60%) — the §6.3 hook observable in the
  fleet — while every scenario's DOMINANT regime stays the validated one
  and dendrite remains transient-rims-only. k=0.8 pushed zoned_dripstone
  to 47% dendritic, against ground truth — rejected.
- Seed-42 counts and the strip digest did not move (the four flipped
  calcites are µm-scale crusts; the aspect-ratio coupling is below
  count/trajectory resolution at this seed) — but the coupling is real,
  hence the SIM bump.

---

## 5. How this maps onto the sim (units + calibration caveat)

**σ units do NOT transfer directly.** The literature σ above is
σ = ln(IAP/Ksp), where σ=0 is equilibrium and the 2D-nucleation crossover
is ~0.8. The sim's `supersaturation_calcite()` returns a different
quantity: a ratio-like number where **<1.0 = dissolution, >1.0 = growth,
rate ∝ (σ−1)**. The two are monotonically related but NOT equal. So the
regime thresholds in sim units MUST be calibrated by OBSERVATION against
the sim's actual per-scenario σ distribution — they cannot be transcribed
from the papers. (This is the same discipline as the thermo Ksp work: the
science gives the SHAPE and ordering; the sim's own numbers give the
thresholds. Do not fabricate a sim-unit σ cutoff.)

**What the engine reads (all already available per step):**
- `supersaturation_calcite()` — the σ level → spiral / 2D / hopper /
  dendrite band (Sunagawa order — see the §3 ordering correction).
- σ HISTORY across recent zones (`crystal.zones[]` already stores per-step
  growth_rate) → step-bunching strength: a fluctuating/rising σ train
  bunches; a flat low σ stays smooth. THIS is where Movements feeds in.
- `fluid.Mg` / Mg:Ca ratio → form elongation (rhomb ↔ scalenohedral) +
  bunching bias.
- temperature → already used (the existing >200 / >100 / else habit ladder
  in `grow_calcite`).

**Where it plugs in (from the codebase recon, 2026-06-11):**
- Engine: `js/52-engines-carbonate.ts grow_calcite()` — the manganocalcite
  branch (~lines 80–107) is the exact precedent for a condition-dispatched
  habit override. The morphology classifier lives here.
- Per-zone record: `GrowthZone` (`js/27-geometry-crystal.ts`) already
  carries per-step thickness + traces; add a per-zone morphology tag
  (regime + step height) so the SHAPE history is recorded, not just chem.
- Geometry: `Crystal.add_zone()` integrates zones into an ellipsoid of
  revolution today — NO per-zone surface relief. Making steps VISIBLE means
  the geometry/renderer must read the per-zone morphology tags and build
  actual terraces (the hard, user-facing part the boss wants to "watch").
- Render: `js/99c-renderer-primitives.ts` + `99d`/`99i` map habit → a
  primitive. Stepped/hopper/dendrite/spherulite need either new primitives
  or a per-zone terrace overlay.
- Habit data: `data/minerals.json` calcite `habit_variants` (6 today) — add
  the σ-driven morphology variants with explicit triggers.

---

## 6. Open verification hooks (what a future check should re-test)

1. **Regime ordering** holds in sim units: as the calibrated σ rises, the
   emergent habit walks smooth → stepped → hopper → dendritic, never out of
   order (Sunagawa order per the §3 correction — two residuals of the
   pre-correction draft survived in §5/§6 until 2026-06-11; if you find
   another, fix it AND re-check the classifier against §3).
   (A dark-observe sweep over a σ ramp is the test.)
2. **Movement-driven bunching**: a scenario with an oscillatory σ movement
   produces MORE/ taller macrosteps than the same scenario with flat σ —
   i.e. the steps track the curve. (The headline claim of §2.)
3. **Mg elongation**: raising `fluid.Mg` at fixed σ biases the emergent
   form toward scalenohedral/dogtooth + sharper bunching. (§4.)
4. **No-regression**: existing calcite scenarios (Mn-calcite, dripstone,
   travertine, the tutorials) keep their habits unless their σ/Mg genuinely
   sits in a new band — and any move is explained by this doc.

---

## 7. Sources (verifiable)

- Teng, Dove & De Yoreo, "Kinetics of calcite growth: surface processes and
  relationships to macroscopic rate laws," *Geochim. Cosmochim. Acta* 64
  (2000) 2255. — spiral↔2D crossover at σ≈0.8 on {10.4}.
  https://www.sciencedirect.com/science/article/abs/pii/S0016703700003410
- De Yoreo & Dove et al., "Thermodynamics of calcite growth: baseline for
  understanding biomineral formation," *Science* 282 (1998) 724. — step-edge
  free energies, critical step length vs σ, organic (Asp) morphology shift.
  https://www.science.org/doi/10.1126/science.282.5389.724
- Wolthers et al., "Calcite Kinetics for Spiral Growth and Two-Dimensional
  Nucleation," *Cryst. Growth Des.* 22 (2022). — 2D needs Sbulk≳3 & L≲1µm;
  big crystals keep spiral via boundary-layer diffusion.
  https://pubs.acs.org/doi/10.1021/acs.cgd.2c00378
- "Towards a morphology diagram for terrestrial carbonates," *Geochim.
  Cosmochim. Acta* (2021). — smooth → dendrite → spherulite with rising σ.
  https://www.sciencedirect.com/science/article/abs/pii/S0016703721002258
- "Electrochemically Assisted Growth of Hopper and Tabular Calcite under
  Confinement," *Cryst. Growth Des.* (2023). — hopper/skeletal as the
  high-σ 2D-nucleation / interfacial-instability extreme.
  https://pubs.acs.org/doi/10.1021/acs.cgd.3c01433
- "Evolution of calcite growth morphology in the presence of magnesium,"
  *Geochim. Cosmochim. Acta* (2015). — Mg/Ca≈0.2 new edge/corner faces,
  c-axis elongation toward scalenohedral.
  https://www.sciencedirect.com/science/article/abs/pii/S0016703715005591
- De La Pierre et al., "Uncovering the Atomistic Mechanism for Calcite Step
  Growth," *Angew. Chem. Int. Ed.* (2017). — ion-pair attachment at acute
  step edges (kink-site mechanism underlying step flow).
  https://onlinelibrary.wiley.com/doi/full/10.1002/anie.201701701
- Step bunching / macrostep general: "Step bunching and macrostep formation
  in 1D atomistic model of unstable vicinal growth," *J. Cryst. Growth*
  (2016). — impurity-pinned bunching → macrostep condensation.
  https://www.sciencedirect.com/science/article/abs/pii/S0022024816308387

*All URLs captured 2026-06-11. If re-verifying, the load-bearing numbers
are: spiral↔2D crossover σ≈0.8 (reduced units, Teng 2000); 2D-dominant
needs Sbulk≳3 & L≲1µm (Wolthers 2022); Mg/Ca≈0.2 elongation onset (GCA
2015). Everything else is ordering/qualitative.*
