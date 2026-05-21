# PROPOSAL: Specimen as First-Class Object — host-chain grouping for inventory, library, record mode

**Author:** builder + boss (planning conversation 2026-05-21)
**Date:** 2026-05-21
**Status:** PLANNING DRAFT — open questions inline, awaiting boss answers before formalization for a fresh-context implementation pass
**Related:**
- `PROPOSAL-PARAGENESIS-OVERGROWTH-CRUSTIFICATION-PSEUDOMORPHS.md` (substrate affinity infrastructure already shipped)
- `PROPOSAL-EVENT-DRIVEN-PRECIPITATION.md` (event-driven precipitation; coin-stack rendering shares concerns)
- `js/15-version.ts` v117 (agent-friendly URL contract — referenced by Q4 below)
- `js/26-mineral-paragenesis.ts` (SUBSTRATE_NUCLEATION_DISCOUNT + EPITAXY_PAIRS + PSEUDOMORPH_ROUTES — the data this proposal builds on)

---

## TL;DR

The simulator's inventory currently shows crystals as independent items. A real Cave-in-Rock cabinet specimen is **calcite-on-fluorite-on-galena** — ONE specimen, three species in a substrate chain, picked up as one matrix piece. Inventory should match the cabinet reality.

This proposal introduces a **Specimen** as a derived first-class object built from host-chain connectivity in the existing `position: "on X #N"` substrate graph. Display specimens (not crystals) in inventory, library, narrator. Per-crystal access remains via drill-down for Record Player + zone history modal.

Phased implementation. Library + record mode are the rarely-touched fragility zones; they're scheduled last and hit deliberately. Boss has indicated all-phases testing at once is acceptable.

---

## Fundamental distinction: overgrowth vs replacement

(boss conceptual framing 2026-05-21)

Two fundamentally different physical processes are bundled into what we casually call "epitaxy" in the codebase. The Specimen object MUST distinguish them or the cabinet aesthetics break:

### Process 1: Epitaxial overgrowth (B on A, both survive)

**Reference specimen:** TN457 — pink barite crystals stacked on sphalerite. B grows ON TOP of A. A continues growing on faces that remain exposed to fluid. A only stops when:
- Fully encapsulated (all faces buried under B + later phases), OR
- Chemistry shifts against A's supersaturation gates

The host crystal IS a member of the resulting specimen. Both species in the inventory tally. The label is "B on A".

### Process 2: Coupled dissolution-precipitation / replacement (A consumed, B inherits)

**Reference specimen:** TN510 — chalcedony pseudomorph after crocidolite. **Putnis 2002 (Mineral Mag 66) / 2009 (RiMG 70) / 2021** establishes the mechanism: A dissolves molecule-by-molecule while B precipitates in its place via a nanometer-scale interfacial fluid film. A doesn't "stop growing" — **A ceases to exist.** B inherits A's external morphology.

The host crystal is NOT a member of the resulting specimen. Only B in the inventory tally. The label is "B, perimorph after A" (museum standard for shape-preserved replacement).

### What the science says controls the outcome

Per Putnis 2021 (Chem Geol 581:120396):
- **Fluid access** — porous overgrowth or partial coverage lets A continue (process 1); complete reaction front (no fluid bypass) drives replacement (process 2)
- **Saturation state** — A stays supersaturated → grows. Undersaturated → dissolves. The crossover is what flips overgrowth into replacement on the same host-guest pair
- **Competition for solutes (the "initiative variable" — boss framing 2026-05-21)** — both crystals compete for the same fluid pool. The faster sink wins. This is mineralogy's analog to RPG turn-order: which mineral acts first per timestep matters when the fluid is the shared resource. **The engine currently fires per-mineral-class iterators in fixed order; "initiative" is implicit class-iterator order, not σ-weighted competition.** See §Open architectural question (initiative).
- **Porosity generation** — replacement creates secondary porosity in B that sustains fluid access to the reaction front. Without porosity, the reaction stalls and the partial replacement freezes mid-event (the diagnostic Putnis 2009 "frozen" pseudomorph texture)

### Engine-side audit: does the code already distinguish?

