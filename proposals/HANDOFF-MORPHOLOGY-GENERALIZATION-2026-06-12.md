# HANDOFF — Morphology Generalization (2026-06-11 → 12) ✅ LIST COMPLETE

One continuous session: the calcite arc's classifier became the
MORPHOLOGY REGISTRY (js/45-morphology.ts) and the boss's whole
wish-list shipped through it. 14 commits, SIM 187 → 190, 1861 tests.
This doc is the cathedral record + the THREE instruments a future
session needs: the all-mineral claims table (§2 — the boss's
verification worksheet), the ninth-tenant recipe (§3), and the traps
(§4).

## §1 The census

**8 tenants**: calcite (first, byte-identical hoist `b6ba453`) ·
halite + sylvite (`90fac90` + render `2bbfd19`) · native_bismuth
(SIM 188 `adffa68` + wittichen SIM 189 `f53ae9c`) · fluorite
(`407ac5e`) · pyrite (`6484db0`) · native_copper + native_gold
(`1b7f6fe`). Plus the v190 mvt dogtooth correction (`873bb9d`) — the
hand-verification pass's first catch.

**Instruments**: tools/morph-sigma-observe.mjs (generic survey — run it
FIRST for any new tenant); judges elmwood-stepped / halide-hopper /
wittichen-dendrite (8-seed contracts); 6 morph chips digest-pinned
(calcite, halite, sylvite, bismuth@wittichen, fluorite@elmwood+mvt,
pyrite@sulphur_bank); legend groups added: halide, native, sulfide.
**New content**: `wittichen` scenario (the five-element vein —
de-orphaned skutterudite + safflorite). **Design doc**:
RESEARCH-quartz-morphology-2026-06-12.md (sceptre = hiatus-then-renewal
= the registry's SECOND classifier kind; a future arc).

## §2 THE CLAIMS TABLE — all eight minerals (the verification worksheet)

The calcite rows live in TUNING-CALCITE-MORPHOLOGY.md §6 (mvt's row
CORRECTED v190). These are the NEW claims, seed-42 measured, each with
its first knob. The standing principle, now exercised once: the
locality is the authority; the literature was scaffolding.

| mineral / scenario | the sim's claim | what to check on the specimen/locality | first knob if reality disagrees |
|---|---|---|---|
| halite / searles | ZONED: banded cube (chevron) at baseline + hopper/raft on desiccation spikes (67/33 at seed 42); end habit hopper | salt-pan halite: chevron-banded bottom growth + hopper rafts — Lowenstein & Hardie textures | band edges in MORPH_TH.halite (spar<10\|60\|150\|800); the wet/dry split is the `concentration` driver, not morphology |
| halite / bisbee + tn457 + sicily | 100% smooth cubes (the legacy in-step rule called bisbee hopper — corrected) | arid supergene / burial halite = plain cubes | if real crusts hopper: SPIRAL_MAX down |
| sylvite / searles | hopper episodes on spikes (~31%) | potash hoppers | MORPH_TH.sylvite (3\|8\|16\|60) |
| bismuth / wittichen | 39–49% DENDRITIC zone mass; end habit massive/feathery (healed); narrator tells the shock | five-element vein Bi: dendritic cores in carbonate, arsenide-rimmed | bands (1.4\|1.8\|2.1\|2.25 — MEASURED vs activity-compressed ceiling ~2.4); the shock pulse amp/width in wittichen's Eh movement |
| bismuth / schneeberg | brief smooth-band massive Bi, then destroyed by the oxidation swing | Schneeberg primary Bi = massive/foliated veinlets (the U-stage, NOT the five-element stage) | this is the WEATHERING claim — if wrong, it's the v185 movement, not morphology |
| fluorite / elmwood | ZONED 56% smooth / 44% growth-banded purple cubes — the same fault-valve beats as the calcite | Elmwood fluorite: stepped/composite cube faces | MORPH_TH.fluorite (5.0\|6.5\|7.5\|9.0); elmwood's CO3/pH pulse amps |
| fluorite / reactivated vein | 90% composite/stepped (cube-on-cube regrowth) | re-opened vein fluorite | same bands |
| fluorite / mvt | 100% glassy (4.96 sits JUST under the 5.0 edge — deliberate) | Tri-State fluorite: glassy purple cubes | SPIRAL_MAX — but know the 4.96 is a knife-edge by design |
| fluorite / sunnyside | octahedral_REE preserved (form beats roughness) | green Y-fluorite octahedra | MG-analog = the Y>1 rule in grow_fluorite (v103/v104 lineage) |
| pyrite / sulphur_bank | 86% striated (hot-spring driven end) | striated crusts | MORPH_TH.pyrite (1.6\|2.4\|3.2\|4.2) |
| pyrite / mvt | ZONED 51/49 smooth/striated | Tri-State pyrite: striated cubes common | same |
| pyrite / sunnyside + elmwood | 100% smooth euhedra ("Navajún glass" band) | small early euhedra | SPIRAL_MAX |
| copper / bisbee | grows on the −400 pulse carrying 33% dendritic + 18% skeletal, then DISSOLVES (the cast — replay shows the tree, end state shows its absence) | Bisbee/Cornish copper: trees replaced/cast in oxide zone | bands (1.3\|1.7\|1.95\|2.05 on the measured pulse ramp, peak 2.09); the pulse amp is bisbee's v186 movement |
| gold / bisbee | spongy/DENDRITIC 63% fishbone (was 'nugget' — corrected; nuggets are placer textures) | oxide-zone gold: spongy/dendritic | bands (1.8\|2.5\|3.2\|4.5) |
| gold / porphyry | rare octahedral inclusions (the legacy claim, preserved) | microscopic euhedral Au | same |

## §3 The ninth-tenant recipe (what 7 ports taught)

1. **Survey first**: `node tools/morph-sigma-observe.mjs --minerals X`.
   Read the SHAPE: plateaus (halides — clean banded zones) vs
   continuous (pyrite — zoned crystals) vs spike (natives — the event
   IS the band). Check in-step vs post-step gap (calcite had one;
   nobody else did — but never copy a legacy in-step threshold without
   re-checking).
2. **Bands on MEASURED numbers + locality ground truth** — never on
   another mineral's edges, never on paper σ. The mineral's ceiling may
   be structural (bismuth bi_f×red_f) or activity-compressed (brine
   salinity halves it). If the scenario doesn't exist yet, edges are
   provisional and the scenario commit re-pins them (bismuth pattern).
3. **Damping is per-mineral PHYSICS**: calcite yes (still vug fluid,
   Wolthers δ); evaporites/veins/redox-shock minerals no (convection,
   Berg effect, advection) — Infinity disables it cleanly.
4. **Entry + hooks** in js/45 (σ source, form rule, effSigmaMult);
   display map; the form rule MIRRORS the engine's existing form
   dispatch (fluorite's Y, pyrite's T) — compose, don't replace.
5. **Dispatch** in the grow engine: regime read with the one-step lag,
   TEXTURE habits excluded (framboids, massive, nugget, sheet = nucleation
   density/transport/fissure aggregates, NOT interface morphology — the
   recurring conflation, fixed in bismuth/gold/copper). NO rng in the
   branch → sim-neutral; rng-pattern change → SIM bump + rebake.
6. **Aspect firewall**: every new habit string returns the EXACT value
   its parent family already landed on (js/27 — explicit, commented).
7. **Render**: cube-token minerals get the square ziggurat FREE (add
   the mineral to halideTerraceBands' gate AND 99i's hook — BOTH, see
   trap 3) + the token check in _habitGeomToken (see trap 2). Other
   forms need their own geometry (the dendrite tree + sceptre two-body
   are the queued builders).
8. **Chip** via _morphChipParam (one line) — new legend group = union
   type in 99j + the systems array in 99k.
9. **Digest pin ONLY with a real tenant scenario** — an unoccupied
   chip pins all-null, which is worse than no pin (trap 4).
10. **Judge + tests**: 8-seed contract tool + a test file pinning the
    claims table rows. ~6 tests is the established weight.

## §4 Traps (each cost something once, tonight)

1. **Live-trajectory gating** (CATCHES v190): form/band thresholds read
   the LIVE fluid — events/movements move Ca, Eh, T after step 0. Probe
   post-event ratios; an initial-value tune can be a silent no-op.
2. **Token fallthrough**: _habitGeomToken defaults unknown strings to
   'prism' — new habit strings render as HEX PRISMS unless explicitly
   routed ('stepped_cube' missed the exact-'cubic' check; legacy
   'hopper_growth' had done this since v27; plain 'pyritohedral' STILL
   does — open wart).
3. **Two gates per cube tenant**: the 99i hook's mineral list AND
   halideTerraceBands' mineral gate — fluorite silently returned null
   when only one was widened.
4. **Sparse chips digest to all-null** under the angle-average
   reduction (crystals anchor at points; searles halite anchors on the
   floor ring) — seriesMaxAt (max over angle×height) is the sparse
   path; add new morph chips to STRIP_DIGEST_SPARSE_MAX_CHIPS.
5. **Digest regen verification**: JSON reflow makes scary diffs —
   verify entry-by-entry against `git show HEAD:` (the
   0-pre-existing-drift check); never eyeball the line count.
6. **Verdicts don't land where predicted**: the worksheet flagged
   jeffrey/marble; the first catch was mvt's FORM. Hold all claims
   loosely.

## §5 Open threads, ranked

1. **Boss verification continues** (§2 is the instrument; mvt was
   verdict #1).
2. **wittichen barite + erythrite** (vugg-tune-scenario): need late
   oxidation the living arsenide suite can't survive — spatially
   partial oxidation, or barite as a vein-top stage.
3. **Dendrite TREE + sceptre two-body renders** (siblings — the first
   non-single-envelope geometries; quartz doc §3 has the sceptre
   sketch).
4. **Sonifier**: a dendrite bell on the morph-ordinal slam? Composes
   with the ongoing make-it-more-musical thread — needs the boss's ear.
5. **'pyritohedral' 3D token wart** (pre-existing): pyritohedra render
   as hex prisms in the topo view.
6. **Quartz arc** (RESEARCH-quartz-morphology-2026-06-12.md): hiatus
   census first; fenster band is nearly free; sceptres are the real
   work; Tessin needs an alpine-cleft scenario (its own add-scenario
   arc — wish-list candidate).
7. Small debts: σ-stepped REE octahedra unmodeled; narratives/*.md
   variants for the new morph prose (inline fallbacks ship).
