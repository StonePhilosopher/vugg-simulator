# BACKLOG — Vugg Simulator

Living list of open work items, captured from session conversations so context survives compaction. Each item has enough detail that someone picking it up cold can act without re-discovering the rationale.

Order is rough priority — top of each section is most-actionable, but explicit user direction reorders freely.

---

## 🐞 Bugs / pending diagnostic

### 3D viewer bug list
**Status:** awaiting user's enumeration.
**Context:** during the 3D viewer work earlier in the project, several specific bugs were noted but never logged with reproduction steps. User has the list; this todo is the placeholder until they share it.

---

## 🎛️ Creative mode — controls expansion

The Creative mode setup panel currently exposes ~30 FluidChemistry sliders + temperature + pressure + new wall reactivity. These items extend the player's control over the rest of the wall + fluid surface.

### Wall porosity slider
**Status:** designed, ready to implement.
**Why:** porosity is geologically distinct from reactivity. Three coupled effects, each with its own engine hook:

| Effect | What it does | Hook |
|---|---|---|
| **(1) Surface area** | Multiplies wall dissolution rate (effective_rate × reactivity × porosity_multiplier) | `VugWall.dissolve()` rate calc |
| **(2) Matrix leaching** | Per-step ion influx from surrounding rock's wall_*_ppm reservoir into vug fluid, gated by porosity. Even at neutral pH, K/Ca/Si/Al migrate in. The Deccan zeolite mechanism — K/Ca/Si/Al arrive via porosity, not direct wall contact. | New per-step `leach_from_matrix()` method on `VugWall`, called alongside `dissolve()` |
| **(3) Residence time** | Controls fluid drainage / refresh. High porosity = fluid replaced often (dilute output). Low porosity = fluid sits, evaporates if exposed (concentrates → evaporites — the sabkha mechanic). | Modulates `flow_rate` and possibly an evaporation-concentration multiplier |

**Slider design sketch:**
- 0% (dense) — only vug-facing wall surface attacked. Default for Herkimer-style massive dolostone.
- 10% (typical limestone) — current implicit behavior baked into reactivity=1.0.
- 30% (chalky / oolitic) — ~3× effective surface area; faster dissolution + ion release.
- 50%+ (vuggy / cavernous) — fluid percolates through; might allow secondary nucleation IN wall pore space rather than only on the vug surface (interesting rendering question).

**Schema work needed for effect (2):** the `wall_*_ppm` fields only cover Fe/Mn/Mg today. Matrix leaching needs at minimum `wall_K_ppm`, `wall_Na_ppm`, `wall_Si_ppm`, `wall_Al_ppm` — and ideally per-composition profiles (limestone vs dolomite vs basalt vs granite vs phyllite each have different ion reservoirs). That naturally pushes toward the wall-composition-picker item below.

### Wall composition picker (Creative mode)
**Status:** queued behind reactivity slider.
**Why:** wall composition is currently hardcoded by FLUID_PRESET in `fortressBegin`. Player can't pick limestone vs dolomite vs silicate. With the reactivity slider live, exposing composition is the natural next wall control. Limestone / dolomite / silicate (with a sub-pick of pegmatite / granite / quartzite / phyllite / basalt) covers all the scenario use cases.

### Creative mode rework — full element-slider exposure
**Status:** flagged but not designed in detail.
**Why:** Creative mode setup exposes ~30 FluidChemistry elements as sliders, but some preset starter fluids contain trace chemistry the user can't see or modify until they're already in-game. Per the user's framing — starter fluids represent "what's in the rocks", so every element they define should be exposed at setup time. Bigger surgery than a single-slider add; needs a full UX pass on the setup panel layout.

---

## 🧪 Schema additions — new FluidChemistry fields + mineral engines

Each item below has the locality chemistry **pre-researched** during the chemistry audit. The work is engineering (add field + mineral engines + minerals.json entry + nucleation block) — no more literature pass needed.