After investigation 2026-05-21, the answer is **partially**:

- ✓ `Crystal.cdr_replaces_crystal_id` field flags the replacement case (Putnis 2002/2009 CDR pathway)
- ✓ `Crystal.perimorph_eligible` flag marks shape-preserving replacement candidates
- ✓ Host's grow engine independently runs its own σ-check each step — if host supersaturation stays cleared, host continues to grow (process 1 behavior). If host's σ drops below 1.0 AND its acid-dissolution branch fires (typical: pH drops or chemistry shifts), host dissolves (process 2 behavior). **The distinction IS emergent from per-engine chemistry**, which is the right level.
- ✓ `SUBSTRATE_NUCLEATION_DISCOUNT` covers BOTH process-1 (low-misfit epitaxy: sphalerite>pyrite at 0.5) AND process-2 (CDR routes: pyrite>goethite at 0.5). Same discount, different physical mechanism.
- ✗ But the engine does NOT explicitly tag whether a specific nucleation event is process-1 or process-2 at nucleation time. The distinction emerges from whether the host later dissolves. So if Specimen builder runs MID-sim, it can't know yet whether to include the host or treat it as a doomed substrate.

### What this means for Specimen detection

**Specimen builder MUST run at end-of-sim (not mid-step), OR with explicit knowledge of which hosts are CDR routes.** Two implementation choices:

- **(a) End-of-sim only**: Specimen is derived from final crystal state. Dissolved hosts are checked via `crystal.dissolved` flag; perimorph members via `crystal.cdr_replaces_crystal_id` + `crystal.perimorph_eligible`. Cleanest. Loses mid-sim specimen view.
- **(b) Per-step with CDR lookahead**: Specimen knows about `PSEUDOMORPH_ROUTES` table (already in `js/26-mineral-paragenesis.ts`) and pre-classifies expected replacements. Allows mid-sim specimen view but introduces lookahead complexity. Could mis-classify when host survives despite being CDR-eligible (rare).

Builder recommendation: **(a) end-of-sim only** for the Phase A MVP. Mid-sim specimen view is a UI nice-to-have not in MVP scope. Phase E renderer could add live specimen highlighting separately if needed.

This Q is added below as **Q7**.

### Specimen label adjustments per process

The label format adjusts for each case:

| Case | Example label | Notes |
|---|---|---|
| Process 1 overgrowth (host survives) | "Calcite on Fluorite on Galena · Cave-in-Rock IL · 3 species · 7 crystals · 25mm" | Standard chain |
| Process 2 replacement (host dissolved, shape preserved) | "Calcite, perimorph after Aragonite · 1 species · 1 crystal · 18mm" | Pseudomorph form; the dissolved host is not a species in the tally but IS named via "after X" |
| Process 2 replacement (host dissolved, shape NOT preserved) | "Calcite · vug wall · 1 species · ..." | Dissolved host fully dropped; just standalone calcite |
| Mixed (some overgrowth + some replacement in same chain) | "Calcite on Fluorite, perimorph after Galena" | Galena dissolved but its calcite-on-fluorite cap survived |

This subsumes Q2's "dissolved member crystals" question and refines it: the distinction is `perimorph_eligible`, not generic "dissolved." Q2 stands but with this added context.

---

## Open architectural question — initiative / competition for solutes

(surfaced by boss 2026-05-21 in the context of overgrowth-vs-replacement)

