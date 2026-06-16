# PROPOSALS LEDGER — delivered vs. promised

**Built:** 2026-06-15. **Method:** for every handoff/proposal forward-promise,
match it against what *actually shipped*. Two evidence sources, by era:

- **Post-fork (2026-05-24 →)** — git-diff: the promise vs. the subsequent
  commit subjects (the boss writes dense field-note commits naming exactly what
  shipped + the SIM version, so the log is ground truth). SHAs cited.
- **Pre-fork proposals (before 2026-05-24)** — this repo is a fork
  (`d4a6205 initial: fork from vugg-simulator @ 7157fea`); their implementing
  commits aren't in this log, so verified by targeted code-grep of
  `js/`+`data/`+`tests-js/` + the `js/15-version.ts` v1–v195 ledger.

**Why this exists:** handoffs accrue forward-promises with no closing ledger, so
"open" rots into "done-but-still-labeled-open" (the clip bug carried a false
`open` for 5 weeks) and "proposed" decays into "forgotten" (Gibbs-Thompson). This
is the one-time reconciliation. Keep it current when a handoff lands.

**Confidence legend:** ✅ delivered (SHA/code confirmed) · ◐ partial (named gap) ·
🅾 orphan (designed, no code, untracked) · ⏳ tracked-pending (remembered, sequenced) ·
🚫 rejected/moot (deliberate) · ⚠ absence-claim, confirm before building.

