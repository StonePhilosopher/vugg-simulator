# HANDOFF — Directional / Polar / Stepped Growth arc (2026-06-22)

**State at handoff:** HEAD `5bf23ac`, origin/main == HEAD, Pages built at HEAD. **SIM_VERSION 214 — UNCHANGED** (the entire arc is render-only / byte-identical; no rebake). Tree clean (only `tools/strip-story-diff.mjs`, a concurrent session's untracked WIP — never stage it). cold-ci GREEN after every phase.

**The arc in one paragraph.** Boss directive: "geologically accurate wireframe models — asymmetric stepped growth (steps on one face-set, not all; opposite faces smoother), polarized growth (one end faster, the other slower or not at all), calcite {104} as a DETERMINISTIC growth feature." This is morphology emerging from ANISOTROPIC growth — the physics, a bigger axis than the optics goal. We researched it deeply (multi-agent, citation-verified), wrote the design proposal, and shipped the staged render-only phases that don't need a baseline rebake. The destination is the **central-distance / Wulff model** (a crystal = ⋂ half-spaces {nᵢ·x ≤ dᵢ}, normals fixed by point group + lattice, only the distances dᵢ grow; "slow faces win"). We are partway up that staircase.

---

## ADDENDUM (2026-06-23) — specimen-debt verification pass (Phases 1+3 falsified against the literature)

The owed terminal-verification debt got paid. Two citation-verified research passes (calcite {104}
directional stepping; greenockite/wurtzite/tourmaline hemimorphism) were cross-checked against what
the renderer ACTUALLY draws. Four render-only / doc corrections shipped — **byte-identical, NO SIM
bump (still v214)**, cold-ci GREEN, tourmaline browser-verified.

| Finding | Verdict | Action |
|---|---|---|
| **Tourmaline drawn as a HEXAGONAL prism** | WRONG (HIGH conf.) — point group 3m, the prism zone is DITRIGONAL; the real cross-section is a rounded triangle with convex sides ("no other common mineral has three sides"; Handbook of Mineralogy / dravite). A hexagon erases the species' single most diagnostic feature and implies the wrong symmetry. | **FIXED** — `_makeSectorZonedPrism` (js/99i; the tourmaline-ONLY sector-zoning builder) now uses a 3-fold cos(3θ) ring radius. Browser-verified: top-down = rounded triangle; 3/4 = bicolor elbaite prism + pink pyramid + flat hemimorphic base. |
| **Calcite Phase 1 mechanism** | MIS-ATTRIBUTED — the visible one-sided macrostepping is TRANSPORT-driven (the six {104} faces are symmetry-equivalent; Berg 1938; Wang/Gilbert 2022 Science 376:abm1748, "solely controlled by the diffusion of ions"). The obtuse/acute {104} anisotropy is a finer WITHIN-face AFM effect (→ intrasectoral zoning), NOT the whole-face carve. | **CORRECTED** (comment + narrator; render unchanged) — js/99i science comment, js/92b, narratives/calcite.md. The carve reads right; only the WHY was wrong. |
| **Greenockite + wurtzite hemimorphic hex prism** | VERIFIED FAITHFUL — both genuinely 6mm (Handbook of Mineralogy verbatim; euhedral crystals are the minority habit but the prized form is faithful). | No geometry change. Softened the over-confident +c/−c pole LABELS in `_makeHemimorphicPrism` — the analogous/antilogous → ±c mapping is reported inconsistently, so the render shows the two-different-ends FACT, not a sign. |
| **Hemimorphite** | **FIXED (same session, 2026-06-23)** — was routed to the hexagonal prism but is ORTHORHOMBIC (Imm2, mm2). | Researched (Handbook of Mineralogy) + built `_makeHemimorphiteFan` (js/99i): a divergent fan/sheaf of thin tabular blades, pointed free ends / flat pedion bases (the Tsumeb bowtie); caught before the hexagonal prism (greenockite/wurtzite keep it). Keeps its `_polarAxis` tag (mm2 is polar); geometry only. Browser-verified (bowtie splay). Remaining: the `botryoidal_blue` crust variant also renders as the fan — a true blob builder is a future refinement. |

**Lesson (adds to the float-vs-embed headline):** "green = not yet falsified" is literal. Two shapes
shipped on literature alone; the verification falsified one render (tourmaline hexagon) and one
mechanism claim (calcite obtuse/acute → whole-face) and confirmed two (greenockite/wurtzite). The
catalog + image-corpus is still the apex instrument — a real calcite specimen for free-vs-attached
macrostep contrast, and a real greenockite/tourmaline termination, remain owed.

---

## What shipped (commit by commit)

| Commit | Phase | What | Verify |
|---|---|---|---|
| `6da6ec9` | Research | Design proposal `proposals/PROPOSAL-DIRECTIONAL-GROWTH-2026-06-22.md`. Multi-agent workflow (11 agents, ~928K tokens): 4 science passes + engine-integration, every citation adversarially web-verified (40+, ZERO fabrications), completeness critic, synthesis. + catalog point-group audit EXECUTED. | physics cross-checked by hand |
| `a1606dc` | **0 — infra** | Per-face render-tag rails, DORMANT: `_faceStep`/`_occlusion`/`_polarAxis` namespace documented in js/27 (NOT initialized — the `_deformation`/`_etch` precedent); `classifyFaceStep` (js/45, pure, gated on `wall.directional_steps`); wired js/85; js/99i terrace cache-sig conditional face-set token. | cold-ci GREEN, 0 baseline diff |
| `8a981bc` | **1 — calcite {104}** | THE visible payoff. elmwood opts in; `_makeDirectionalTerracedCalciteGeom` (js/99i) carves the stepped face-set {0,1,2}, leaves the opposite set smooth. + narrator. | browser-verified (side view: one side staircased, opposite smooth); elmwood == v214 baseline |
| `c143375` | **3 — polarity** | Intrinsic hemimorphism. `classifyPolarAxis` (js/45) tags the 4 polar tenants; `_makeHemimorphicPrism` (js/99i, +c pyramid / flat −c pinacoid). **Mostly a BUG FIX** — greenockite's `hexagonal_pyramidal` habit fell to a generic prism (token wart); its narrator already said "hemimorphic pyramid," so prose+geometry now agree. | browser-verified greenockite; cold-ci GREEN |
| `5bf23ac` | **2 — check (re-promote; NOT built)** | Float-vs-embed check + BACKLOG correction (see below). Phase 2 occlusion code is NOT shipped — this commit only verified it's worth building and corrected the record. | live render + placement code read |

**No SIM bump anywhere.** Every change is render-only: the classifiers are pure tagging (no rng, no fluid), the tags never touch counts/sizes/chemistry, so the seed-42 calibration baseline (`tests-js/baselines/seed42_v214.json`) is byte-identical. Tests: `tests-js/facestep.test.ts` (3 pins), `tests-js/polar-axis.test.ts` (3 pins).

---

## The data model (what the next builder inherits)

Three crystal-level RENDER tags, each its own field (the science forbids conflating them — see proposal §1.3), set by a pure post-step classifier (js/45), read by the renderer (js/99i), never serialized into the baseline:

- **`_faceStep`** `{ steppedFaceSet, atStep }` — directional macrostep relief on ONE face-set (calcite {104} obtuse/acute anisotropy). **SHIPPED** (Phase 1, elmwood). Gated on `wall.directional_steps` (opt-in).
- **`_polarAxis`** `{ pointGroup }` — intrinsic crystallographic polarity, the 10 polar point groups only. **SHIPPED** (Phase 3). ALWAYS-ON for the 4 tenants (intrinsic, not opt-in).
- **`_occlusion`** `{ attachedFraction }` — the buried substrate-attached end (extrinsic, universal). **NOT BUILT** (Phase 2, re-promoted — see below).

The classifier-dispatch pattern (mirror `classifyDeformation`/`classifyEtch`/`classifySectorZoning`): a pure function in js/45, wired into the js/85 post-step dispatch, no-op unless its gate fires → byte-identical fleet. This is the cheapest way to add render-only morphology in this codebase, and it's the spine of the whole arc.

---

## Key findings & lessons (read these before continuing)

1. **THE FLOAT-VS-EMBED CORRECTION (the headline lesson).** Mid-arc I hypothesised that in a vug the attached base is buried in the wall, so c-axis termination features (Phase 2 occlusion + Phase 3 polarity) are mostly invisible → low-value. **That was WRONG.** The placement code (`js/99i:4070-4081`) deliberately floats the WHOLE crystal into the cavity: `offsetMm = cLen*0.5; position = anchor + cAxis·offset`, with the comment *"position the BASE at the anchor … so the crystal projects into the cavity rather than half-buried in the wall."* Crystals **float** base-on-surface; the base IS visible; both terminations show. I'd reasoned from the BUILDERS (open/flat base) without reading the PLACEMENT (floats it out). The boss's "look before you assert" check caught it. Consequence: **Phase 3 polarity is genuinely visible** (worth it), and **Phase 2 occlusion is RE-PROMOTED** — a real visible win, not marginal.

2. **TWO render systems — do not confuse them.** The big **WALL PROFILE** canvas (`topo-canvas`) is the **2D** isometric wireframe painter (`js/99d` `_renderCrystalWireframe`, called from `js/99e`). The **3D** crystal view (`topo-canvas-three`) is the **Three.js** path (`js/99i`) — this is where ALL the morphology builders live (terraces, hemimorphic, directional, saddle, bent, sceptre). Phase 1/3 changes show in the **3D Three view**, not the 2D wall profile. If a future morphology feature "doesn't show," check you're looking at the 3D view.

3. **WallState whitelists every flag** (`js/22`). A flag in `scenarios.json5` that isn't explicitly copied in the `WallState` constructor is silently dropped. Phase 1's `wall.directional_steps` was dropped until added to js/22 — and the Phase-0 flag-injection test missed it because it set the flag AFTER construction. Any new `wall.*` flag needs a line in js/22.

4. **The render already approximates more than the proposal assumed.** The prism builders bake in pyramid-top/flat-base (so prism minerals were already pseudo-hemimorphic), and `hexagonal_pyramidal`/several habit strings fall through `_habitGeomToken` to `'prism'` (the pyritohedral/octahedral_REE token-wart family). Phase 3 was mostly correcting that wart, not adding a net-new feature. Worth knowing: when planning a morphology feature, check what the existing builders + token map already produce before assuming it's missing.

5. **Build-output discipline.** `tools/build-all.mjs` "continues anyway" on tsc errors, and `tail -2` can hide them. Watch full build output (grep `error|rebuilt|reported`), especially after edits near class boundaries — a dropped constructor brace passed `tail -2` once this arc (caught by a runtime probe).

---

## Where the next builder picks up (ranked)

1. **Phase 2 — substrate occlusion (RE-PROMOTED, recommended next).** The dominant universal driver, now confirmed visible. Real drusy crystals emerge single-terminated with the base embedded in the matrix; the sim shows the full free-standing crystal perched base-on-surface. **Approach** (proposal §2, Phase 2 row): add `_occlusion = { attachedFraction }` (classifier in js/45, gated on a `wall.occlusion` opt-in + the js/22 whitelist line); in js/99i shift the base offset so the lower `attachedFraction` of the crystal sinks below the wall surface (render the buried portion short / clipped). Render-only → byte-identical. **CAVEAT:** this is the UNIVERSAL placement path (`offsetMm`/`mesh.position` at js/99i:4076) — the proposal flagged "watch the offset math"; browser-verify across several scenarios (elmwood, a pegmatite, mvt). The float-vs-embed screenshot in this session shows exactly the target read (lower ~40% embedded, single free termination).

2. **Phase 4 — the full central-distance (Wulff) model.** The destination: replace the (c_length, a_width, habit) triple with a per-crystal face set `[{normal, d, regime}]`, render via half-space intersection → `ConvexGeometry`. Reshapes the VISIBLE crystal per-face. Big lift; **decide the concavity primitive (nested convex shells, recommended) BEFORE generalizing stepped/skeletal** — neither the convex MVP nor the convex Wulff body can render hopper/skeletal concavity (proposal §2.3). Validate with the cube+octahedron fixture (equal d → cuboctahedron; shrink {111} → cube). Δd must be deterministic (per-(mineral,step) derived RNG, not the shared stream).

3. **Reactive morphology (boss's "later down the line" want).** Make WHICH face-set steps physically caused instead of yaw-arbitrary. Three rungs, cheapest first: (1) **void-normal orientation** via `wall_anchor` (cheap, real geometric cause); (2) flow/gravity-aware per scenario (`growth_environment:'air'` exists); (3) full diffusion-field-reactive off the merged multidim cavity voxel σ-grid (where the obtuse/acute reversal could track real local Ca:CO₃). Proposal §4.

## Open debts (carry these forward)

- **SPECIMEN-DEBT (terminal verification, owed).** Phases 1 + 3 shipped LITERATURE-anchored, not specimen-verified. Green = "not yet falsified," not "verified." Owed: a real **calcite** specimen showing free-vs-attached macrostep contrast (Phase 1's one-sided-carve premise); a real **greenockite/tourmaline** showing the hemimorphic termination (Phase 3). The catalog + image-corpus is the instrument. [[feedback_terminal_verification_specimens]]
- **Calibration debts (from the proposal, uncalibrated):** the numerical obtuse/acute velocity ratio vs Ca:CO₃ curve (Teng/Dove reversal cited, magnitude not pulled — Phase 1's directional SENSE is hard-coded, not chemistry-driven); per-mineral σ thresholds for the general smooth/stepped/skeletal classifier (a per-species calibration project, not first-principles); a structured `point_group` field (currently prose in `description`) — the clean enabler for Phase 3 generalization.
- **The 78°/102° {104} step geometry** is anchored to De Yoreo & Vekilov RiMG 54 (2003) as the framework, but the exact pair has no single pinned primary locus — confirm before any code comment quotes it as exact (it's the cleavage-rhomb diamond angle, so geometrically sound).

---

## Diagenesis credit

This arc moved fast because the ground was already laid: the **classifier-overprint plumbing** (deformation/etch/sector-zoning, built across the prior arcs) gave the pure-tagging pattern for free; the **terrace builder** (`_makeTerracedCalciteGeom`, the calcite-morphology arc) was the clone-base for the directional carve; **cold-ci** (the 10th-catch stamp) gated every phase; the **multi-agent research workflow** + adversarial citation verification did in one pass what would have been days of reading; and the **preview render-verification method** (render the real bundled builder against page-global THREE, screenshot) let every visible claim be checked before shipping. None of this was solo speed — it was velocity borrowed from infrastructure.

---

## Builder's note

The shape of this session was research → propose → stage → ship → **correct**. The correction is the part I'd underline. I demoted Phase 2 on a confident-sounding hypothesis built from reading half the system (the builders) and not the other half (the placement). It would have shipped a wrong conclusion into the backlog and cost the next builder a wrong start — except the boss asked me to *look* instead of *argue*, and looking falsified it in one render. The lesson isn't "I was wrong"; it's that **a claim about what the user sees is only as good as having looked at what the user sees** — code-reasoning is a hypothesis, the rendered pixel is the evidence. The whole arc stayed byte-identical and SIM-neutral on purpose, so none of it risked the chemistry that months of calibration earned; morphology is a layer you can rebuild without disturbing the foundation. That separation — visible form on top of stable science — is what made it safe to be wrong and cheap to correct.

— the builder

---

## Closing thoughts before compact (2026-06-23, later)

Three render-only fixes shipped this session, all byte-identical (SIM 214 unchanged), all one thread —
the specimen-debt pass that began as "verify Phases 1 + 3" became "find the bug *underneath* them":

- `74611ab` — tourmaline ditrigonal cross-section (+ calcite stepping-mechanism correction)
- `af81720` — hemimorphite fan/sheaf (orthorhombic, was hexagonal)
- `f0c99eb` — **system-aware prism cross-section** (the generalization) + `tools/morph-fidelity-audit.mjs`

**The shape of the lesson.** Tourmaline and hemimorphite each *looked* like a one-off "this mineral is
drawn wrong." They weren't. The renderer's default habit token is `prism`, and the prism primitive is a
HEXAGON — so the real bug was *every non-hexagonal prismatic mineral at once*; the two I happened to check
were the visible tip. The audit tool is the thing to reach for first next time: a deterministic habit→token
vs. crystal-system join, it found 72. **When you fix a "this one renders wrong" case, ask whether the
mechanism that produced it is shared.** It usually is.

**The honest scar.** I tried to verify the 72 crystal systems with a Workflow and it ran away to the
1000-agent cap — ~14.9M tokens, tripped the session usage limit (reset 11:10pm ET). Cause: `args` reached
the script as a STRING, my `chunk()` sliced the ~10KB JSON into ~950 fragments, one agent each. Two lessons:
*mechanical* — guard any fan-out against a non-array input; never trust args to arrive parsed. *Judgmental
(the real one)* — **I fanned out to verify data that was already verified.** `structural.json` carries
citation-backed crystal systems; the whole fix was a deterministic data join. The workflow wasn't just
buggy, it was the wrong tool. Reach for agents when the answer needs judgment or the web — not when a file
already holds it.

**Deferred (none blocking):** `spike` needles still render hexagonal (cross-section invisible at needle
scale — `_makeSystemPrism` already has the shapes if you ever want them routed through); some audit-flagged
minerals are non-euhedral aggregates (earthy/scaly/crust) that shouldn't be a single prism *at all* — a
HABIT problem, not a cross-section one, and a harder separate fix; the cubic prism-token entries are
habit-string artifacts (grow engines set cube/octahedral at runtime — false positives). The original arc's
debts still stand: **Phase 2 substrate occlusion** (the re-promoted next phase) and real-specimen
verification of the calcite macrostep + the hemimorphic terminations.

**State:** HEAD `f0c99eb`, origin synced, Pages building at it; SIM 214 unchanged across all three fixes;
cold-ci green (2033 tests). `tools/morph-fidelity-audit.mjs` is the reusable instrument (`--json`,
`--systemmap`). Stray `_minlist.json` at repo root is runaway-agent debris (not mine, left untracked —
safe to delete).

Three real fidelity wins on stable infrastructure, each checked against a real rock or a real screenshot
before shipping — and one real misstep, which was far cheaper to make on a render-only arc than anywhere
near the chemistry. That's the same separation the note above is about, earning its keep again.

— the builder