> **QUESTION FOR BOSS (Q7) — Initiative variable for competing crystals**
>
> In real mineralogy, when two crystals compete for the same fluid pool, the faster sink wins. The engine currently fires per-mineral-class iterators in fixed order (carbonate class iterator, then sulfide class iterator, etc., per `js/85d-simulator-step.ts`). This means a sphalerite that should "win" a Zn competition because it has higher current σ might lose to a wurtzite that grows first in the iterator.
>
> The RPG-initiative analog: each step is a "round." Each mineral with σ > 1.0 rolls initiative weighted by some function of σ. High-σ minerals go first and grab solute. Low-σ minerals get fluid AFTER depletion.
>
> Three possible designs:
> - **(a) Status quo**: leave iterator order as-is. The free-energy gift of MASS_BALANCE_ENABLED=true now means ordering matters more than it did before (the v118 follow-the-science fix made it so), but the deterministic order keeps tests reproducible.
> - **(b) σ-weighted initiative within a step**: within a step, sort all (mineral, sigma) pairs by sigma DESC; fire in that order. Highest-σ minerals consume fluid first. More mineralogically honest.
> - **(c) Rate-weighted initiative**: sort by rate (sigma × surface area × kinetic coefficient). Even more honest — small high-σ crystals lose to large moderate-σ ones (the surface-area-wins rule).
>
> Currently NOT decided. Adding it as an open question because the boss raised it but didn't direct an implementation. Specimen-MVP doesn't depend on this answer; can be settled in a separate arc.
>
> **[ pending boss answer — not blocking Specimen MVP ]**

Initiative changes have very high cascade risk (every scenario rng-baseline drifts) so this Q is flagged for a dedicated arc with per-scenario tune calibration, not piggybacked onto Specimen work.

---

## Motivation: the Cave-in-Rock problem

Today, a Cave-in-Rock simulation run produces approximately:

```
Inventory:
  galena         × 3
  fluorite       × 7
  calcite        × 12
  quartz         × 2  (background druzy)
```

…22 separate inventory items. But the real cabinet specimen the player would pick up is **one matrix piece** with:

- 1-3 galena cubes anchoring the bottom (the substrate)
- Fluorite cubes growing on the galena faces
- Calcite scalenohedra capping the fluorite

The collector sees ONE specimen of "Calcite on Fluorite on Galena, Cave-in-Rock IL." The inventory should too.

This is also load-bearing for narrative: the boss's "follow the science" rule keeps surfacing where the engine generates correct chemistry but the data model collapses it into a less-meaningful display. Recent examples in this same shape:
- v118 captured per-zone trace_Mn correctly but color function ignored it (closed by v121)
- v118 epitaxy IS firing for TN457 (barite-on-sphalerite, sigma-discount, wall_anchor inheritance), but the renderer paints overlapping ellipsoids instead of stacked tablets

Inventory-by-specimen is the same shape: the substrate graph is correct, but the inventory layer flattens it back to per-mineral counts.

---

## Settled decisions

(from boss in planning conversation 2026-05-21)

| # | Decision | Note |
|---|---|---|
| 1 | **Grouping rule = host-chain connected** | Walk the substrate graph from each crystal via `position: "on X #N"`. Connected components = specimens. Free-wall crystals are individual specimens for now. |
| 2 | **Display label format** | `"Calcite on Fluorite on Galena · Cave-in-Rock IL · 3 species · 7 crystals · 25mm"` — paragenetic order top-down (latest mineral first); locality from `scenario.anchor`; tally; size from union bounding box. Traditional cabinet-label style. |
| 3 | **Phased sequencing OK** | Boss tests all phases at once. Phase A (derive-only) can land standalone; B-E land as one batch for boss review. |
| 4 | **Clustering spectrum is future work** | Three distinct mechanisms identified (see §Future work — clustering). Specimen-MVP grouping uses host-chain only; cluster mechanic is its own arc. |
| 5 | **Per-crystal access stays** | Record Player and zone-history modal continue to work crystal-by-crystal; specimen drill-down reaches them. |

---

## Open questions — boss to answer

> **QUESTION FOR BOSS (Q1) — Adjacent matrix-piece grouping**
>
> Cave-in-Rock typically has 3-5 galena cubes on the same wall area, each anchoring its own calcite-on-fluorite chain. Strict host-chain (rule (a)) gives 5 specimens (one per galena root). A collector picking up the rock sees ONE matrix piece.
>
> Two options:
> - **Strict host-chain**: 5 specimens. Inventory shows the assemblage 5 times.
> - **Wall-adjacency union**: if two host-chain roots are within N adjacent wall cells, merge into one specimen with label "Calcite + Fluorite on Galena cluster".
>
> Builder recommendation: wall-adjacency union with tunable radius (default 3-5 cells). Tightens MVT druzy-style scenarios into manageable specimen counts and matches collector intuition.
>
> **[ pending boss answer ]**

