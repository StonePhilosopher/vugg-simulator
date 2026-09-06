# Vugg Simulator — Current Debt Ledger (2026-09-06)

> **Authority boundary.** This is the current, compact view of debt owed after
> SIM 285 and the visual-realism review. It is derived from
> `OPEN-IMPROVEMENTS-LEDGER-2026-08-08.md` §P3 and
> `PROPOSAL-HOSTILE-REVIEW-VISUAL-REALISM-2026-09-04.md`.
> Old handoffs and `BACKLOG.md` remain provenance, not executable truth.
> An old “OPEN” label does not revive work here unless this ledger names it.

## How a debt is paid

A checkbox closes only when the implementation, its focused tests, the required
photo-rig before/after evidence, and any evidence rebake/cold-CI gate all agree.
Render statistics are regression guardrails; the terminal realism verdict is an
eye-check against the fixed boss-owned whole-vug photograph set named in the
hostile review §10.

## Current order

| Order | Debt | State | Estimate | Depends on |
|---:|---|---|---:|---|
| 0 | R1 commissioning | HOLD | cold-CI duration | latest R1 tip |
| 1 | R2 mineral materials | OPEN — next build | 3–5 days | R1 |
| 2 | R6 specimen view | OPEN | 2 days | R1, benefits from R2 |
| 3 | R5 rock wall | OPEN | 2–3 days | R1, R6 framing |
| 4 | R3 physical coatings | OPEN | 2–4 days | measured instance budget |
| 5 | R4 crystallographic forms | OPEN | 4–6 days | R1/R2 visibility |
| 6 | R7 aggregates with history | OPEN — destination | 3–5 days | R2, R4 useful; zone history already exists |

Remaining estimate after R1: roughly **16–25 working days**. The order is
deliberate: make light, then mineral matter, then a photographable specimen,
then repair the wall, coatings, forms, and finally the history carried by an
aggregate.

## D0 — Release and evidence boundary

- [ ] **Commission R1 on its final tip.** The first cold-CI run on
  `5d746d7b` reached batch 195/273 before an unchanged Roughten Gill seed
  sweep crossed its already saturated 150 s wall-clock budget. `ad321b67`
  changes only the two sweep budgets to 300 s; seeds, scenarios, and assertions
  are unchanged. Require a complete Windows x64 / Node 24.15.0 cold-CI pass on
  that tip or its successor before integration.
- [ ] **Integrate only the witnessed tip into canonical.** Never merge an older
  review/R1 tip whose receipts authenticate a different formation.

## D1 — Visual realism programme

### R1 — Light like a photograph

- [x] PMREM environment, ACES tone mapping, exposure, camera-frame key,
  adaptive shadow step-down, cave/studio moods.
- [x] Restore the interior wall in inside mode (outward winding had made
  `FrontSide` cull the entire surface).
- [ ] Close D0 commissioning above.

### R2 — Materials that behave like minerals

- [ ] Replace alpha transparency for clear species with physical transmission,
  measured IOR, rendered thickness, attenuation colour, and
  clarity/extent-scaled attenuation distance.
- [ ] Keep the alpha material only as an explicit low-performance fallback.
- [ ] Make `optics.lustre` load-bearing in pixels: metallic, adamantine,
  vitreous, pearly, resinous, silky, and dull/earthy must produce distinct
  material responses.
- [ ] Re-express etching, frosting, CDR, and inclusions through roughness and
  transmission rather than opacity multipliers.
- [ ] Gate with hero photographs: substrate visible through
  quartz/calcite/fluorite/selenite silhouettes; galena and pyrite highlight
  fraction at least 0.01.

### R6 — Photograph the specimen

- [ ] Add a cut-geode specimen view beside the geological/process orb; neither
  replaces the other.
- [ ] Use an opaque cut wall, restrained studio mood, camera-facing clip,
  neutral dark-cloth gradient, exposure control, optional macro depth of field,
  and restrained film grain.
- [ ] Repair the rig's weak druse camera and the half-cut prototype's
  dark-side orientation while building the production view.
- [ ] Gate default-view edge fraction to the reference band (0.03–0.12) and
  obtain the boss eye-check on Elmwood, Bisbee, and MVT specimen views.

### R5 — A wall that is rock

- [ ] Drive triplanar albedo, roughness, and normal response from host
  lithology/wall composition.
- [ ] Remove periodic ring/cell ridges; smooth macro normals and retain relief
  only as microtexture.
- [ ] Add low-frequency iron-oxide staining and clay-film masks from existing
  simulation state.
- [ ] Gate absence of dominant periodic wall frequency and wall edge fraction
  0.02–0.06.

### R3 — Coatings at physical scale

- [ ] Replace laminated-lining tiles with a wall-conformal displaced shell.
- [ ] Give botryoidal crusts overlapping lognormal lobes plus a thin-case skin.
- [ ] Size euhedral druse teeth from their zone record; allow dense instances
  only where booked mass and the measured performance ceiling permit them.
- [ ] Gate every swath instance to at most 5 mm across and make the Elmwood
  dogtooth silhouette at least 20% of hero-frame height.

### R4 — Crystallographic forms

- [ ] Add calibrated Wulff tenants for quartz, sphalerite, pyrite, gypsum,
  dolomite, aragonite, topaz, and apatite.