### Cd field + grow_greenockite
**Status:** chemistry pre-researched, engine pending.
**Pre-researched value:** `Cd=2` for Tri-State (sphalerite carries Cd substituting for Zn — typically 1000-5000 ppm Cd in mineral, raw fluid Cd ~1-10 ppm). Greenockite (CdS) is the diagnostic yellow coating on Tri-State sphalerite.
**Source:** Schwartz 2000 (Econ. Geol. 95) on Cd in MVT sphalerite + Tri-State greenockite occurrence in Hagni 1976.
**Engineering needed:**
- `Cd: float = 0.0` field in FluidChemistry (Python @dataclass + JS class)
- `grow_greenockite` (CdS) implementation following the pattern of grow_native_gold (commit `e13d7f1`) — see that as template
- `supersaturation_greenockite` method
- Nucleation block in `check_nucleation` (substrate preference: on sphalerite)
- `MINERAL_GROW_FUNCS` dispatch entry
- `minerals.json` entry — yellow class_color, formula CdS, T tolerance similar to sphalerite
- Optionally: Cd-in-sphalerite trace tracking in `grow_sphalerite` (TitaniQ-analog)
- **Au audit pattern reminder:** when Cd lands, run the gap-check across all 10 anchored localities. Most will be `intentionally_zero`; Tsumeb / supergene scenarios may carry trace Cd (greenockite is reported there too).

**Minerals unlocked:** greenockite, hawleyite, Cd-trace in sphalerite.

### Au-Te coupling — grow_calaverite + grow_sylvanite (Bingham telluride cap)
**Status:** all upstream chemistry already in place; pure engine work.
**Why:** Bingham `scenario_porphyry` already has Au=2 + Te=2 + Ag=8 in init. Currently all the Au precipitates as native_gold; adding Au-Te competition would partition some Au into telluride growth instead. Bingham upper-level epithermal cap hosts these tellurides (Landtwing 2010 + Cook et al. 2009 Au-Ag-Te systematics).
**Engineering needed:**
- `supersaturation_calaverite` (AuTe2) and `supersaturation_sylvanite` ((Au,Ag)Te2) methods
- `grow_calaverite` and `grow_sylvanite` functions
- Nucleation blocks
- `MINERAL_GROW_FUNCS` dispatch entries
- `minerals.json` entries
- Update `grow_native_gold` to compete against tellurides when both Au and Te are present (currently Au always goes native)

**Minerals unlocked:** calaverite, sylvanite, krennerite (potentially).

### Auriferous-chalcocite trace tracking (Bisbee mode)
**Status:** schema mostly in place; modeling work needed.
**Why:** Bisbee's supergene Au literature (Graeme et al. 2019) emphasizes that much of the Au is hosted as a trace within chalcocite rather than as discrete native_gold crystals. Currently all Au in Bisbee precipitates as discrete native_gold instead of partitioning into chalcocite.
**Engineering needed:**
- Add Au-trace tracker on `grow_chalcocite` (parallel to how Mn/Fe traces are tracked in calcite — see `grow_calcite` for pattern)
- Add `trace_Au` field to GrowthZone if not already present
- Update narration / inventory output to surface auriferous-chalcocite vs pure-chalcocite distinction

**Effect:** Bisbee output would record both native gold pockets AND ppm-Au-bearing chalcocite zones — the latter being the more economically significant mode in real Bisbee.

### Ag/Ge mineral engines (Tsumeb downstream)
**Status:** Tsumeb fluid chemistry already populates Ag=8, Ge=5, Sb=5 (commit `684f035`). Mineral engines for the Ag-sulfosalts and Ge-sulfides don't exist yet — those are pure engine work.
**Engineering needed:**
- `grow_proustite` (Ag3AsS3) — ruby silver, As-end
- `grow_pyrargyrite` (Ag3SbS3) — ruby silver, Sb-end
- `grow_native_silver` (Ag) — analog of grow_native_gold
- `grow_chlorargyrite` (AgCl) — supergene Ag halide
- `grow_germanite` (Cu26Fe4Ge4S32) — Tsumeb type-locality Ge mineral
- `grow_renierite` ((Cu,Zn)11(Ge,As)2Fe4S16) — companion Ge mineral
- (Optionally) `grow_briartite` (Cu2(Fe,Zn)GeS4)
- Each needs supersaturation, growth, nucleation, dispatch, minerals.json entry
- **Au audit pattern reminder:** when each lands, run gap-check across all 10 anchored localities for Ag specifically (Bingham Ag=8 and Bisbee Ag=40 already populate; some MVT scenarios may need Ag promoted from "documented but no engine" to active).