> **QUESTION FOR BOSS (Q2) — Dissolved member crystals**
>
> When a host mineral dissolves out (galena dissolves, but its calcite cap + fluorite mid-layer survive), what does the specimen label become?
>
> Options:
> - **Keep original**: "Calcite on Fluorite on (dissolved Galena)" — acknowledges the void
> - **Drop dissolved**: "Calcite on Fluorite" — only surviving members shown
> - **Perimorph form**: "Calcite on Fluorite, perimorph after Galena" — museum standard for CDR-pseudomorph cases, gated on the existing `perimorph_eligible` flag from `js/27-geometry-crystal.ts:166`
>
> Builder recommendation: combine. If `perimorph_eligible` is true on the dissolved crystal → "X on Y, perimorph after Z" form. Otherwise drop dissolved members from the label. (Putnis 2002/2009 vocabulary; engine already tracks perimorph eligibility.)
>
> **[ pending boss answer ]**

> **QUESTION FOR BOSS (Q3) — Sibling-crystal labeling**
>
> When fluorite and calcite both nucleate directly on the wall (not on each other), and they're in the same specimen via wall-adjacency union (Q1 answer pending), the "on" form breaks. They're siblings, not chained.
>
> Options:
> - `"Fluorite + Calcite on limestone matrix"` — plus-sign reserves "on" for substrate-chain
> - `"Fluorite, Calcite on matrix"` — comma for siblings
> - `"Fluorite, Calcite assemblage · Cave-in-Rock"` — drop "on" entirely for sibling-only specimens
>
> Builder recommendation: `"Fluorite + Calcite on limestone"` — plus for siblings, "on" only for chain. Composes cleanly with chained labels (e.g. "Calcite on Fluorite + Barite on Galena" for mixed chain+sibling).
>
> **[ pending boss answer ]**

> **QUESTION FOR BOSS (Q4) — Future "3D model in library" implementation**
>
> Boss noted: "at some point when realistic crystals are added the ability to see the final crystal as a model in the library would be ideal." Three implementation paths affect the Phase D save schema design:
>
> - **(a) Static thumbnail**: canvas snapshot at end-of-sim, saved as PNG/data-URL in the library entry. Cheapest, no interactive viewing.
> - **(b) Stored mesh**: 3D mesh data persisted per specimen, rendered by a library-card mini-viewer (THREE.js). Heavy storage; interactive.
> - **(c) Re-runnable URL**: save the seed + scenario + steps + shape_seed; library card opens via headless re-run + render (v117 `?dump=specimen` headless contract). No mesh stored; specimen is re-derived on demand. **Composes with v117's shareable-URL pattern AND with sharing specimens out of the simulator.**
>
> Builder recommendation: **(c) re-runnable URL**. Tiny library entries, re-derivable specimens, free sharing. Static-thumbnail fallback could be added as a cache for visual recognition without paying the re-render cost on every library scroll.
>
> **[ pending boss answer ]**

> **QUESTION FOR BOSS (Q5) — Existing "snowball" habit (Sweetwater barite-on-pyrite)**
>
> Currently, Sweetwater-style barite-on-sulfide renders as ONE crystal with `habit: 'snowball'` → one sphere primitive. Reality is N small barite crystals on one sphalerite host.
>
> Options:
> - **Refactor**: split snowball into N small-barite-crystals + 1 sphalerite-host specimen. More honest mineralogy. Breaks existing rendering. New scenarios would need re-tuning.
> - **Keep as-is**: single composite crystal with `habit: 'snowball'`. Specimen-detection logic treats it as already-clustered. The cluster collapse to a single visual is what we'd want for chalcedony anyway.
>
> Builder recommendation: **keep as-is**. The snowball habit IS the "cluster collapsed to one visual primitive" pattern we want long-term for cryptocrystalline / botryoidal / true-druzy. Specimen detection treats `habit: 'snowball'` as an atomic unit and uses its position string for chain membership.
>
> **[ pending boss answer ]**

