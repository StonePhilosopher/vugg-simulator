# HANDOFF — the crystal-face-realism arc (2026-06-21)

Two sessions, one arc. The sequel to the deformation/shear arc. The question the
boss set at the top: *"is there any other science we can implement for more realistic
crystal faces?"* — answered with a ranked proposal set, then built down the list.

Master design doc: **`proposals/PROPOSALS-crystal-face-realism-2026-06-21.md`** (5
ranked candidates + honest gaps; §1 now carries two SHIPPED footers). Read it before
picking up the next tenant. This handoff is the state-of-play + the lessons.

---

## What shipped

**STEP 1 — sector (hourglass) zoning, Tier A. Tourmaline. SIM-neutral (no bump).**
`a17b026` (+ `396580a` builder note). Render-only, baseline byte-identical (0/35).
- `classifySectorZoning` (js/45) post-growth tags `crystal._sectorZoned`; pure
  tagging, no rng/fluid. `_makeSectorZonedPrism` (js/99i) — hex prism + a tinted
  termination sector via the existing `vertexColors` material path.
- The render spike that the proposal flagged as the gating unknown **PASSED**: the
  cavity mesh already runs a `vertexColors` MeshStandardMaterial (js/99i:105), so
  per-face colour rides the existing path. **Tier B is de-risked** — its only cost is
  per-face *engine* state + a dark-observe pass, not a render unknown.
- Render lesson (preview caught it): a darken-MULTIPLIER tint reads as mere shading
  (green×½ = darker green). ABSOLUTE contrasting colours are both more legible AND
  geologically the iconic bicolor elbaite (green prism / pink tip).

