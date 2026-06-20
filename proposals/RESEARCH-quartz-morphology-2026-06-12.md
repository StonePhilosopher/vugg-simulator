# Quartz morphology — the design problem (2026-06-12)

The last item on the morphology-generalization list, and deliberately a
RESEARCH DOC, not code: quartz's morphology axes do not reduce to the
σ-ladder the other six tenants ride. This note maps why, what quartz
needs instead, and what a future arc would ship. Written while the
registry is fresh — seven tenants in (calcite, halite, sylvite,
native_bismuth, fluorite, pyrite, native_copper, native_gold).

## §1 Why quartz doesn't fit the ladder as-is

The Sunagawa ladder models INTERFACE ROUGHNESS as a function of driving
force: smooth → stepped → hopper → dendritic. Quartz's interesting
morphologies are mostly NOT roughness states:

1. **Sceptres** — a second generation overgrowing the TIP of a first,
   wider than the stem. The axis is GROWTH INTERRUPTION + renewed
   nucleation on a preferred face, not continuous σ. The σ-history
   signature is a hiatus (zero-growth zones) followed by a fresh pulse
   — the zone stack already RECORDS this (zones with step gaps); what's
   missing is a classifier for "hiatus then renewal" and a two-body
   render (stem + cap with distinct radii).
2. **Phantoms** — already partially modeled (is_phantom zones exist!).
   A phantom is an inclusion-dusted former surface, i.e., a marked
   moment, not a regime.
3. **Skeletal / fenster ("window") quartz** — THIS one IS the ladder:
   edge-outpacing-face growth at high σ in rapid-cooling or
   gel-like media. The fenster window is the hopper band. The existing
   'skeletal_fenster' habit string (99a maps it to the hopper texture
   already) is the σ-top — a registry entry COULD drive it.
4. **Tessin habit** — steep rhombohedral elongation from high-P/T
   gradient growth (alpine clefts). A FORM axis (like calcite's Mg or
   fluorite's REE), driven by T/P trajectory, not σ.
5. **Artichoke/sprouting quartz** — split growth (lattice mismatch
   accumulation), a different instability than step bunching.
6. **Amethyst/citrine zoning** — color, already handled by trace
   chemistry zones.

So quartz needs (a) ONE registry band that's real (fenster at the σ
top), (b) a NEW classifier concept (hiatus/renewal → sceptre), (c) a
form rule (Tessin), and (d) explicitly out-of-scope items (splitting).

## §2 What the survey would measure first