> **QUESTION FOR BOSS (Q6) — Inventory / library drill-down depth**
>
> When the user clicks INTO a specimen from inventory or library, what do they see?
>
> - **(a) Crystal list filtered**: current crystal-card UI, filtered to specimen members. Cheapest. No new layout.
> - **(b) Specimen sheet**: paragenetic diagram (galena → fluorite → calcite as a tree), assemblage tally, size, locality. Then links to each crystal's Record Groove.
> - **(c) Both, stacked**: specimen sheet on top, crystal list below.
>
> Builder recommendation: **(c) both stacked**. Specimen sheet on top satisfies "I see what this specimen IS" (cabinet-card view). Crystal list below preserves the existing per-crystal drill-into-zones path. Allows Phase D to ship the sheet section iteratively — start with sheet=title+tally+locality and grow it later.
>
> **[ pending boss answer ]**

---

## Architecture sketch

### Specimen object (derived, not stored on Crystal)

```ts
type Specimen = {
  id: number;                       // composite id (hash of sorted member crystal_ids)
  scenario: string;                 // current scenario name
  member_crystal_ids: number[];     // all crystals in this specimen
  root_crystal_ids: number[];       // host-chain roots (wall-anchored, or top-of-chain after dissolution)
  assemblage: string[];             // sorted unique surviving minerals
  paragenetic_order: string[];      // minerals in nucleation order (latest first per cabinet convention)
  display_name: string;             // composite label (see §Composite label)
  bounding_box_mm: { c_length: number; a_width: number };
  matrix: string;                   // host-rock substrate type (limestone / ultramafic / etc.)
  locality_anchor: string;          // pulled from scenario.anchor
  perimorph_members: number[];      // member crystal_ids that are CDR-pseudomorphs (per perimorph_eligible)
};
```

### Specimen-building algorithm (`_buildSpecimens()` on VugSimulator)

```
1. Build host graph:
   For each crystal C:
     parsePositionHost(C.position) → {hostMineral, hostId}
     If hostId resolves to a crystal: add edge C → hostCrystal in graph
     Else: C is a root (wall-anchored or orphaned)

2. Compute connected components on the host graph.

3. [Q1-conditional] Apply wall-adjacency union:
   For each pair of root crystals (R1, R2) in different components:
     If R1.wall_anchor and R2.wall_anchor are within N adjacent cells:
       Merge their components.

4. For each component:
   Build a Specimen object.
   - assemblage = sorted unique minerals of surviving members
   - paragenetic_order = minerals in nucleation_step order (most recent first)
   - bounding_box = union of member crystal bounding boxes
   - display_name = composeLabel(paragenetic_order, locality, count, size)
   - perimorph_members = members where perimorph_eligible AND host dissolved

5. Return Specimen[] in nucleation-order (oldest-root specimen first).
```

### Composite label composition (boss-confirmed format + Q3 pending)

```
PARAGENETIC_FORM = first(paragenetic_order, latest_first=true)
                   .join(" on ")     // chained substrate relationships

LABEL = `${PARAGENETIC_FORM} · ${locality} · ${species_count} species · ` +
        `${crystal_count} crystals · ${size_mm}mm`

Examples (Q3 still pending for sibling-vs-chained mix):
  "Calcite on Fluorite on Galena · Cave-in-Rock IL · 3 species · 7 crystals · 25mm"
  "Vesuvianite on Grossular · Jeffrey Mine, Quebec · 2 species · 4 crystals · 18mm"
  "Cyprine on Grossular + Diopside on Ultramafic · Jeffrey Mine, Quebec · 4 species · 12 crystals · 35mm"
                                       ^^^^ sibling-form (Q3 dependent)
  "Pectolite on Grossular, perimorph after Vesuvianite · Jeffrey Mine, Quebec · ..."
                          ^^^^^^^^^^^^^^^^^^^^^^^^^^^^ Q2 dependent
```

---

## Affected files

