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