---

## 📋 Audit-trail patterns established (reference, not work)

These aren't todos — they're conventions to follow when doing the work above:

- **`pending_schema_additions`** in `data/locality_chemistry.json` — for "value pre-researched, schema/engine not yet there". Includes value, unit, rationale, source, blockers, minerals_unlocked. See bingham_canyon entry as canonical example before Au shipped.
- **`intentionally_zero`** in `data/locality_chemistry.json` — for "we checked and zero is the right answer for this locality". Established in commit `e2048e9` for the Au audit. When any new schema field lands, run the per-locality gap-check and document zero values explicitly so future audits don't re-flag them.
- **Three-place note pattern** — when a new schema element is researched but engine pending, leave cross-referenced notes in: vugg.py scenario comment + web/index.html mirror comment + data/locality_chemistry.json `pending_schema_additions` block. See bingham_canyon Au notes (pre-commit `e13d7f1`) for the reference shape.
- **Per-commit docs/ mirror** — every web/index.html change must be mirrored to docs/index.html in the same commit. ARCHITECTURE.md requirement; user views the live game via GitHub Pages docs/.
- **Push to Syntaxswine origin** — the user's fork is the push target; StonePhilosopher canonical is read-only here, boss promotes from Syntaxswine.

---

## 🎯 SIM_VERSION
Currently **7** (bumped in commit `97cb088` for Round 7 Commit 3 — corundum family + marble_contact_metamorphism scenario added; previous commit `a2f8f94` was the 5→6 bump for Round 7 Commit 2, beryl family split).

Bump to 8 when:
- Cd field shipped (would shift Tri-State seed-42 output)
- Wall porosity slider shipped (changes existing scenario dissolution behavior at default settings)
- Au-Te coupling lands (would partition Bingham Au into telluride growth)
- Halide-expansion round (atacamite, halite, chlorargyrite, etc.)

Defer the version bump decision to whoever ships those changes.

History:
- v1: pre-audit defaults
- v2: scenario-chemistry audit (Apr 2026; commit `77d999a`)
- v3: arsenate/molybdate supergene cascade engines — arsenopyrite + scorodite + ferrimolybdite (Apr 2026; commits `1c9cd29` → `0cd182f`)
- v4: Round 5 sulfate expansion — barite + celestine + jarosite + alunite + brochantite + antlerite + anhydrite (Apr 2026; commits `ccb8ac6` → `a044e81`). Engine count 55 → 62. Coorong sabkha now produces the textbook gypsum + anhydrite + celestine + dolomite + aragonite assemblage. Brings the sulfate class from 1 mineral (selenite) to 8.
- v5: Round 5 gap-fill follow-ups (Apr 2026; commits `c8056ef` + `8b9c831`). Tri-State + Sweetwater O2 0.0→0.25 (mildly reducing MVT brine — barite + celestine activate); barite + celestine supersat O2 saturation retuned to /0.4 (saturates at SO₄/H₂S boundary). Tsumeb early ev_supergene_acidification 4-pulse event + Al 3→25 + jarosite/alunite per-check 0.45 — unlocks scorodite + jarosite + alunite + brochantite at Tsumeb. Engine count unchanged (62); chemistry tweaks only.
- v6: Round 7 Commit 2 — beryl family split (Apr 2026; commit `a2f8f94`). Split the inline-variety detector in `grow_beryl` into 5 first-class species: `beryl` (narrowed to goshenite/generic colorless), `emerald`, `aquamarine`, `morganite`, `heliodor`. Priority chain emerald > morganite > heliodor > aquamarine > goshenite baked into supersaturation gates via exclusion preconditions. `check_nucleation` uses one-per-step dispatch to prevent shared-Be-pool over-nucleation. Seed-42 `gem_pegmatite` now nucleates 4 emerald + 4 aquamarine + 3 morganite (goshenite naturally suppressed by chromophore priority). Engine count 62 → 66.
- v7: Round 7 Commits 3+4 — corundum family + marble_contact_metamorphism scenario (Apr 2026; commit `97cb088`). First **UPPER-BOUND gate** in the sim: SiO2 < 50 is the defining corundum constraint (with any more silica, Al + SiO2 drives to feldspar/kyanite/sillimanite). Shared `_corundum_base_sigma()` helper. Three new species: `corundum` (colorless/generic), `ruby` (Cr ≥ 2), `sapphire` (Fe ≥ 5 with in-engine color dispatch). New scenario anchored to Mogok Stone Tract (Al=50, SiO2=20, Ca=800, Cr=3, Fe=8, Ti=1, pH=8). Violet-sapphire (V-only path) deferred — would break necessity-of-Fe gate test. Engine count 66 → 69. Total baseline scenarios 12 → 13.