| Phase | File | What changes | Blast radius |
|---|---|---|---|
| A | `js/85-simulator.ts` or new `js/85e-specimen-builder.ts` | Add `_buildSpecimens()` method to VugSimulator + `Specimen` type | LOW. Pure-derive, no UI |
| A | `js/26-mineral-paragenesis.ts` | Already has `parsePositionHost` — reuse it | NONE (no changes) |
| A | `js/99z-agent-interface.ts` | `_agentSpecimenJSON` extended to emit `specimens[]` field alongside `crystals[]` | LOW. Additive |
| A | `tests-js/specimen-builder.test.ts` (NEW) | Pin specimen detection on jeffrey_mine, tn457_barite_pulses, mvt, supergene_oxidation, gem_pegmatite | LOW. New test only |
| B | `js/85-simulator.ts` `format_summary()` | Per-specimen narrator output ("the cabinet specimen is X on Y on Z…") | MEDIUM. Narrator output shifts; baseline-text shifts (snapshot tests may need updates if any pin format_summary text) |
| C | `js/97-ui-fortress.ts` (inventory panel) | Per-specimen rows instead of per-mineral counts | MEDIUM. Pure UI; existing tests don't cover this surface |
| C | `js/91-ui-legends.ts` (Simulation inventory) | Same per-specimen row shift | MEDIUM |
| D | `js/95-ui-library.ts` | Library card = one specimen; card layout, save schema migration | **HIGH**. Rarely touched, no automated coverage. Save format changes are user-data-affecting |
| D | `js/93-ui-collection.ts` | Specimen-keyed save instead of crystal-keyed | **HIGH**. Migration needed for old saves |
| D | `js/97c-ui-crystal-card.ts` | Reached via specimen drill-down; minor layout adjustments | LOW. Existing card unchanged in form |
| D | `js/97d-ui-zone-modal.ts` | Same — reached via specimen drill-down to crystal → modal | LOW |
| E | `js/98-ui-groove.ts` (Record Player) | Per-specimen entry point; drills to per-crystal groove | **HIGH** rendering-side, but largely additive (specimen card → existing groove UI) |
| E | `js/99i-renderer-three.ts` | Specimen bounding box / selection halo / host-guest visual marker | MEDIUM. Pure polish; no existing tests block changes |

**The "rarely touched, will break" concern (boss 2026-05-21) maps directly to Phase D + E.** No automated test covers library card layout end-to-end; Record Player groove is canvas-drawn and visually validated. By the time Phase D ships, Phases A-C have proven the specimen detection + display in lower-risk surfaces.

---

## Phased implementation

### Phase A — derive without changing user-visible UI

- Implement `_buildSpecimens()` + `Specimen` type
- Extend `?dump=specimen` JSON to include `specimens[]`
- Tests: pin specimen detection on the four canonical scenarios above
- ZERO UI change

**Deliverable:** boss can run `?scenario=cooling&seed=42&dump=specimen` and inspect the `specimens[]` derived structure to verify grouping is right BEFORE any UI commits.

**Commit-sized.** ~150-200 lines + tests.

### Phase B — narrator output

- Update `format_summary` to group by specimen with paragenetic narration
- Old per-mineral inventory in fortress panel still works (untouched)
- Snapshot tests may need updates if any test pins narrator text

**Commit-sized.** Low-risk; narrator output is high-narrative-value but low-functional-impact.

### Phase C — inventory display

- Fortress panel (`97-ui-fortress.ts`) inventory: per-specimen rows
- Simulation/legends panel (`91-ui-legends.ts`) inventory: same
- Save schema not yet touched — still per-crystal underneath, only display changes

**Commit-sized.** Pure UI; no save-format risk.

### Phase D — library + save schema (HIGH RISK)

- Save schema migration:
  - New entries store `Specimen` + `member_crystals[]` per current Phase A schema
  - Old crystal-keyed entries auto-migrate by walking their host chains at load-time
- Library card layout: one card = one specimen
- Crystal drill-down via clicking specimen card

**Bigger commit.** This is the boss's flagged fragility zone.

### Phase E — Record Player + 3D renderer polish

- Record Player gets per-specimen entry point
- 3D renderer: specimen bounding box halo, host-guest visual marker
- The "model in library" Q4 feature gates on (c) re-runnable URL implementation

**Polish.** Optional; can ship over time.

---

## Tests

Phase A guard test (`tests-js/specimen-builder.test.ts`) — minimum pins:

1. **Cave-in-Rock-style baseline**: a 3-crystal chain (galena → fluorite on galena → calcite on fluorite) builds as 1 specimen with 3 species.
2. **TN457 barite pulses**: 6 barite-on-sphalerite + 2 sphalerite = either 2 specimens (Q1 strict) or 1 specimen (Q1 union, if barite chains end at sphalerites within adjacency radius).
3. **Jeffrey rodingite**: multi-stage host chain (chrysotile root, then datolite/vesuvianite/pectolite cascade). Specimen count + assemblage match the v115 baseline + boss expectation.
4. **Free-wall druzy** (`zoned_dripstone_cave`): each free-wall crystal is its own specimen under strict rule (a); merge under wall-adjacency union.
5. **Dissolved member** (`bisbee` or `supergene_oxidation` — Q2 dependent): specimens with CDR pseudomorphs label correctly per Q2 answer.
6. **Composite label composition**: chained-only, sibling-only, mixed chain+sibling, dissolved-member cases all produce expected label strings (Q3 dependent).
7. **Deterministic specimen IDs**: same seed → same specimen IDs across consecutive runs (composes with v117 `?seed=N` URL contract).

Phase D save-schema migration test: load v120-format library save → emit v121-format with specimen objects → load again → identical surviving crystal data.

---

## Future work — clustering spectrum

**Out of scope for THIS proposal, but the specimen object is the prerequisite.**

Three distinct cluster mechanisms identified in planning conversation 2026-05-21, ranging from "1 crystal" to "solid coating":

| Mechanism | Driver | Texture | Implementation note |
|---|---|---|---|
| **Mass-nucleation event** | High supersaturation pulse (cooling / evap / pH shock) overwhelms growth kinetics → many simultaneous nuclei | Druzy crusts; tn457 coin-stacks; Sweetwater snowball | Engine half-has it; bypass per-step nucleation cap at high σ |
| **Fracture-substrate event** | Tectonic shock breaks existing crystals → broken faces are new high-energy substrate → epitaxial regrowth | Twinned + fracture-aligned overgrowth | Currently `tectonic_shock` only bumps T+P; would need to mark random crystals as fractured + emit new high-affinity substrate sites |
| **Cryptocrystalline (chalcedony)** | Silica-gel deposition → very-late recrystallization to sub-micron crystallites | Smooth conchoidal-fracture coating; agate banding; tiger's eye | Render as smooth coating with banding from per-pulse trace shifts (composes with v118-v121 per-zone color work). Heaney & Davis 1995 Science 269:1562 |

The Specimen object is the right place to flag cluster-vs-individual. A `Specimen.cluster_type` field (`'individual' | 'mass_nuc' | 'fracture' | 'cryptocrystalline'`) drives rendering choices downstream. Current Q5-recommended kept-as-is snowball habit becomes `cluster_type: 'mass_nuc'` retroactively.

---

## Future work — "3D model in library"

Per Q4 (pending). The recommended **(c) re-runnable URL** composes most cleanly with v117's shareable-URL contract:

```
Library entry:
  - Specimen object (assemblage, display_name, bounding_box)
  - Re-run URL: ?scenario=jeffrey_mine&seed=42&shape_seed=3&steps=200
  - Optional: end-state cache (PNG thumbnail for fast scroll, refreshed on update)
```