- [ ] Add small convex-edge chamfers and low-amplitude face detail only where
  the live R1/R2 lighting proves it reads.
- [ ] Reduce the morphology-fidelity audit from 21 honest residual mis-shapes
  to at most 10.
- [ ] Gate quartz termination geometry by visible alternating r/z face normals.

### R7 — Aggregates with a history

> **North star.** R7 is not “scatter more crystals.” It should make an
> aggregate legible as a sequence of geological events. The simulator already
> owns much of the history in zones, phantom boundaries, masking events,
> contacts, and generations; this rung pays the debt of letting the eye read it.

- [ ] **Population shape:** replace uniform satellite sizes with a bounded
  lognormal distribution and a geologically plausible coarse tail.
- [ ] **Collective orientation:** form sub-parallel families rather than
  independent random rotations; retain bounded disorder so groups do not look
  cloned.
- [ ] **Generation identity:** expose generation/zone age to the renderer and
  give older material plausible staining/weathering while younger overgrowths
  remain cleaner.
- [ ] **Contact history:** render O2 contact/induction faces matte, truncated,
  or rimmed rather than as pristine free-growth faces.
- [ ] **Zoom-aware survival:** replace a single visibility floor with a
  projected-size rule so a 0.3 mm crystal can appear under macro zoom without
  becoming a giant in the orb view.
- [ ] **Internal chronology through glass:** use R2 transmission to reveal
  existing O5c/D1b history—amethyst tips, smoky cores, iron-stained bases,
  phantom boundaries, masked horizons, and younger clear caps.
- [ ] **History-preserving performance:** adaptive density may merge or cull
  individuals, but must preserve the population distribution, generation
  ratios, and salient event boundaries.
- [ ] **R7 receipt:** extend the photo rig with aggregate census fields
  (projected size distribution, orientation spread, visible generations,
  contact-face count) and pair them with fixed hero frames. Numbers prevent
  regression; the eye decides whether the history reads.

#### R7 suggested specimen/scenario gates

- **Elmwood:** honey sphalerite substrate, barite/calcite generations, contact
  surfaces, and clay/iron masking should read as successive events.
- **Amethyst geode:** pale/clear bases, coloured tips, phantom/masked boundaries,
  and any smoky or stained older material should remain visible through R2
  transmission.
- **Grimsel/Tormiq:** sub-parallel alpine-cleft families, sceptre renewal, and
  older-versus-younger quartz should read without textual explanation.
- **Bisbee:** distinct sulfide, carbonate, and oxide generations plus their
  coatings should remain compositionally and chronologically legible rather
  than collapsing into one decorative copper-coloured population.

TN457 is deliberately excluded from cross-simulator realism acceptance. Its
historical label supports “barite on sphalerite, England,” but the pink
columnar/lamellar overgrowth remains unresolved among baryte-family and
Ba-carbonate/replacement possibilities, and the live catalog has also carried
a conflicting record. It may remain a bounded scenario regression fixture; it
must not act as mineralogical ground truth or judge the rest of the renderer
until the physical specimen is definitively identified and the catalog record
is reconciled.

## D2 — Science and content surfaced by the render campaign

- [ ] **Amethyst-geode rind mass:** the authored rind is booked too thin to
  become the visible fabric the scenario claims. Measure and tune the scenario;
  do not compensate in the renderer.
- [ ] **Deccan chalcedony rind mass:** same class of content debt; repair booked
  material or narrow the visual claim.
- [ ] **Fenster quartz remains an honest gap.** Do not infer it from bulk quartz
  saturation; it needs a defensible per-zone growth-rate/structure home before
  being rendered as a claimed habit.
- [ ] **Branching microphysics remains open.** Current splitting/sheaf/
  spherulite forms are bounded render classifications, not a solved branching
  growth model. Preserve that claim boundary.

## D3 — Architecture and instrumentation

- [ ] **Separate durable UI ids from renderer allocation order (F13).** Save and
  collection ids currently draw from a stream Three.js UUID allocation can
  advance. Give durable ids an owned RNG stream, then regenerate/re-pin the
  guided-browser receipt once.
- [ ] **Measure GPU-facing performance honestly.** R1's CPU submission-time
  streak is a coarse safety guard, not the final D4 frame-time gate. Add a
  browser/GPU timing receipt before raising desktop aggregate density toward
  the 4096 ceiling.
- [ ] **Keep the photo rig honest.** Every render-layer commit must carry
  before/after frames from the fixed scenarios and quote statistics from the
  generated manifest rather than hand-copied measurements.

## Explicitly not debt

- The process orb is not to be removed; R6 adds a specimen view beside it.
- Mobile does not owe 4096 instances; its current ceiling remains 384 until a
  measured gate justifies movement.
- R1 lighting does not owe highlights that the current alpha/roughness materials
  mathematically prevent; that acceptance belongs to R2.
- Old `BACKLOG.md` “OPEN” labels are not current tasks unless promoted here or
  in the authoritative open-improvements ledger.

## Update rule

When a debt is paid, mark it here in the same commit that carries the evidence
and add the commit/SIM/receipt reference. When new debt is discovered, state
which observation created it, whether it is render, simulation, content,
instrumentation, or evidence debt, and the test that will prove payment.