`node tools/morph-sigma-observe.mjs --minerals quartz` across the
fleet (quartz grows nearly everywhere — herkimer, pegmatites, porphyry,
epithermal, deccan…). Expected questions:
- Does any scenario's quartz σ spike high enough for an honest fenster
  band? (Herkimer's burial-T movement? epithermal boiling pulses?)
- Do any scenarios already produce growth HIATUSES (zero-growth step
  gaps in quartz zone stacks)? The sceptre classifier needs naturally
  occurring interruptions — seal/breach scenarios
  (reactivated_fluorite_vein) and water-table scenarios are the
  candidates. If hiatuses exist, sceptres are CHEAP: tag a renewal zone
  whose first-N-zones' thickness exceeds the pre-hiatus rim by a ratio.
- What does amethyst-bearing quartz σ look like in deccan (the classic
  sceptre-amethyst locality class)?

## §3 The sceptre design sketch (the new classifier concept)

```
morphSceptreScan(crystal):
  walk zones; find gaps where (z[i+1].step - z[i].step) > HIATUS_STEPS
  for each gap, compare mean growth_rate AFTER vs the rim BEFORE:
    renewal_ratio > SCEPTRE_RATIO → tag zones[i+1..] sceptre_generation += 1
render: generations > 1 → stem radius from gen-0 size, cap radius from
  gen-N size, cap seated at the stem tip (the two-body geometry — a new
  builder, the first NON-single-envelope terrace shape)
narrator: "the crystal stopped, the fluid changed, and a second crystal
  chose the first one's tip"
```
This is a ZONE-STACK pattern classifier, not a σ-band — the registry's
second classifier KIND. It generalizes: barite/calcite sceptres exist
too (the machinery would be mineral-agnostic from day one).

## §4 What ships when (the future arc's shape)

1. Survey + hiatus census (the §2 questions — one tool run + a probe).
2. Fenster band: MORPH_TH.quartz with only the top band occupied
   honestly (the skeletal_fenster string + hopper texture pre-exist).
3. Sceptre classifier + two-body render + narrator (the real work).
4. Tessin form rule (alpine-cleft scenario prerequisite — none exists;
   an alpine cleft is its own add-scenario arc with fissure
   architecture and retrograde T movement — a wish-list candidate).

## §5 Out of scope, named

Split/artichoke growth (lattice-mismatch instability — no engine
concept for accumulated strain); chalcedony/agate banding (already a
texture habit, different mechanism); faden quartz (tectonic
crack-seal — would ride a fissure scenario's events, not σ).

## §6 SCOUTING FINDINGS (2026-06-19) — the arc is CONTENT-BLOCKED

Step 1 (§4.1) ran. Three new benches (all reusable, in tools/):
`morph-sigma-observe.mjs --minerals quartz` (the σ survey),
`quartz-hiatus-census.mjs` (the sceptre signature probe), and
`quartz-morphology-map.mjs` (the candidate-band calibration bench, the
`--engine` analog). The finding is decisive and INVERTS §4's premise:
every quartz habit needs purpose-built scenario content; none can be
honestly calibrated against the current fleet.

**Fenster (§4.2) — NO honest calibration target.** The σ survey
confirms quartz σ spans an enormous range (fleet p50 14.2, p99 284, max
316), so a band *edge* is placeable. But the calibration bench shows the
ranking is geologically BACKWARDS: under pure σ the only scenario
reading ≥25% fenster is `radioactive_pegmatite` (33%), then `schneeberg`
(24% hopper), then `bisbee` — the SLOW GIANT-EUHEDRAL settings (pegmatite
quartz is 18 mm massive crystals; size p50 18 553 µm), while the
genuinely-skeletal-plausible gel/supergene scenarios (`ultramafic_
supergene`, `colorado_plateau`, `supergene_oxidation`; size p50
0.9–1.2 mm) read smooth→stepped. Calcite-style boundary-layer damping
(half 80 / cap 2000) empties the band entirely (everyone smooths). There
is no σ edge that puts the gel/supergene set in fenster while keeping the
pegmatites out — the pegmatites have the HIGHER σ. Growth-RATE inverts
the same way (pegmatite quartz deposits ~126 µm/zone vs gel ~5 µm/zone).
Root cause: the engine's σ is a silica-ABUNDANCE signal; real fenster is
a rapid-quench/gel-medium habit the fleet doesn't encode. An occupied
fenster band would be a CONFABULATED label (the mvt-silver / deccan-
narrative "preserved wart" anti-pattern). DO NOT ship one on this fleet.

**Sceptre (§4.3) — machinery buildable, signature ABSENT.** The hiatus
census: growth hiatuses DO occur naturally (pulse, supergene_oxidation,
schneeberg show multi-step gaps; resorption/dissolution zones common),
so the zone stack records interruptions as predicted. BUT zero scenarios
show the sceptre signature — every hiatus is followed by SLOWER growth
(renewal/rim ratio 0.14–0.87, fleet max 0.87, never the ≥1.3 a sceptre
needs). Geologically sensible: these hiatuses are WANING-σ events (fluid
running out / cooling), so growth resumes weaker — the opposite of a
fresh pulse overgrowing the tip wider. A sceptre classifier would tag
NOTHING without an engineered seal/breach or water-table-drop→reflood
scenario that delivers a fresh HIGH-σ pulse after the gap.

**Tessin (§4.4) — still needs the Alpine-cleft scenario** (none exists),
as already noted.

**Conclusion / fork.** The arc is gated on SCENARIO content, not on
classifier code. Three honest paths: (a) PAUSE quartz, take a clean
content win elsewhere (catalog orphans #13); (b) build an Alpine-cleft /
fissure scenario FIRST (retrograde-T, crack-seal events) — the natural
single home for Tessin + faden + sceptre + skeletal quartz, turning the
blocked arc into real content with a live calibration target, then ride
the morphology on it; (c) ship MORPH_TH.quartz + a hex-prism terrace
render path as inert ladder-completeness infra (bands above the fleet,
fires when a future skeletal scenario lands — the fluorite-REE-octahedra
precedent) — honest but zero current payoff and real render work for it.
Recommendation: (a) now or (b) when an Alpine-cleft arc is wanted; NOT
(c) by itself. The benches are kept so any of these can resume cold.

**RESOLVED (2026-06-19): path (b) chosen** — building a Swiss Central-Alps
(Grimsel / Aar massif) alpine-cleft scenario as the content home (dossier:
research-grimsel-alpine-cleft.md). Quartz habits the cleft homes: Tessin
(steep rhomb, high-T+CO2+slow), sceptre (crack-seal hiatus→fresh pulse),
fenster (rapid-pulse moment), and — boss add — GWINDEL: the twisted
en-echelon plate column that is EXCLUSIVE to alpine-type fissures and forms
in weakly-metamorphosed igneous rock (the Aar granite is a type setting),
always with macromosaic normal-habit quartz. Mechanism = cumulative c-axis
rotation during slow continuous cleft opening → driven by the D2/D3
strike-slip reactivation (rotating stress field), a FORM/render axis not a
σ band. Arc tasks #106–111; titanite (#106, de-orphans §A #13) first.