> **A caution this very audit earned:** automated readers OVER-REPORT orphans.
> Across five readers, FIVE confident "zero code" calls were false — botryoidal
> growth (288 hits), `late_stage_propensity` (test-backed), host-rock
> architecture (v60), volatile gases (piecemeal), and cavity-interior-voxels
> (`js/24-geometry-voxel-grid.ts`, 223 hits — shipped via the multidim merge the
> reader didn't know about). A git-diff reader called T-reconciliation
> "still-open" — it shipped at SIM 181/184. **A subagent's "X was never built" is
> a hypothesis; confirm with a grep/SHA before treating it as debt.**
> ([[feedback_verify_before_asserting_state]]) The one reader that was accurate
> end-to-end was the MINERAL sweep — because its ground truth (a name is/ isn't a
> `minerals.json` key) is binary and checkable, not vocabulary-fuzzy.

---

## §A — THE REAL DEBT (consolidated, actionable)

| # | Item | State | Note / evidence |
|---|------|-------|-----------------|
| 1 | **Gibbs-Thompson crystal-quality mechanic** (`PROPOSAL-GIBBS-THOMPSON`) | 🅾 orphan | 5-phase design (quality field improves w/ dissolution, gates habit). **0 code hits** on every pattern; not in BACKLOG. The one truly-lost design. Pre-fork. |
| 2 | **Strip-contract campaign — 4 scenarios** | ◐ partial | Promised gem_pegmatite/naica/searles/sabkha/supergene/bisbee/marble; commits `b8d541c`+`d5fe7f2` pinned **supergene/bisbee/naica** only → **gem_pegmatite, searles, sabkha, marble dropped**. |
| 3 | **Per-vertex chip-selector UI** | ◐ partial | VERIFIED: data accessors (`fluidAtMeshVertex`, resolvers) present; player-facing vertex picker absent. Needs per-vertex spatial-chemistry depth to be meaningful. **[UI]** |
| 4 | **Strip filter-rule engine + record mode UI** | ◐ partial | VERIFIED absent (2 incidental hits only): recording infra shipped (v149+), filter-rule backend + UI never built. **[UI]** |
| 5 | **Sonifier "more musical"** (looping, reverb/space, melody-over-drone, moving harmony) | ◐ open thread | Rhythm + bells shipped; the four enrichments are an explicitly-LIVE design thread (boss: "keep discussing"). [[project_vugg_sonifier]] |
| 6 | **Thermo ΔH tail** — dolomite ΔH (engine-promoted), siderite ΔH (verify Bénézeth 2009), witherite ΔGf drift | ⏳ open | Flagged in-data, NOT urgent. [[project_vugg_thermo_verification]] |
| 7 | **Hot-band Ksp(T) > 90 °C promotion** | ⏳ tracked | Needs SUPCRT/llnl hi-T coefficients + calcite/aragonite gate recalibration + aragonite metastability hardening. |
| 8 | **Quartz morphology arc** (hiatus census → fenster → sceptres) | ⏳ tracked | `RESEARCH-quartz-morphology-2026-06-12.md` written; implementation queued, never started. |
| 9 | **Weathering-epilogue mechanic** (spatially-partial vadose stage) | ⏳ tracked | First client = wittichen erythrite post-exhumation; named 3×, no code. |
| 10 | **Stale `expects_species` — 3 to diagnose** | ◐ partial ⚠ | bisbee azurite (gate not cleared despite event firing), searles mirabilite, schneeberg torbernite (0/10). (jeffrey magnetite + roughten_gill bayldonite are deliberate, not debt.) Confirm each. |
| 11 | **Redox-gate omission sweep — follow-up fixes** | ⏳ HELD, but FIXABLE | sphalerite/wurtzite ZnS gate. **2026-06-16: keystone did NOT unblock it** (gating still drops mottramite 98→49). Discriminator RUN: graduated competition RULED OUT (toggle ON/OFF → identical drop); fluid/fill identical → the blocker is the **shared growth-jitter RNG**. Same problem the keystone solved, one layer down → fix = extend keystone to per-(crystal,step) GROWTH streams (mirror `_runNuc`), self-testing via this A/B. Tractable arc, not accept-and-tune. [[project_vugg_redox_census]] |
| 12 | **Per-mineral derived nucleation seeds (THE KEYSTONE)** | ✅ SHIPPED v198 (`68edacd`) | Isolates each mineral's nucleation RNG to a per-(mineral,step) derived stream; isolation property proven (nuc-seed-isolation.test.ts). Valuable infra, BUT it did NOT unblock #11 (the gate's blocker was misdiagnosed as nucleation-RNG — it's downstream growth/competition). |
| 13 | **Mineral catalog orphans (5)** — franklinite, staurolite, titanite (=sphene), stilbite, heulandite | 🅾 never-added | Round-5/6 metamorphic + zeolite cohort. VERIFIED absent. See §G. ~~epidote~~ **✅ SHIPPED v196** (`a3c1cb5`) + its anchor scenario tormiq_alpine_cleft **v197** (`5043d57`) 2026-06-15 — was the build-candidate this list flagged; the others remain. |
| 14 | **deccan_zeolite Stage-II narrative gap** | ◐ content | step-70 event "Zeolite Stage II" describes *"Stilbite + heulandite + calcite blades"* — but those minerals don't exist → narration promises blades that can't grow. De-confab candidate (cf. mvt silver). |
| 15 | **Edge-textures: 11 of 17 unbuilt** | ◐ partial | smooth/dogtooth/cube/botryoidal/saddle_rhomb shipped; prismatic_hex, octahedral, bladed, tabular, spherulitic, dendritic, fibrous, drusy, flos_ferri, cyclic_twin_hex, pyritohedron_edge fall back to a fuzzy substring match. |
| 16 | **Broth-control fortress UI verbs** | ◐ partial | Advance/Warm/Cool/Shock shipped; Seep/Flood/Drain + standalone Replenish buttons not built. **[UI]** |
| 17 | **Specimen-object Phases B–E** | ◐ partial ⚠ | Phase A (derive-only) shipped; narrator/inventory/library/record-player UI status unaudited. **[UI]** |
| 18 | **Chemical-proximity nucleation bonus** | 🅾 orphan ⚠ | shared-cation competition modifier (distinct from the shipped epitaxy σ-discount). Research-first; no engine hooks. |
| 19 | **Evaporite meniscus-concentration gate** | ◐ partial | `fluid_surface_ring` + per-ring chemistry shipped; the meniscus-zone evaporite bonus is not gated. |
| 20 | **Crystal-cipher Phase 0** | ◐ partial | recipe-URL infra unshipped (conceptual); strip dataset + recorder exist (v149+). |

**The genuinely-forgotten count is small:** exactly one clean orphan (#1) plus one
half-dropped batch (#2). Everything else is either consciously sequenced (⏳) or a
named-partial (◐). The user's instinct ("projects that never got done") is correct
but the debt is shallow — the cathedral is honest.

---

## §B — Pre-fork proposals (code-grep verified)

| Proposal | State | Evidence |
|----------|-------|----------|
| PROPOSAL-GIBBS-THOMPSON (quality mechanic) | 🅾 orphan | 0 hits: `crystal.quality` / `quality_score` / dissolution-quality |
| PROPOSAL-BOTRYOIDAL-GROWTH | ✅ shipped | 288 hits across 41 files (renderers/engines/narrators) — as habit/texture |
| PROPOSAL-HOST-ROCK | ◐ partial | `architecture` (5 archetypes) shipped v60; per-rock *dissolution chemistry* (buffering/permeability/soil-CO₂) appears unshipped |
| PROPOSAL-VOLATILE-GASES | ◐ partial | Shipped piecemeal (CO₂-events `70l`, sulphur-bank `70m`, H₂S/SO₂ in engines); no unified `volatiles`/`gas_pressure` struct |
| PROPOSAL-CAVITY-MESH Phases 5–7 (tessellation, epitaxy) | ◐ partial | Tessellation + epitaxy code present (`23-geometry-wall-mesh`, `26-mineral-paragenesis`); completeness of icosphere/per-mineral-epitaxy untraced |
| PROPOSAL-MODULAR-REFACTOR (Python phases) | 🚫 moot | Python tree deleted 2026-05-07; JS modularization done (`js/` tree) |
| RESEARCH-GROWTH-AT-HIGH-FILL Proposal C (`late_stage_propensity`) | ✅ shipped | In `data/minerals.json` 77× + dedicated `late-stage-propensity.test.ts` |

---

## §C — Late-May handoffs (git-diff): summary

7 handoffs (carbonate W1 / W2–W8 / complete, strip-as-instrument, supergene+thermal,
per-vertex, sonifier). **No silent orphans.** 5 fully delivered; the rest are:

- **Justified rejections (🚫, not debt):** Phase-1c mvt calcite dial-back, ultramafic
  cavity bump, sunnyside Stage VI manganocalcite — each REJECTED *after instrument
  verification* (mis-diagnosis or correct-by-design). `8a7e652`, `868f9a2`.
- **Partials (◐):** per-vertex chip-selector UI (#3), strip filter/record (#4),
  thermo tail (#6), sonifier musicality (#5).
- **Phase-2 deferrals (⏳):** Pitzer-HMW84 activity model, full PB82 K1/K2 (since
  shipped v192), siderite/rhodochrosite promotion, supergene carbonate promotions.
- **Resolved (🚫):** per-vertex placement global flip — deliberately kept opt-in
  (v167, scale-starved). Not debt.

## §D — June handoffs (git-diff): summary

10 handoffs (movements master, fluid-spots, two next-builder, three-metrics review,
gates+narrators, rebake-music, calcite-morphology, morphology-generalization,
pkt+fix-sweep, vsuite+ksp). **~90% delivered** with SHAs.

- **CORRECTED from the reader:** T-reconciliation = ✅ **DELIVERED** (`094b9c5`
  SIM 181 + `b4c722d` SIM 184 rollout close), not partial — the reader saw only
  the pre-shipment 06-01 handoff.
- **Partials/tracked (◐/⏳):** hot-band Ksp (#7), quartz arc (#8), weathering-epilogue
  (#9), 3 stale species (#10), redox-sweep fixes (#11), keystone (#12).
- **Big tracked items (not lost):** per-cell nucleation gating ("deep frontier"),
  the keystone, held redox gate, Tsumeb V rider, tutorials rework, Steam WP1–5
  product scope.

---

## §E — UI-relevant debt (bridge to the UI work)

Two ledger partials are unbuilt **UI surfaces**, not engine work — candidates if the
UI pass wants ready-scoped targets:

- **#3 Per-vertex chip-selector** — let the player click a cavity vertex and see its
  chemistry chip-trail. (Backend partly there; needs spatial-chem depth + the picker.)
- **#4 Strip filter / record mode** — filter-rule UI over the strip recorder.

(#3 #4 since VERIFIED in-code — see §A. The other UI candidates: #16 broth-control verbs, #17 specimen-object B–E.)

---

## §F — Standalone feature proposals (code-grep, ~30 docs)

Beyond the handoffs. ~30 `PROPOSAL-*` / `TASK-BRIEF-*` / `TUTORIAL-*` docs traced
against `js/15-version.ts` + code. **Most shipped.** Notable verdicts:

- ✅ **Shipped** (corrected from reader over-reports): cavity-interior-voxels
  (`js/24-geometry-voxel-grid.ts`), botryoidal-growth, host-rock architecture,
  3d-topo-vug / 3d-simulation (3D is the default view), wireframe-crystals,
  habit-bias, narrative-tempo (5/5), structure-as-fact-check (Tier 1),
  agent-friendly-interface (URL contract), the four TASK-BRIEFs, initiative-variable.
- 🅾 **Orphan:** gibbs-thompson crystal-quality (confirmed, §A #1); chemical-proximity
  (probable, §A #18).
- ◐ **Partial:** edge-textures 6/17 (§A #15), broth-control UI (§A #16),
  specimen-object B–E (§A #17), evaporite-water-levels meniscus (§A #19),
  crystal-cipher Phase 0 (§A #20), event-driven-precipitation (movements +
  fluid-spots cover the spirit; discrete mass-nucleation events not built),
  crystal-growth-visualization (terraces + strip view partly cover; internal
  growth-band render unbuilt).
- 🚫 **Moot/NA:** modular-refactor Python phases (Python deleted);
  dump-simulator (a separate project — wasteland-crystals).

## §G — Mineral catalog orphans (verified against `data/minerals.json` + engines)

**~96% of proposed minerals shipped** (≈159/165 distinct proposals). The unbuilt
tail is one cohort: **Round-5/6 metamorphic + zeolite silicates.**

**🅾 Never-added (verified — present only in comments / narrative, no spec/engine):**
- **franklinite** (Franklin/Sterling Hill Zn-Mn spinel) — named only in willemite's `dominant_forms`
- **staurolite** (cruciform fairy-cross twins) — wholly absent
- ~~**epidote**~~ **✅ SHIPPED v196** (`a3c1cb5`) + anchor scenario `tormiq_alpine_cleft` v197 (`5043d57`), 2026-06-15 — the Fe³⁺ alpine-cleft sorosilicate, the build-candidate this section flagged. (zoisite group still a future add-mineral candidate per the Jeffrey notes.)
- **titanite / sphene** — only a competition comment in `37-supersat-oxide`
- **stilbite**, **heulandite** (Deccan zeolite blades) — narrated, not modeled

**Also scenario-named-but-unbuilt** (associate/future mentions, lower priority):
scolecite, mesolite (deccan Stage II), zoisite, perovskite, titanian-clinohumite,
antigorite, lizardite (Jeffrey "future candidates"), zincite (willemite associate).

**Content gap (§A #14):** `deccan_zeolite` step-70 promises stilbite + heulandite
blades that can't form — either build the zeolites or true the event text.

**If the UI work wants a "build something real" detour:** the zeolite pair
(stilbite + heulandite) would *both* fill the deccan Stage-II gap AND retire the
narrative over-promise — the highest-leverage mineral add on this list.