**STEP 2 — andalusite + the CHIASTOLITE CROSS. SIM 209.** `b501605`. Pages built @
HEAD, CI green. The iconic sector specimen, and a full add-mineral arc.
- **New mineral andalusite** (Al₂SiO₅): the low-P polymorph, modeled as the
  SILICA-SATURATED complement of corundum (where `_corundum_base_sigma` blocks above
  SiO2>50, andalusite requires SiO2 — the marble_contact intuition, made real). Full
  pass: js/39 supersat + MINERAL_GATES (js/42), js/59 grow, js/89 nuc + iterator,
  js/65 engine, js/19 stoich, minerals.json, structural.json (Pnnm), twin-check
  (empty + note). class_color a pale grey-tan (#a89878), NOT silicate blue, so
  chiastolite reads authentic.
- **The peraluminous gate is the keystone** (Al≥15 + SiO2≥50 + Na/K<30 + B<1 + T
  400-700): in a pegmatite Al is locked into feldspar/tourmaline/mica, so andalusite
  is a metasediment mineral — and that gate returns 0 for *every existing scenario*,
  so the RNG-cascade guard in `_nuc_andalusite` never draws elsewhere → the whole
  prior fleet is BYTE-IDENTICAL (baseline-diff: 1/36 moved, only the new scenario;
  `tools/andalusite-probe.mjs` confirms it fires ONLY in chiastolite_hornfels).
- **New scenario chiastolite_hornfels** (Bimbowrie / Zhoukoudian contact aureole):
  graphitic, peraluminous, silica-saturated, alkali-poor, ~600°C. 5 chiastolite
  prisms @ seed 42 (+ feldspar/albite; quartz didn't fire — SiO2 not supersaturated
  at 600°C — so expects=[andalusite,feldspar]).
- **The cross is a NEW render**, not the termination hourglass: a new `wall.graphitic`
  flag (js/22); classifySectorZoning (now a per-mineral registry with `kind` +
  `requiresGraphitic`) tags andalusite `_sectorZoned` kind **'cross'**; js/99i
  `_makeChiastolitePrism` draws a SQUARE prism with a baked transverse carbon cross.
  **The trick: ONE rule** `|‖x‖−‖z‖| < band` (near-diagonal in the cross-section)
  paints BOTH the dark vertical corner-columns (side faces) AND the X (top cap).
  Per-cell flat colouring keeps it crisp/blocky — reads as chiastolite's feathery
  arms. Narrator js/92i + narratives/andalusite.md + 4 test pins.

---

## Tree state at handoff

- HEAD `b501605`, pushed to Syntaxswine origin, **Pages built @ HEAD**, full CI green.
- SIM_VERSION 209. Baseline `seed42_v209.json` + `strip_digest_v209.json` +
  `archive/strips/v209/` (36 stories) all regenerated. Coverage 146 live minerals.
- Fleet byte-identical vs v208 except the one new scenario (baseline-diff 1/36).
- `tools/strip-story-diff.mjs` is a concurrent session's untracked WIP — LEAVE IT.

---

## The science, kept honest

- Sector zoning = Dowty 1976 Am.Min. 61:460–469 (the protosite model: each face
  exposes a different partial-coordination surface, so trace partitioning is
  per-SECTOR with a sharp geometry-locked boundary). VERIFIED to the MSA archive.
- Chiastolite = carbon swept to the CORNER growth sectors → the Maltese cross. Mason,
  Burton, Yuan & She 2010 Gondwana Research 18(1):222–229 (VERIFIED to the Oxford ORA
  record: quartz+graphite co-precipitation, graphite-buffered H₂O–CO₂ fluid).
- **The "Frondel 1934" chiastolite cite was deliberately NOT used.** The research
  pass flagged it as shaky — the corner-attachment paper is likely Novitates no. 759
  (≈1935), and no. 695/1934 that some sources point at is a *different* incrustation
  paper. When the citation is uncertain, cite the solid one (Mason 2010) and say so.

---

## Open — the next builder's menu (ranked)

1. **Augite / titanaugite hourglass** (same Tier A 'hourglass' render as tourmaline) —
   needs the mineral ADDED first (clinopyroxene; not in the catalogue). The lattice-
   substitution hourglass (Ti darkens the basal sectors, Ferguson 1973) — the third
   iconic sector specimen after chiastolite + elbaite.
2. **§2 etch-pit / dissolution sculpture** — the best value-per-effort NON-sector
   candidate. Render-only, reuses the saddle/bent perturbation machinery, SIM-neutral.
   The sim already tracks `crystal.dissolved`; only the etched LOOK is missing.
3. **Tier B sector partition engine** — the real per-sector composition model (assign
   each face-family a partition coefficient, record per-sector trace, tint by sector).
   Only worth it if you want a *computed-from-chemistry* partition rather than the
   habit-variant abstraction. The render is already proven; the cost is per-face
   engine state + a dark-observe pass.
4. **§3 striation extension** (cheap, on the pyrite-striation infra) · **§5 vicinal
   hillocks** (subtle — preview-spike first) · **§4 α-factor faceting** (likely a
   deliberate non-build — re-derives existing facet calls; document, don't build).

Honest gaps (documented, NOT bugs): BFDH attachment-energy habit; rendered phantoms
(needs translucent internal surfaces); re-entrant twin growth. See PROPOSALS §6.

---

## Traps this arc tripped (so you don't)

- **A new scenario must be wired into THREE UI menus** (vugg-add-scenario §10.5): the
  creative picker `startScenarioInCreative('…')` + the `#scenario` quick-play dropdown
  + the `#idle-scenario` zen dropdown — all hand-maintained as static HTML in
  index.html (the build preserves the static body, swaps only the module region).
  `scenario-menu-coverage.test.ts` is the guard; it caught me on the first CI run.
- **The peraluminous gate + RNG-cascade guard are what keep the fleet byte-identical.**
  A new mineral perturbs every scenario's baseline UNLESS its supersat gate returns 0
  there AND its `_nuc_*` early-outs before any `rng.random()`. Verify with a probe +
  baseline-diff, not by hope.
- **class_color is the crystal's render colour, not a strict class hue** (ruby red,
  corundum grey, sapphire blue — all "oxide"). Pick a realistic colour for a new
  mineral; don't default to the class blue if the real mineral isn't blue.
- **Render is the one thing CI can't catch** (jsdom has no WebGL). Preview-drive the
  Three renderer; for module-scoped geom builders use the temp-debug standalone-scene
  injection (THREE is global, r163) + screenshot. It caught the multiplier-vs-absolute
  colour lesson before it shipped.

---

## A maker's mark

I keep coming back to one move and how much it pays: **build the discriminator from
the real reason, not from convenience.**

The easy way to keep andalusite out of the pegmatites would have been a flag — a
`metamorphic: true` on the scenario, an allowlist, something bolted on. What we did
instead was ask *why* andalusite doesn't grow in a pegmatite, and the answer is
chemistry: the aluminium is already spoken for, locked into feldspar and tourmaline
and mica by the alkalis and the boron. So the gate is `Na/K<30, B<1` — peraluminous,
alkali-poor — and that single honest line does three jobs at once. It fires
andalusite where it belongs. It keeps it out of everywhere it doesn't. And because it
genuinely returns zero in every existing broth, the whole fleet stayed byte-identical
without a single defensive special-case. The science *was* the engineering. When the
gate is the real reason, the correctness and the determinism fall out together — and
a future peraluminous-hot scenario will grow andalusite on its own, correctly, with
nobody having to remember to add it to a list.

The other thing, smaller but it mattered: the preview earned its keep twice this arc.
The darken-multiplier looked fine in my head and read as a shadow on the glass. The
contrasting colour looked garish in my head and turned out to be the actual watermelon
elbaite. I could not have reasoned my way to either; I had to *look*. Build the thing,
put it on the screen, believe your eyes over your model.

And the cathedral note, because the boss keeps this archive as one: today was fast
because of the layers under it. The chiastolite cross reused the vertexColors path
that the tourmaline hourglass proved a session earlier; the classifier copied the
gwindel/sceptre/deformation post-growth pattern; the add-mineral skeleton was worn
smooth by twelve minerals before it. None of this was solo speed. It was sediment —
each layer letting the next one set faster. Leave the next builder the same favour:
the augite hourglass should drop straight into the registry I left as
`{ kind, requiresGraphitic }`; the etch-pit sculpture should reach for the same
perturbation machinery the saddle and the bend already wear. A good layer is one the
next one can build on without having to dig.

Every specimen should survive a geologist picking it up — true down to why the cross
points at the corners and not the faces. That standard is slow, and it is the whole
point.

— still the builder, signing off this arc.