---

## 🧪 Scenario-tune follow-ups (deferred from v3 mineral expansion)

### ~~Tsumeb pH gap (now affects scorodite + jarosite + alunite)~~ ✅ **RESOLVED (v5, commit `8b9c831`)**
**Resolution:** Added `ev_supergene_acidification` event scheduled 4× (steps 5/8/12/16) in `scenario_supergene_oxidation` — drops pH to 4.0 + adds H₂SO₄ each pulse, holding the acid window against the limestone wall's carbonate buffering for ~15 steps before `ev_meteoric_flush` (step 20) neutralizes. Plus Tsumeb Al bumped 3→25 to clear alunite's Al/25 cap. Plus jarosite + alunite per-check probabilities bumped 0.18/0.15→0.45 to reflect their fast acid-sulfate kinetics in brief windows.

Now active at Tsumeb: scorodite (95% seed hit rate), jarosite (95%), alunite (70%), brochantite (already worked, now coexists). Antlerite correctly stays absent — Tsumeb is brochantite-dominant per geology, not antlerite-dominant (antlerite is the Atacama/Chuquicamata signature). See `data/locality_chemistry.json:tsumeb.mineral_realizations_v3_expansion.scorodite` + `mineral_realizations_v4_sulfate_expansion.jarosite/alunite/antlerite` for full citation tags.

### ~~Tri-State + Sweetwater O2=0.0 gap~~ ✅ **RESOLVED (v5, commit `c8056ef`)**
**Resolution:** Bumped Tri-State + Sweetwater O2 from default 0.0 to 0.25 — mildly reducing brine matching real MVT chemistry at the SO₄/H₂S boundary. Plus barite + celestine supersaturation O2 factor retuned from O2/1.0 to O2/0.4 (saturates at the SO₄/H₂S boundary, geochemically correct).

Verified seed-42:
- Tri-State (was 0/0): 6 active barite (max 32 µm), 10 celestine (max 111 µm)
- Sweetwater (was 0/0): 14 active barite (max 63 µm — Viburnum is the high-Ba MVT endmember per Stoffell 2008), 8 celestine (max 56 µm)

Coorong sabkha behavior unchanged (O2=1.5 was already saturated; engine retune is a no-op above O2=0.6).

### Bingham/Bisbee scorodite + ferrimolybdite end-to-end verification
**Status:** engines are wired and chemistry should produce both, but no full-scenario seed-42 run was executed during the v3 expansion (porphyry/Bisbee runtimes are slow). When time permits, run seed-42 porphyry (120 steps) and bisbee (340 steps) and confirm the realization predictions in `mineral_realizations_v3_expansion`:
- Bingham: arsenopyrite forms early, oxidizes after step 85, scorodite + ferrimolybdite nucleate post-oxidation
- Bisbee: arsenopyrite forms strongly (Fe=200 → enormous σ), oxidizes after step 65 ev_uplift_weathering, scorodite nucleates from arsenopyrite oxidation products

Failures would point to either (a) chemistry tuning needed (rare given the audit) or (b) σ thresholds need adjustment.

---

## 🔗 Canonical-only research / proposals (not yet folded into engine work)

These exist on `canonical/main` (StonePhilosopher) but were not merged into Syntaxswine fork during the recent rounds. Read and either implement, fold into BACKLOG, or merge:

- `proposals/MINERALS-RESEARCH-UNIMPLEMENTED.md` (canonical commit `41183b9`) — **DONE**: arsenopyrite/scorodite/ferrimolybdite engines shipped (commits `1c9cd29`–`0cd182f`). Expanded paragenetic notes on molybdenite + wulfenite from this file are reference-only (no engine changes needed).
- `proposals/MINERALS-RESEARCH-SULFATES.md` (Syntaxswine commit `ca6d710`, written this session) — **DONE**: all 7 sulfates (barite, celestine, jarosite, alunite, brochantite, antlerite, anhydrite) shipped (commits `ccb8ac6`–`a044e81`). The research doc remains the canonical citation source for narrators.
- `proposals/Gibbs-Thompson dissolution cycling — crystal quality mechanic` (canonical commit `6577442`) — **NOT YET READ**. Crystal-quality mechanic proposal. Action: read the file and decide whether to implement, scope into BACKLOG, or punt.

---

## 🔮 Round 6 candidates (not yet pre-researched)

Now that Round 5 sulfates are done, the next natural class expansion is **halides**. Candidates with chemistry already in FluidChemistry (Cl, Cu, Ag, Na, K all populated):

- **halite** (NaCl) — Coorong sabkha activation; salinity field already drives it
- **atacamite** (Cu₂Cl(OH)₃) — Cl-rich Cu oxide; Bisbee Cl=200 + Atacama; competes with brochantite (already flagged in `grow_brochantite`'s Cl>100 trace note)
- **chlorargyrite** (AgCl) — Tsumeb supergene Ag halide; activates the Ag pool that Tsumeb already populates
- **boleite** (KPb₂₆Ag₉Cu₂₄Cl₆₂(OH)₄₈ — extremely Cl-rich, deep blue; rare display target)

Plus possible follow-on Cu sulfates (chalcanthite — CuSO₄·5H₂O, the extreme-acid Cu sulfate that competes with antlerite below pH 1) and natrojarosite (Na variant of jarosite, common in salty AMD).

A research doc following the `MINERALS-RESEARCH-SULFATES.md` shape would be the next logical artifact.

---

## 💎 Round 7 — Gemstones ✅ SHIPPED (Apr 2026)

**Completed: beryl family + corundum family.** Per `proposals/MINERALS-PROPOSAL-GEMSTONES.md` + `proposals/MINERALS-RESEARCH-GEMSTONES.md`, 7 new first-class species (mineral count 62 → 69) landed across 4 commits:

- `a5fbaf6` — Commit 1: research compendium
- `a2f8f94` — Commit 2: beryl family split (SIM_VERSION 5→6)
- `97cb088` — Commits 3+4: corundum family + marble_contact_metamorphism scenario (SIM_VERSION 6→7)
- (this commit) — Commit 5: locality chemistry realizations + BACKLOG cleanup

Notable outcomes:
- **First upper-bound gate** in the sim: corundum family's SiO₂ < 50 constraint. This opens the door for the Al₂SiO₅ polymorph family (kyanite/andalusite/sillimanite) and other Si-undersaturated chemistry in future rounds.
- **Scaffolding tool proved out**: `tools/new-mineral.py` reliably inserted 7 JSON entries, generated paste-ready code stubs, and the auto-added entries passed all 48 parameterized per-mineral tests after engine code landed. ~15 minutes per species (down from ~45 min pre-tool).
- **Violet sapphire deferred**: V-only Tanzania variety would break the Fe-necessity gate test. Noted in Round 8+ candidates.
- **Mogok marble-contact scenario**: seed-42 nucleates 1 ruby + 1 calcite + 2 aragonite. Ruby wins the Cr=3 priority race; sapphire needs Cr depletion + Fe>=5 before it fires, which the 180-step window doesn't always afford. Further scenario tuning may be needed if we want seed-42 sapphire — consider ev_chromium_depletion event scheduled mid-run.

Deferred to a future round:
- Violet sapphire (V-only Tanzania) — separate `violet_sapphire` species with V-gate
- Color-change sapphire (Umba Valley, Cr+V+Fe) — could be a sub-variety of violet
- Alexandrite (BeAl₂O₄ + Cr) — chrysoberyl family; needs Be+Al+Cr with no Si (related to corundum SiO₂-undersaturation)
- Garnet supergroup (pyrope, almandine, spessartine, grossular, andradite, uvarovite) — clustered with D3
- Tanzanite (Ca₂Al₃Si₃O₁₂(OH) + V) — zoisite/epidote family
- Jade (jadeite = NaAlSi₂O₆ high-P + nephrite = Ca₂Mg₅Si₈O₂₂(OH)₂) — pressure-gated, clustered with D3
- Chrysoberyl (BeAl₂O₄) — related to corundum SiO₂-undersaturation; could be its own small cluster

---

## 💎💎 Round ~end-of-list (positions ~185-200) — Diamond + mantle/high-P plumbing cluster

**RESERVED SLOTS**: diamond is the last mineral on the target list of 200, and ~15-20 slots adjacent to it are reserved for minerals that share the same plumbing investment (the "D3 option" from `proposals/MINERALS-PROPOSAL-GEMSTONES.md`). Rationale: the infrastructure to model diamond (carbon field in FluidChemistry + pressure-as-chemistry-driver + mantle T+P regime) is heavy; single-use for diamond would be wasteful. Clustering lets the plumbing pay for itself ~15-20 times.

**Reserved cluster (tentative order, all share the D3 plumbing):**

### Class 1 — carbon-field additions (C added to FluidChemistry)
- **graphite** (C) — metamorphic schists; a legitimate vug mineral (unlike diamond)
- **moissanite** (SiC) — rare, mostly meteoritic; scientific novelty
- **anthraxolite** (solid hydrocarbon) — already partially implemented via Herkimer narrative; could be a real inclusion mineral

### Class 2 — pressure-gated polymorphs (making `VugConditions.pressure` a real supersaturation driver instead of cosmetic)
- **kyanite** (Al₂SiO₅, high-P) — blue-blade gem
- **andalusite** (Al₂SiO₅, low-P) — chiastolite cross-pattern gem
- **sillimanite** (Al₂SiO₅, high-T) — completes the classic Al₂SiO₅ phase-diagram triangle
- **coesite** (SiO₂ high-P polymorph) — meteor-crater + UHP subduction indicator
- **stishovite** (SiO₂ extreme-P polymorph) — shock metamorphism
- **jadeite** (NaAlSi₂O₆) — jade; low-T high-P subduction
- **omphacite** (eclogite pyroxene) — deep subduction
- **lawsonite** (CaAl₂Si₂O₇(OH)₂·H₂O) — blueschist facies indicator
- **glaucophane** (Na₂(Mg,Fe)₃Al₂Si₈O₂₂(OH)₂) — the amphibole that names blueschist

### Class 3 — mantle / kimberlite xenolith minerals (needs mantle T+P + the above plumbing)
- **olivine / peridot** (Mg₂SiO₄) — the most abundant mineral on Earth by volume; its absence is the biggest gap in the current sim; gem variety is peridot
- **enstatite** (MgSiO₃) — mantle orthopyroxene
- **diopside / chrome diopside** (CaMgSi₂O₆) — mantle clinopyroxene; bright-green gem
- **pyrope garnet** (Mg₃Al₂Si₃O₁₂) — blood-red gem; Bohemian garnet
- **spinel** (MgAl₂O₄) — gem (Black Prince's "Ruby" in the Crown Jewels is actually a spinel); uses corundum's SiO₂-undersaturated gate
- **phlogopite** (KMg₃AlSi₃O₁₀(F,OH)₂) — bronze-brown mica xenocryst
- **ilmenite** (FeTiO₃) — kimberlite prospecting indicator
- **chromite** (FeCr₂O₄) — source of the Cr that gives emerald its color; black octahedra
- **perovskite** (CaTiO₃) — mantle; eponymous to the perovskite structure family
- **diamond** (C) — the capstone

### New scenarios enabled by Class 2 + 3 plumbing
- `scenario_blueschist_subduction` — lawsonite, glaucophane, jadeite, omphacite
- `scenario_impact_crater` — coesite, stishovite, shocked quartz, meteoritic moissanite
- `scenario_kimberlite` — diamond + pyrope + chrome diopside + olivine + phlogopite + ilmenite + chromite xenocryst suite

### Interim placeholder plan
Until the D3 plumbing round arrives (late in the 200-mineral runway), diamond stays on hold. If the user wants a visible diamond before the plumbing round, Option D2 (xenocryst event in a lightweight kimberlite scenario) can ship as a bridge — 2-4 hours; `scenario_kimberlite` created as a shell, diamond teleports in as a pre-formed crystal, narrator explains the xenocryst origin honestly. When the D3 plumbing lands, diamond gets retrofitted to mantle-grown-in-sim and the shell scenario fills out with the rest of the cluster.