Clicking the library card re-runs the simulation headlessly (already supported by v117's `_agentHeadlessRun`) and re-renders the specimen. No mesh stored. Free sharing: copy the URL.

If boss picks (a) or (b) instead, this section gets rewritten accordingly.

---

## What we have already (the reuse inventory)

This proposal builds on substantial existing infrastructure. Don't re-invent:

| Existing | Use for Specimen |
|---|---|
| `Crystal.position` "on X #N" strings | The substrate graph — walk these for component detection |
| `parsePositionHost(position, crystals)` in `js/26-mineral-paragenesis.ts:251` | Already parses position strings — exact tool needed for chain walking |
| `SUBSTRATE_NUCLEATION_DISCOUNT` table | Documents which host-guest pairs are legitimate epitaxy — guides specimen-detection edge cases |
| `Crystal.enclosed_by` / `enclosed_crystals` | Crystals fully engulfed by a growing host — treat as same specimen unconditionally |
| `Crystal.cdr_replaces_crystal_id` + `Crystal.perimorph_eligible` | Q2 perimorph labeling source of truth |
| `Crystal.wall_anchor.{cellIdx, ringIdx}` | Q1 adjacency union proximity check |
| `scenario.anchor` field in `data/scenarios.json5` | Locality string for composite label |
| `_agentSpecimenJSON` (v117) | Already produces JSON output for per-crystal state; extend to add `specimens[]` |
| v118-v121 per-zone trace_Mn capture + color dispatch | When library shows specimen, drill-down to crystal already paints zone bands correctly |

---

## Risk register

| Risk | Phase | Mitigation |
|---|---|---|
| Save-format migration breaks existing user library entries | D | Migration logic walks crystal chains at load-time; old entries reconstruct as specimens with backward compat layer |
| Library card layout changes break canvas-drawn Record Player groove | E | Phase D → E gap allows boss to verify library before record-player layout assumptions shift |
| Specimen-detection grouping doesn't match boss intuition on edge cases | A | Phase A ships derive-only; boss inspects `?dump=specimen` output before any UI changes; iterate the grouping rule via Q1/Q2/Q3 answers before Phase B |
| Adjacency-union radius (Q1) tuning is too aggressive/loose | A→B | Start with default 3 cells; expose as `_specimen_adjacency_cells` field on the sim; tune per scenario if needed; pin via tests on real scenarios |
| Sibling-vs-chained label ambiguity in mixed cases | A | Test pin (#6 above) explicitly covers chained-only / sibling-only / mixed cases |
| Per-mineral inventory pinned somewhere we didn't find | B-C | Phase B narrator change surfaces any text-based test pins early; fix as they fail |

---

## Decision tree (post-boss-answers)

```
Q1 (adjacency) → strict | union
  └─ if union: pick default radius
Q2 (dissolved) → keep | drop | perimorph-aware
  └─ if perimorph-aware: confirm reuse of perimorph_eligible flag
Q3 (sibling label) → "+" | "," | "assemblage"
Q4 (3D model future) → static thumbnail | stored mesh | re-runnable URL
  └─ affects Phase D save schema design
Q5 (snowball) → refactor | keep-as-is
  └─ if keep-as-is (recommended): cluster_type='mass_nuc' for snowballs
Q6 (drill-down) → list-only | sheet-only | both-stacked
  └─ affects Phase C UI scope + Phase D library card scope
```

Once all six land, the doc is ready to formalize: drop the question blocks, lock the design decisions, and hand to fresh-context implementation pass starting at Phase A.

---

## Sequencing recommendation (post-answers)

Once boss has answered Q1-Q6:

1. Update this MD with the locked decisions
2. Commit Phase A as a single commit (Specimen type, builder, tests, ?dump=specimen extension) — boss reviews `?dump=specimen` output for grouping correctness
3. If grouping looks right: ship Phase B (narrator) + Phase C (inventory) as one commit batch — boss tests the user-facing display
4. Phase D (library + save schema) as a dedicated commit with explicit migration testing — fragile zone, careful
5. Phase E (Record Player + renderer polish) iteratively — pure polish, no urgency

Per boss preference, all phases ship before the boss does any interactive testing. Each phase still gets its own commit + version bump for git history granularity.

---

## See also

- `js/26-mineral-paragenesis.ts` header — the substrate-affinity science
- `proposals/PROPOSAL-PARAGENESIS-OVERGROWTH-CRUSTIFICATION-PSEUDOMORPHS.md` — Phase 1/2/3 of the existing paragenesis arc
- `proposals/HANDOFF-MINERAL-STOICHIOMETRY-BACKFILL.md` — the v120 deferred-tune-required pattern this proposal also uses (explicit deferred list with justification)
- `proposals/PROPOSAL-EVENT-DRIVEN-PRECIPITATION.md` — the coin-stack render-side concerns share architectural space
- `js/15-version.ts` v117 — agent-friendly URL contract that Q4 (re-runnable URL) composes with
