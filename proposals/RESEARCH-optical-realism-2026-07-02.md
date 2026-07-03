# RESEARCH — Optical realism: diaphaneity → plain % translucency (Depth-A design)

**2026-07-02 · the STANDING GOAL's research pass (boss directive 2026-06-22, full text in
`HANDOFF-APOPHYLLITE-AND-GYPSUM-2026-06-22.md` ➕ NEW GOAL) · design only, no code in this pass**

> The fixed decision (growth-geometry handoff 2026-07-01, item #3): **plain % translucency — a
> per-mineral diaphaneity field → one material builder, NO faked refraction.** Forward-compatible
> with later zoning. This doc scopes exactly that Depth-A, and maps the later depths (lustre,
> body-colour, colour-through) without building them.

---

## 1. Status quo (audited 2026-07-02, post-4a.8 tree)

**One material construction site**: `js/99i-renderer-three.ts` ~4216 (`new THREE.MeshStandardMaterial(matOpts)`).
Everything optical today is assembled there from:

| signal | source | value today |
|---|---|---|
| colour | `MINERAL_SPEC[m].class_color` (data/minerals.json) | flat hex per mineral, fallback `#d2691e` |
| metalness | class heuristic | 0.45 sulfide/native, else 0.08 |
| roughness | class heuristic | 0.42 silicate/oxide, else 0.62 |
| CDR pseudomorph | `+0.18` roughness (Putnis porosity, boss-approved level) | state modifier |
| etched | `+0.30` roughness (frost) | state modifier |
| perimorph cast | `transparent, opacity 0.42, metalness 0` | state modifier |
| gypsum hourglass (clear) | `transparent, opacity 0.82` — **the magic number the goal names** | per-tenant hack |
| sector-zoned (apophyllite green / tourmaline hourglass / chiastolite) | `color=white + vertexColors` (baked absolute colours) | composition constraint |
| grow-in sweep | multiplies mesh opacity by a 0→1 factor; satellites track `naturalOpacity` (~3550) | composition constraint |
| cavity | separate material, `opacity 0.40` | out of scope |

**Not in the 3D material path today**: smoky-quartz darkening (narrator/2D only — grimsel's smoky
is geometry (gwindel/sceptre) + words, not pixels), amethyst hue, any per-crystal colour driven by
recorded chemistry. Diaphaneity does not exist as data anywhere; `transparent` is only ever a
state/tenant hack. Exactly the ad-hoc-ness the goal names.

## 2. The science, in one page

Diaphaneity is a standard mineralogical field (every mindat/webmineral species page carries it)
with a physical basis worth keeping straight because it dictates the DATA SHAPE:

- **Opaque** minerals are opaque for an electronic reason — metallic/semi-metallic bonding or
  small band gaps (sulfides, native metals, most oxides like magnetite/hematite). No specimen of
  galena is ever transparent at display thickness. → a species-level FLOOR, not a typical value.
- **Transparent** species (quartz, fluorite, calcite, gypsum, barite, halite …) are transparent
  as ideal single crystals; REAL specimens grade to translucent via scattering — fluid/solid
  inclusions, internal fractures, zoning, aggregation. So "transparent to translucent" ranges are
  about SPECIMEN QUALITY, and the render wants the *typical fine display specimen* value, with
  the gem end (Naica selenite, optical calcite, water-clear Elmwood) as the achievable maximum.
- **Translucent-only** species (most carbonate/arsenate crusts, malachite, turquoise) scatter
  intrinsically (aggregation, water content, grain boundaries).

Two render-relevant corollaries:
1. **Diaphaneity is a per-SPECIES default modulated per-CRYSTAL** (a milky vs rock-crystal quartz
   is the same species). Depth-A ships the species default; the habit/chemistry modulation slot
   (e.g. `milky_`, druse crusts read more translucent) is Depth-C, and the schema must leave room.
2. **Opacity ≠ 1−clarity linearly.** A "transparent" crystal still reads solid from most angles
   (reflection, internal features); plain % translucency should bottom out well above glass-like
   invisibility or the vug reads empty. The mapping below floors at 0.30.

## 3. The data — verified core table

Source discipline ([[feedback_cross_check_research_disagreements]], the three-source method where
load-bearing): the 30-species core below was compiled by a research pass that FETCHED mindat +
webmineral per species (flags noted); the long tail falls back to class defaults marked
`source:"class-default"` until verified. Diaphaneity/lustre are stable textbook fields — the risk
is not volatility but transcription confabulation, hence fetched-not-remembered for the core.

**Sources legend** — every row verified against two fetched sources:
- **WM** = webmineral.com `data/<Name>.shtml` (fetched)
- **HOM** = Handbook of Mineralogy (Anthony et al.), fetched as PDF from
  `rruff.net/doclib/hom/<name>.pdf` and read (baryte.pdf, sulphur.pdf, fluorapophyllite.pdf for
  the alias rows)
- **MD\*** = mindat.org via live search snippets only — direct fetches are bot-blocked (403 /
  CAPTCHA); used as tie-breaker on the 6 contested rows. (Siderite's WM row independently
  re-fetched in-session as a transcription spot-check — verbatim match.)

| # | Mineral | Diaphaneity (verified range) | clarity | Lustre | Sources |
|---|---|---|---|---|---|
| 1 | Fluorite | transparent to translucent (WM: to subtranslucent) | 0.85 | vitreous; dull when massive | WM+HOM ✓ |
| 2 | Calcite | transparent to opaque (typ. crystal transparent) | 0.85 | vitreous; **pearly on cleavages and {0001}** | WM+HOM ✓ |
| 3 | Wulfenite | transparent to opaque (typ. transparent–translucent) | 0.70 | resinous, subadamantine to adamantine | WM+HOM+MD\* (WM outlier — flag 2) |
| 4 | Barite (baryte) | transparent to translucent (WM: to opaque) | 0.70 | vitreous to resinous, may be pearly (cleavage) | WM+HOM ✓ |
| 5 | Galena | opaque | 0.00 | metallic | WM+HOM ✓ |
| 6 | Titanite | transparent to opaque | 0.60 | adamantine to resinous | WM+HOM ✓ |
| 7 | Quartz | transparent (to nearly opaque when massive) | 0.92 | vitreous; waxy to dull when massive | WM+HOM ✓ |
| 8 | Gypsum (selenite) | transparent to translucent | 0.95 | subvitreous; **pearly on {010}; silky if fibrous** (satin spar) | WM+HOM ✓ |
| 9 | Fluorapophyllite-(K) | transparent to translucent | 0.80 | vitreous; **pearly on {001} basal** | WM+HOM ✓ |
| 10 | Sphalerite | transparent to translucent; opaque when Fe-rich (marmatite) | 0.40 | resinous to adamantine (marmatite submetallic) | WM+HOM+MD\* (flag 4) |
| 11 | Pyrite | opaque | 0.00 | metallic, splendent | WM+HOM ✓ |
| 12 | Dolomite | transparent to translucent | 0.55 | vitreous to pearly | WM+HOM ✓ |
| 13 | Siderite | translucent (to subtranslucent); transparent exceptional | 0.45 | vitreous, may be pearly or silky | WM+HOM+MD\* ✓ (flag 7) |
| 14 | Malachite | translucent to opaque (typ. opaque; translucent in thin fibres/films) | 0.08 | adamantine to vitreous (crystals); **silky fibrous; dull-earthy massive** | WM+HOM ✓ |
| 15 | Azurite | transparent to translucent (very dark body colour) | 0.35 | vitreous to subadamantine | WM+HOM ✓ |
| 16 | Cerussite | transparent to translucent | 0.80 | adamantine, tending vitreous/resinous | WM+HOM ✓ |
| 17 | Anglesite | transparent to opaque (typ. transparent–translucent) | 0.75 | adamantine; resinous to vitreous | WM+HOM ✓ |
| 18 | Aragonite | transparent to translucent | 0.70 | vitreous; resinous on fracture | WM+HOM ✓ |
| 19 | Halite | transparent | 0.85 | vitreous | WM+HOM ✓ |
| 20 | Sulfur | transparent to translucent | 0.70 | resinous to greasy | WM+HOM ✓ |
| 21 | Smithsonite | translucent to (sub)transparent | 0.50 | vitreous, may be pearly (satiny botryoidal) | WM+HOM ✓ |
| 22 | Mimetite | (sub)transparent to translucent | 0.55 | resinous to subadamantine | WM+HOM ✓ |
| 23 | Vanadinite | subtransparent/subtranslucent to opaque | 0.45 | subresinous to subadamantine | WM+HOM+MD\* (flag 5) |
| 24 | Magnetite | opaque (translucent only on very thin edges) | 0.00 | metallic to submetallic, may be dull | WM+HOM ✓ |
| 25 | Hematite | opaque; thin-edge deep blood-red internal reflections | 0.02 | metallic/submetallic to dull (earthy) | WM+HOM ✓ |
| 26 | Stibnite | opaque | 0.00 | metallic, **splendent on cleavage** | WM+HOM ✓ |
| 27 | Proustite | translucent (to transparent); darkens on light exposure | 0.50 | adamantine | WM+HOM+MD\* (WM outlier — flag 3) |
| 28 | Erythrite | transparent to translucent | 0.60 | subadamantine; **pearly on {010}** | WM+HOM ✓ |
| 29 | Chalcopyrite | opaque | 0.00 | metallic | WM+HOM ✓ |
| 30 | Rhodochrosite | transparent to translucent | 0.70 | vitreous; pearly in aggregates | WM+HOM+MD\* (flag 6) |

**Research-pass flags** (the disagreement record — the cross-check discipline's output):
1. mindat.org page fetches are bot-blocked (403/CAPTCHA; Wayback blocked) — the Handbook of
   Mineralogy (the print source mindat's fields derive from) substituted as second primary, so
   every row IS two-source-fetched; mindat captured via search snippets for the 6 contested rows.
2. Wulfenite lustre: WM "resinous–greasy" is the outlier ("greasy" on no other source); HOM+MD
   adamantine end adopted. WM's narrow diaphaneity also rejected (gemmy Red Cloud tablets are
   plainly transparent).
3. Proustite: WM "sub-metallic" vs HOM+MD "adamantine" — adopted adamantine; WM's value plausibly
   describes light-darkened surfaces (HOM: darkens on exposure — a renderer-relevant ruby-silver
   quirk).
4. Sphalerite: WM omits the adamantine end; HOM+MD resinous→adamantine adopted (n≈2.37, the fire
   in gemmy cleiophane).
5. Vanadinite: WM bare "adamantine" stronger than HOM+MD's sub-prefixed range; range adopted.
6. Rhodochrosite: WM omits transparent; HOM+MD transparent–translucent adopted (gem Sweet Home /
   N'Chwaning crystals are transparent).
7. Siderite is translucent-only in ALL THREE sources — narrower than assumed; hence 0.45 not ~0.6.
8. Clarity scalars are renderer-facing judgment for a *typical fine display specimen* anchored to
   verified range endpoints: 1.0 benchmark = optical calcite / Naica selenite (gypsum 0.95,
   quartz 0.92); metallic opaques 0.00; hematite 0.02 for the thin-edge blood-red; azurite 0.35
   despite "transparent" endpoints (body colour nearly opaque-dark at display thickness);
   malachite 0.08 per the opaque-to-thin-film guidance.

**Batch 2 (A1 execution, 2026-07-02 — the remaining tier-1/2 species, same two-source method;
all 17 fetched, none unverified):**

| # | Mineral (catalog key) | Diaphaneity | clarity | Lustre | Note |
|---|---|---|---|---|---|
| 31 | feldspar (orthoclase; microcline HOM identical) | transparent to translucent | 0.55 | vitreous, pearly on cleavages | one generic set safe |
| 32 | cassiterite | transparent to nearly opaque (dark) | 0.15 | adamantine(-metallic), splendent | thin-edge red-brown glints; zoned |
| 33 | anhydrite | transparent to translucent | 0.75 | HOM face-specific: pearly {010}, vitreous-greasy {001}, vitreous {100} | |
| 34 | celestine | transparent to translucent | 0.80 | vitreous, pearly on cleavages | clearer than barite 0.70 |
| 35 | brochantite | transparent to translucent | 0.45 | vitreous, somewhat pearly | above azurite 0.35 |
| 36 | pharmacolite | transparent to translucent | 0.60 | vitreous, pearly on cleavages; silky fibrous | flag B1 |
| 37 | haidingerite | transparent to translucent | 0.65 | vitreous, pearly on cleavage | flag B2 — NOT adamantine |
| 38 | topaz | transparent | 0.93 | vitreous | gem-clear typical |
| 39 | albite | transparent to translucent | 0.50 | vitreous, typically pearly on cleavages | |
| 40 | lepidolite | transparent to translucent | 0.45 | pearly to vitreous | flag B3 |
| 41 | uraninite | opaque | 0.00 | submetallic, greasy, dull | 0.00 not 0.02: thin-fragment transmission is thin-section-scale |
| 42 | autunite | transparent to translucent | 0.55 | vitreous, pearly on {001} basal plates | |
| 43 | native_bismuth | opaque | 0.00 | metallic | reddish hue, iridescent tarnish |
| 44 | native_arsenic | opaque | 0.00 | metallic (nearly-metallic fresh) | flag B4 — render at the dull end |
| 45 | native_silver | opaque | 0.00 | metallic | tarnishes gray-black |
| 46 | native_gold | opaque | 0.00 | metallic | |
| 47 | nickeline | opaque | 0.00 | metallic | pale copper-red |

**Batch-2 flags**: B1 pharmacolite — WM "translucent to opaque" is the outlier; HOM+mindat
transparent side adopted. B2 haidingerite — WM's "adamantine" unsupported by HOM+mindat; do not
render it adamantine. B3 lepidolite — WM "translucent" only; HOM transparent end adopted (thin
flakes ARE transparent; 0.45 reflects the typical book). B4 native arsenic — HOM "nearly
metallic" + fast tarnish: the dullest of the five metallics when Depth-B lands. Batch-2 clarity
anchors: topaz 0.93 ≥ quartz 0.92; celestine 0.80 > barite 0.70; feldspars/micas cluster
0.45–0.55 (milky-typical despite transparent endpoints); cassiterite 0.15 < sphalerite 0.40.

**Batch 3 (A3 execution, 2026-07-02 — the remaining render-reachable tier-3 species, two parallel
sub-batches, same two-source method; 45 species + the ruby/corundum/sapphire split = 47 blocks;
no unverified rows):**

*3a zeolites + silicates (22):* stilbite 0.62 (pearly {010} — the name MEANS lustre) ·
heulandite 0.60 · scolecite 0.60 (silky fibrous) · mesolite 0.50 · thomsonite 0.45 ·
chabazite 0.70 · chrysoprase 0.40 (variety-level verification — no species page exists) ·
chrysocolla 0.10 · chrysotile 0.20 (silky) · tourmaline 0.80 (the pegmatite ELBAITE reading;
schorl reads opaque-black ~0.04 — split if a schorl locality lands) · spodumene 0.80 (WM page
lacks the fields; HOM+mindat row) · andalusite 0.40 · epidote 0.35 · actinolite 0.35 ·
grossular 0.72 · diopside 0.58 · vesuvianite 0.55 (WM subtransparent-only rejected vs Jeffrey-
mine reality) · pectolite 0.35 (silky) · wollastonite 0.30 (pearly {100} + silky fibrous, both
kept by habit) · prehnite 0.52 · datolite 0.78 · brucite 0.55 (waxy body — HOM over WM).

*3b oxidation-zone / uranyl / As-sulfides (23 + the corundum split):* ruby 0.60 / corundum 0.55
/ sapphire 0.65 (species-page verification, variety readings) · borax 0.55 (WM "greasy"
rejected) · mirabilite 0.75 fresh · thenardite 0.50 · tincalconite 0.10 (the chalky pseudomorph
IS the typical form — form-dependent, both sources true) · adamite 0.65 · conichalcite 0.20 ·
torbernite/zeunerite 0.55 · uranospinite 0.50 (waxy) · annabergite 0.45 · apatite 0.80 ·
carnotite 0.05 (aggregate = opaque powder; WM "pearly" is a micro-flake face reading) ·
tyuyamunite 0.15 · cinnabar 0.55 (adamantine, inclining metallic when dark) · realgar 0.60
(transparent WHEN FRESH — light degrades toward pararealgar; WM "submetallic" rejected) ·
orpiment 0.55 (pearly {010}) · pararealgar 0.12 (HOM-only row) · linarite 0.50 ·
caledonite 0.45 · leadhillite 0.60 (pearly {001}) · pyromorphite 0.55 · mottramite 0.08.

*Batch-3 family-consistency checks (the agents ran them unprompted — kept):* uranyl-phosphates
(torbernite/zeunerite/autunite 0.55) ≫ uranyl-vanadates (tyuyamunite 0.15, carnotite 0.05) —
the vanadate sheet minerals really are muddier; phosphate>arsenate>vanadate ordering holds
(pyromorphite 0.55 = mimetite > vanadinite 0.45); As-sulfides realgar 0.60 > cinnabar/orpiment
0.55 > proustite 0.50; mottramite 0.08 = malachite (velvety near-opaque druse).

*Batch-3 methodology note:* rruff HOM zeolite filenames are inconsistent (stilbiteca.pdf but
heulandite.pdf unsplit; the -Ca/-1A forms 404) and every HOM PDF arrives with 5 junk bytes
before %PDF- — strip before strict parsing. mindat remains bot-blocked.

**After batch 3: 94/180 species verified (52%); every scenario-expected species that is not a
confident opaque-metallic carries a fetched row — the class defaults are now a true tail
safety-net, not load-bearing** (the 14 skipped expects-species are opaque metallics where the
sulfide/native default of 0 is the verified answer by class: molybdenite, cobaltite,
skutterudite, safflorite, acanthite, calaverite, sylvanite, hessite, native_tellurium,
marcasite, arsenopyrite, tetrahedrite, tennantite, awaruite).

**Prominence tiers** (union of `expects_species` across the 37-scenario fleet, 104 distinct):
- **Tier 1 (≥4 scenarios, 10 species)**: calcite 16, quartz 13, sphalerite 7, fluorite 7,
  barite 6, pyrite 5, feldspar 5, selenite 5, galena 4, chalcopyrite 4.
- **Tier 2 (2–3 scenarios, ~24)**: cassiterite, dolomite, anhydrite, halite, celestine,
  malachite, brochantite, mimetite, cerussite, pharmacolite, haidingerite, topaz, albite,
  lepidolite, hematite, uraninite, autunite, aragonite, natives (Bi/As/Ag/Au/S), nickeline.
- **Tier 3 (1 scenario, ~70)**: the long tail — class defaults at ship, verified opportunistically.

## 4. The design (Depth-A)

### 4.1 Data: a per-mineral `optics` block in data/minerals.json

```jsonc
"fluorite": {
  // …existing fields…
  "optics": {
    "diaphaneity": "transparent_to_translucent",   // the textbook range, verbatim category
    "clarity": 0.85,          // [0,1] — TYPICAL fine display specimen; 1.0 = water-clear gem,
                              // 0.5 = cloudy translucent, 0.0 = opaque. THE Depth-A field.
    "lustre": ["vitreous"],  // Depth-B consumer; recorded now while the sources are open
    "lustre_notes": null,     // face-specific fame, e.g. apophyllite "pearly on {001}"
    "source": "mindat+webmineral 2026-07-02"   // or "class-default" for the unverified tail
  }
}
```

Schema rules: `optics` optional (absent → class default, exactly today's behavior); `clarity` is
the only field Depth-A consumes; `lustre` is data-now-consumer-later (one research pass, two
depths served). Class defaults for the tail: sulfide/native/most-oxides → clarity 0 · sulfate/
halide/carbonate/borate → 0.55 · silicate → 0.45 · arsenate/phosphate/vanadate → 0.35 — refined
against the verified table's class means before ship.

### 4.2 Code: ONE builder, replacing the inline assembly

```
buildCrystalMaterial(spec, crystal, state) -> THREE.MeshPhysicalMaterial
```

- Lives beside the dispatch in js/99i; the ~4153-4216 inline block becomes a call.
- **Translucency mapping** (the fixed decision, nothing else):
  `opacity = 1 − TRANSLUCENCY_SPAN · clarity` with `TRANSLUCENCY_SPAN = 0.70` → clarity 1.0 ⇒
  opacity 0.30 (water-clear but present), 0.5 ⇒ 0.65 (cloudy), 0 ⇒ 1.0 (opaque, `transparent`
  flag off entirely — the majority of the catalog keeps today's exact pipeline).
  `transmission` stays 0. No ior/thickness/specular tricks — [[feedback_bedrock_over_effect_hacks]]:
  those are later layers IF ever; % translucency is the bedrock.
- **MeshPhysicalMaterial over MeshStandardMaterial** (the boss's named builder): a superset —
  standard params behave identically at transmission 0, and Depth-B lustre (clearcoat for
  adamantine, sheen for pearly) lands in the same object without a second migration.
- **Composition contract** (all today's modifiers survive, in order):
  1. base = optics block (clarity → opacity/transparent; class heuristics for
     metalness/roughness until Depth-B lustre replaces them)
  2. state modifiers stack as today: etched +0.30 roughness AND clarity×0.35 (a corroded skin
     kills clarity — physically right and it un-flattens the etched read); CDR +0.18 roughness,
     clarity×0.5; perimorph cast → max(opacity floor, 0.42) translucent shell as today.
     **Selenite is the calibration case that shows which way the arrow points**: gypsum's
     species clarity goes HIGH (~0.9 → opacity ~0.37 — the goal NAMES Naica's failure to read
     water-clear as the bug, so the fix must move the look, not preserve it), while the
     HOURGLASS state keeps its shipped ~0.82 legibility via its own inclusion-body modifier
     (clarity×~0.3 when the sandglass needs to read against the blade). The 0.82 magic number
     retires into the MODIFIER's calibration; the species default is free to be honest.
  3. sector-zoned vertexColors: unaffected (opacity and vertexColors compose in three.js)
  4. grow-in sweep multiplies LAST against `naturalOpacity` (already the satellite pattern —
     promote it to the parent path so the sweep never fights the diaphaneity value)
- **Transparency sorting**: many overlapping transparent crystals invite draw-order artifacts.
  Mitigations that keep Depth-A cheap: opacity floor 0.30, `depthWrite` stays default TRUE at
  every opacity, accept minor blend-order softness (druse crystals rarely stack deep); revisit
  only if the eye-check objects. *(A2 implementation note: the original ≥0.5 depthWrite gate was
  dropped — the helix overlay's restore path (js/99j `_helixRestoreCrystalOpacity`) imposes
  depthWrite=true on every crystal material whenever it runs, including at init, and true was
  the shipped behavior for the perimorph/hourglass transparents. One policy, no divergence.)*

### 4.3 What Depth-A explicitly does NOT do
- No lustre consumption (data recorded, class heuristics still drive metalness/roughness).
- No colour changes at all — class_color untouched, smoky/amethyst stay Depth-C.
- No per-crystal clarity modulation (habit/chemistry slots reserved).
- No transmission/refraction/dispersion, ever, without a new boss decision.

## 5. Verification plan (the instrument is part of the deliverable)

1. `tools/optics-audit.mjs` — dump every catalog mineral's RESOLVED material params (clarity
   source, opacity, transparent flag, class fallbacks used); the coverage + no-surprise gate.
   Re-run in CI-adjacent spot checks like thermo-coverage-check.
2. **Baseline byte-identity**: pure render → `gen-js-baseline` + strip digest must stay
   git-identical; SIM 214 holds.
3. **Eye-checks against the image corpus** (the terminal instrument, [[feedback_terminal_verification_specimens]]):
   - Naica/gypsum: the giant blades read water-clear (the goal's named failure today);
   - Elmwood calcite + fluorite: transparent golden dogtooth vs purple cube, THROUGH-reading;
   - galena/pyrite/magnetite: pixel-identical to today (opaque path untouched) — the no-regression leg;
   - selenite hourglass: the 0.82 look survives its de-magic-numbering;
   - a druse scene (mvt) for sorting artifacts.
4. **The before/after THREE overlay** (the 4a.8/Wulff recipe): same crystal, old inline material
   vs new builder, side by side at the renderer's true params.

## 6. Staged plan

- **A1 (data)**: optics blocks for tier 1+2 from the verified table + class defaults for the
  tail; `optics-audit.mjs`. No behavior change (nothing consumes it yet) — commit 1.
- **A2 (builder)**: `buildCrystalMaterial` + the translucency mapping + selenite/perimorph
  de-magic-numbering + eye-checks + byte-identity guard — commit 2, the visible one.
- **Depth-B (lustre)**: consume `lustre` → metalness/roughness/clearcoat/sheen per term;
  face-specific pearly (apophyllite {001}) needs per-face material groups — its own design pass.
- **Depth-C (colour fidelity + through-reading)**: smoky/amethyst/milky per-crystal modulation
  from recorded chemistry/habit; phantom/zoning legibility through transparent bodies; composes
  with sector-zoning. The image-corpus method arc.

## 7. Open questions (none blocking Depth-A)

- Should druse-crust habits (botryoidal, crust tokens) damp clarity at Depth-A already? Leaning
  NO (per-crystal modulation is Depth-C; crusts are rarely the transparent species anyway).
- Feldspar/`ruby`/`chrysoprase` etc. are catalog species without mindat single-species pages
  (group/variety names) — verified individually at fill-in time, not blockers.

---

*Prepared as the goal's research pass; Depth-A awaits a go (or the next session's judgment) —
the STANDING GOAL banner in BACKLOG.md points here now.*
